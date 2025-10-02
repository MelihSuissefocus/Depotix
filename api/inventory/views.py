from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.contrib.auth.models import User
from django.db import transaction
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers as rf_serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFilter, CharFilter
from rest_framework.filters import OrderingFilter, SearchFilter
from .exceptions import InsufficientStockError
from .models import Category, InventoryItem, InventoryLog, StockMovement, Supplier, Customer, Expense, CompanyProfile, SalesOrder, SalesOrderItem, Invoice
from .serializers import (
    UserRegistrationSerializer, UserSerializer,
    CategorySerializer, InventoryItemSerializer, InventoryLogSerializer,
    StockMovementSerializer, SupplierSerializer, CustomerSerializer, ExpenseSerializer,
    CompanyProfileSerializer, SalesOrderSerializer, SalesOrderItemSerializer, InvoiceSerializer
)
from .services import book_stock_change, validate_stock_movement_data, StockOperationError
from .utils.pdf import render_invoice_pdf, _qr_svg_data_uri


class UserViewSet(viewsets.ModelViewSet):
    """User management viewset"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_permissions(self):
        """
        Allow registration without authentication
        """
        if self.action == 'create':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        return UserSerializer
    
    def create(self, request, *args, **kwargs):
        """Register a new user"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """Get or update current user profile"""
        if request.method == 'GET':
            serializer = self.get_serializer(request.user)
            return Response(serializer.data)
        
        elif request.method == 'PATCH':
            serializer = self.get_serializer(request.user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def logout(self, request):
        """Logout user (blacklist refresh token)"""
        try:
            refresh_token = request.data.get("refresh_token")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({"message": "Logout successful"}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"message": "Logout successful"}, status=status.HTTP_200_OK)


class CategoryViewSet(viewsets.ModelViewSet):
    """Category management viewset"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]


class InventoryItemViewSet(viewsets.ModelViewSet):
    """Inventory item management viewset"""
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Filter items by current user (owner)
        return InventoryItem.objects.filter(owner=self.request.user)


class InventoryLogViewSet(viewsets.ModelViewSet):
    """Inventory log viewset (read-only)"""
    queryset = InventoryLog.objects.all()
    serializer_class = InventoryLogSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get']  # Read-only
    
    def get_queryset(self):
        # Filter logs by items owned by current user
        return InventoryLog.objects.filter(item__owner=self.request.user).order_by('-timestamp')


class SupplierViewSet(viewsets.ModelViewSet):
    """Supplier management viewset"""
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Filter suppliers by current user (owner)
        return Supplier.objects.filter(owner=self.request.user)


class CustomerViewSet(viewsets.ModelViewSet):
    """Customer management viewset"""
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Filter customers by current user (owner)
        return Customer.objects.filter(owner=self.request.user)


class StockMovementViewSet(viewsets.ModelViewSet):
    """Stock movement management with filtering and ordering"""
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['type', 'item', 'supplier', 'customer']
    search_fields = ['item__name', 'note']
    ordering_fields = ['created_at', 'id']
    ordering = ['-created_at']
    
    def get_queryset(self):
        # Filter stock movements by items owned by current user
        return StockMovement.objects.filter(
            item__owner=self.request.user
        ).select_related('item', 'supplier', 'customer', 'created_by')
    
    def perform_create(self, serializer):
        """
        Create stock movement with ACID guarantees and idempotency.

        This is the core transaction service (moveInventory) that ensures:
        1. Idempotency: Same idempotency_key returns existing movement
        2. Atomicity: Movement + quantity update in single transaction
        3. Consistency: PPU conversion validated, negative stock prevented
        4. Isolation: Row-level locking via SELECT FOR UPDATE
        5. Durability: DB constraints enforce data integrity

        Raises:
            IdempotencyConflictError: If idempotency_key exists (returns 200)
            InsufficientStockError: If insufficient stock (returns 422)
            PPUConversionError: If client/server PPU mismatch (returns 400)
            ValidationError: For other validation failures (returns 400)
        """
        from django.db import transaction, IntegrityError
        from .utils import (
            validate_movement_data,
            calculate_delta,
            verify_ppu_conversion
        )
        from .exceptions import (
            InsufficientStockError,
            IdempotencyConflictError,
            PPUConversionError
        )
        from .models import InventoryItem, StockMovement
        import uuid

        # ====================================================================
        # STEP 1: Extract and generate idempotency_key
        # ====================================================================
        idempotency_key = serializer.validated_data.get('idempotency_key')
        if not idempotency_key:
            # Server-side UUID generation if client didn't provide
            idempotency_key = str(uuid.uuid4())
            serializer.validated_data['idempotency_key'] = idempotency_key

        # ====================================================================
        # STEP 2: Check idempotency (early return if duplicate)
        # ====================================================================
        try:
            existing_movement = StockMovement.objects.get(idempotency_key=idempotency_key)
            # Idempotent response: Return existing movement as 200 OK
            raise IdempotencyConflictError(
                f"Movement already processed with key {idempotency_key}",
                existing_movement=existing_movement
            )
        except StockMovement.DoesNotExist:
            # Good: No duplicate, proceed with creation
            pass

        # ====================================================================
        # STEP 3: BEGIN ATOMIC TRANSACTION
        # ====================================================================
        try:
            with transaction.atomic():
                # Extract validated data
                item = serializer.validated_data['item']
                movement_type = serializer.validated_data['type']
                qty_base = serializer.validated_data['qty_base']
                qty_pallets = serializer.validated_data.get('qty_pallets', 0)
                qty_packages = serializer.validated_data.get('qty_packages', 0)
                qty_singles = serializer.validated_data.get('qty_singles', 0)

                # ============================================================
                # STEP 4: Verify PPU conversion (defense-in-depth)
                # ============================================================
                if qty_pallets or qty_packages or qty_singles:
                    try:
                        verify_ppu_conversion(
                            qty_pallets,
                            qty_packages,
                            qty_singles,
                            item.unit_pallet_factor,
                            item.unit_package_factor,
                            qty_base,
                            strict=True
                        )
                    except Exception as e:
                        raise PPUConversionError(str(e))

                # ============================================================
                # STEP 5: Lock item row (pessimistic locking for concurrency)
                # ============================================================
                item = InventoryItem.objects.select_for_update().get(id=item.id)

                # ============================================================
                # STEP 6: Validate movement constraints
                # ============================================================
                validate_movement_data(
                    movement_type,
                    qty_base,
                    item.quantity,
                    item.name
                )

                # ============================================================
                # STEP 7: Calculate delta and new quantity
                # ============================================================
                delta = calculate_delta(movement_type, qty_base, item.quantity)
                new_qty = item.quantity + delta

                # Double-check: Prevent negative stock (DB constraint will also catch this)
                if new_qty < 0:
                    raise InsufficientStockError(
                        f"Nicht genügend Lagerbestand für {item.name}. "
                        f"Verfügbar: {item.quantity}, Angefordert: {qty_base}"
                    )

                # ============================================================
                # STEP 8: Update item quantity (denormalized cache)
                # ============================================================
                item.quantity = new_qty
                item.save(update_fields=['quantity', 'last_updated'])

                # ============================================================
                # STEP 9: Save movement (append-only ledger)
                # ============================================================
                serializer.validated_data['created_by'] = self.request.user
                # Pass skip_quantity_update via context to avoid double-updating quantity
                serializer.context['skip_quantity_update'] = True
                movement = serializer.save()

                # Transaction commits here if no exceptions

        except IntegrityError as e:
            # Race condition: Another request created same idempotency_key
            if 'idempotency_key' in str(e) or 'unique constraint' in str(e).lower():
                existing_movement = StockMovement.objects.get(idempotency_key=idempotency_key)
                raise IdempotencyConflictError(
                    f"Concurrent request detected for key {idempotency_key}",
                    existing_movement=existing_movement
                )
            # Re-raise other integrity errors
            raise
    
    @action(detail=False, methods=['post'], url_path='in')
    def stock_in(self, request):
        """Convenient endpoint for stock IN movements"""
        data = request.data.copy()
        data['type'] = 'IN'
        # Remove customer if provided (not allowed for IN movements)
        data.pop('customer', None)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        try:
            self.perform_create(serializer)
        except (rf_serializers.ValidationError, InsufficientStockError):
            raise

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=False, methods=['post'], url_path='out')
    def stock_out(self, request):
        """Convenient endpoint for stock OUT movements"""
        data = request.data.copy()
        data['type'] = 'OUT'
        # Remove supplier if provided (not allowed for OUT movements)
        data.pop('supplier', None)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        try:
            self.perform_create(serializer)
        except (rf_serializers.ValidationError, InsufficientStockError):
            raise

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=False, methods=['post'], url_path='return')
    def return_(self, request):
        """Convenient endpoint for stock RETURN movements"""
        data = request.data.copy()
        data['type'] = 'RETURN'

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        try:
            self.perform_create(serializer)
        except (rf_serializers.ValidationError, InsufficientStockError):
            raise

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class ExpenseFilter(FilterSet):
    """Filter set for expense queries"""
    date_after = DateFilter(field_name="date", lookup_expr="gte")
    date_before = DateFilter(field_name="date", lookup_expr="lte")
    category = CharFilter(field_name="category", lookup_expr="exact")

    class Meta:
        model = Expense
        fields = ["category", "date_after", "date_before"]


class ExpenseViewSet(viewsets.ModelViewSet):
    """Expense management viewset with filtering and search"""
    queryset = Expense.objects.select_related("supplier").all().order_by("-date", "-created_at")
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = ExpenseFilter
    search_fields = ["description", "receipt_number", "supplier__name"]
    ordering_fields = ["date", "amount", "created_at", "id"]
    ordering = ["-date", "-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Owner scoping if your model has `owner`
        user = self.request.user
        if not user.is_staff and hasattr(Expense, "owner"):
            qs = qs.filter(owner=user)
        return qs

    def perform_create(self, serializer):
        # Set owner automatically if field exists
        kwargs = {}
        if hasattr(Expense, "owner"):
            kwargs["owner"] = self.request.user
        serializer.save(**kwargs)


class CompanyProfileView(APIView):
    """Company profile management view"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get or create company profile for current user"""
        profile, created = CompanyProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'name': '',
                'street': '',
                'postal_code': '',
                'city': '',
                'email': request.user.email or '',
                'phone': ''
            }
        )
        serializer = CompanyProfileSerializer(profile)
        return Response(serializer.data)
    
    def patch(self, request):
        """Partial update of company profile"""
        profile, created = CompanyProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'name': '',
                'street': '',
                'postal_code': '',
                'city': '',
                'email': request.user.email or '',
                'phone': ''
            }
        )
        serializer = CompanyProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SalesOrderViewSet(viewsets.ModelViewSet):
    """Sales order management viewset with status workflow actions"""
    serializer_class = SalesOrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['status', 'customer', 'order_date', 'delivery_date']
    search_fields = ['order_number', 'customer__name']
    ordering_fields = ['order_date', 'order_number', 'total_gross']
    ordering = ['-order_date']
    
    def get_queryset(self):
        """Filter sales orders by current user - non-staff users see only their orders"""
        user = self.request.user
        if user.is_staff:
            return SalesOrder.objects.all().select_related('customer', 'created_by').prefetch_related('items')
        else:
            return SalesOrder.objects.filter(created_by=user).select_related('customer', 'created_by').prefetch_related('items')
    
    def perform_create(self, serializer):
        """Set created_by to current user"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm_order(self, request, pk=None):
        """Confirm order: DRAFT → CONFIRMED"""
        try:
            with transaction.atomic():
                order = self.get_object()
                
                if order.status != 'DRAFT':
                    return Response(
                        {'error': {'code': 'INVALID_STATUS', 'message': 'Only DRAFT orders can be confirmed'}},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY
                    )
                
                order.status = 'CONFIRMED'
                order.save()
                
                serializer = self.get_serializer(order)
                return Response(serializer.data)
        
        except Exception as e:
            return Response(
                {'error': {'code': 'CONFIRMATION_FAILED', 'message': str(e)}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], url_path='deliver')
    def deliver_order(self, request, pk=None):
        """Deliver order: CONFIRMED → DELIVERED, create stock movements"""
        try:
            with transaction.atomic():
                order = self.get_object()
                
                if order.status != 'CONFIRMED':
                    return Response(
                        {'error': {'code': 'INVALID_STATUS', 'message': 'Only CONFIRMED orders can be delivered'}},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY
                    )
                
                # Process each order item and create stock movements
                for order_item in order.items.all():
                    # Use pessimistic locking on inventory item
                    inventory_item = InventoryItem.objects.select_for_update().get(id=order_item.item.id)
                    
                    # Check stock availability
                    if inventory_item.available_qty < order_item.qty_base:
                        return Response(
                            {'error': {
                                'code': 'INSUFFICIENT_STOCK', 
                                'message': f'Insufficient stock for {inventory_item.name}. Available: {inventory_item.available_qty}, Required: {order_item.qty_base}'
                            }},
                            status=status.HTTP_422_UNPROCESSABLE_ENTITY
                        )
                    
                    # Create stock movement (OUT)
                    StockMovement.objects.create(
                        item=inventory_item,
                        type='OUT',
                        qty_base=order_item.qty_base,
                        customer=order.customer,
                        note=f'Delivery for order {order.order_number}',
                        created_by=request.user
                    )
                
                # Update order status
                order.status = 'DELIVERED'
                order.save()
                
                serializer = self.get_serializer(order)
                return Response(serializer.data)
        
        except InventoryItem.DoesNotExist:
            return Response(
                {'error': {'code': 'ITEM_NOT_FOUND', 'message': 'One or more items not found'}},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': {'code': 'DELIVERY_FAILED', 'message': str(e)}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], url_path='invoice')
    def create_invoice(self, request, pk=None):
        """Create invoice from order: DELIVERED → INVOICED"""
        try:
            with transaction.atomic():
                order = self.get_object()
                
                if order.status != 'DELIVERED':
                    return Response(
                        {'error': {'code': 'INVALID_STATUS', 'message': 'Only DELIVERED orders can be invoiced'}},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY
                    )
                
                # Check if invoice already exists
                if hasattr(order, 'invoice'):
                    return Response(
                        {'error': {'code': 'INVOICE_EXISTS', 'message': 'Order already has an invoice'}},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY
                    )
                
                # Create invoice (model handles numbering and totals automatically)
                invoice = Invoice.objects.create(order=order)
                
                # Update order status
                order.status = 'INVOICED'
                order.save()
                
                # Return invoice data
                invoice_serializer = InvoiceSerializer(invoice)
                return Response(invoice_serializer.data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response(
                {'error': {'code': 'INVOICE_CREATION_FAILED', 'message': str(e)}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SalesOrderItemViewSet(viewsets.ModelViewSet):
    """Sales order item management viewset"""
    serializer_class = SalesOrderItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['order', 'item']
    search_fields = ['item__name', 'item__sku']
    ordering_fields = ['id', 'qty_base', 'unit_price']
    ordering = ['id']
    
    def get_queryset(self):
        """Filter order items by current user - non-staff users see only their order items"""
        user = self.request.user
        if user.is_staff:
            return SalesOrderItem.objects.all().select_related('order', 'item')
        else:
            return SalesOrderItem.objects.filter(order__created_by=user).select_related('order', 'item')


class InvoiceViewSet(viewsets.ModelViewSet):
    """Invoice management viewset"""
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['issue_date', 'due_date', 'currency']
    search_fields = ['invoice_number', 'order__customer__name', 'order__order_number']
    ordering_fields = ['issue_date', 'due_date', 'total_gross']
    ordering = ['-issue_date']
    
    def get_queryset(self):
        """Filter invoices by current user - non-staff users see only their invoices"""
        user = self.request.user
        if user.is_staff:
            # Staff users see all invoices including archived ones
            return Invoice.objects.all().select_related(
                'order',
                'order__customer',
                'order__created_by'
            ).prefetch_related('order__items', 'order__items__item')
        else:
            # Regular users see all their invoices (including archived ones)
            return Invoice.objects.filter(
                order__created_by=user
            ).select_related(
                'order',
                'order__customer',
                'order__created_by'
            ).prefetch_related('order__items', 'order__items__item')
    
    @action(detail=True, methods=['get'], url_path='pdf')
    def generate_pdf(self, request, pk=None):
        """Generate PDF for invoice with Swiss QR bill"""
        try:
            invoice = self.get_object()
            order = invoice.order
            customer = order.customer
            
            # Get company profile
            try:
                company_profile = request.user.company_profile
            except CompanyProfile.DoesNotExist:
                return Response(
                    {'error': {'code': 'NO_PROFILE', 'message': 'Bitte Firmenprofil mit IBAN hinterlegen.'}},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if IBAN is available
            if not company_profile.iban:
                return Response(
                    {'error': {'code': 'NO_PROFILE', 'message': 'Bitte Firmenprofil mit IBAN hinterlegen.'}},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Build creditor info (supplier)
            creditor = {
                'name': company_profile.name,
                'street': company_profile.street,
                'postal_code': company_profile.postal_code,
                'city': company_profile.city,
                'country': company_profile.country
            }
            
            # Build debtor info (customer) - extract from customer address
            customer_address_lines = customer.address.split('\n') if customer.address else []
            debtor = {
                'name': customer.name,
                'street': customer_address_lines[0] if len(customer_address_lines) > 0 else '',
                'postal_code': customer_address_lines[1].split()[0] if len(customer_address_lines) > 1 else '',
                'city': ' '.join(customer_address_lines[1].split()[1:]) if len(customer_address_lines) > 1 else '',
                'country': 'CH'  # Default to Switzerland
            }
            
            # Build lines from order items
            lines = []
            for order_item in order.items.all():
                lines.append({
                    'name': order_item.item.name,
                    'description': order_item.item.description,
                    'sku': order_item.item.sku,
                    'qty_base': order_item.qty_base,
                    'unit_price': order_item.unit_price,
                    'tax_rate': order_item.tax_rate,
                    'line_total_net': order_item.line_total_net,
                    'line_tax': order_item.line_tax,
                    'line_total_gross': order_item.line_total_gross,
                })
            
            # Generate QR code data URI
            qr_data_uri = None
            import logging
            logger = logging.getLogger(__name__)

            try:
                logger.info(f"Starting QR code generation for invoice {invoice.invoice_number}")
                qr_data_uri = _qr_svg_data_uri(
                    iban=company_profile.iban,
                    creditor=creditor,
                    debtor=debtor,
                    amount=invoice.total_gross,
                    currency=invoice.currency,
                    reference=invoice.invoice_number,
                    message=f"Rechnung {invoice.invoice_number}"
                )
                logger.info(f"QR code generated successfully for invoice {invoice.invoice_number}, URI length: {len(qr_data_uri)}")
            except ValueError as e:
                # Log the specific error but continue WITHOUT QR code
                logger.warning(f"QR bill generation failed for invoice {invoice.invoice_number}: {str(e)}")
                logger.warning("Continuing PDF generation without QR code")
                qr_data_uri = None
            except Exception as e:
                # Unexpected error - log but continue without QR code
                logger.error(f"Unexpected error generating QR bill for invoice {invoice.invoice_number}", exc_info=True)
                logger.warning("Continuing PDF generation without QR code")
                qr_data_uri = None
            
            # Build context for template
            context = {
                'supplier': company_profile,
                'customer': customer,
                'invoice': invoice,
                'order': order,
                'lines': lines,
                'qr_data_uri': qr_data_uri,
                'today': timezone.now().date()
            }
            
            # Generate PDF
            pdf_bytes = render_invoice_pdf(context)
            
            # Create HTTP response with PDF
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{invoice.invoice_number}.pdf"'
            
            return response
            
        except Exception as e:
            return Response(
                {'error': {'code': 'PDF_GENERATION_FAILED', 'message': f'Fehler bei der PDF-Erstellung: {str(e)}'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='archive')
    def archive_invoice(self, request, pk=None):
        """Archive an invoice with comprehensive error handling"""
        import logging
        logger = logging.getLogger(__name__)

        try:
            # Log the operation attempt
            logger.info(f"Attempting to archive invoice {pk} for user {request.user}")

            # This will raise 404 if invoice doesn't exist
            invoice = self.get_object()

            # Additional validation - ensure the invoice can be archived
            if invoice.is_archived:
                logger.warning(f"Invoice {pk} is already archived")
                return Response(
                    {'message': 'Rechnung ist bereits archiviert', 'is_archived': True},
                    status=status.HTTP_200_OK
                )

            # Perform the archive operation
            invoice.is_archived = True
            invoice.save(update_fields=['is_archived'])

            logger.info(f"Successfully archived invoice {pk}")
            return Response(
                {'message': 'Rechnung erfolgreich archiviert', 'is_archived': True},
                status=status.HTTP_200_OK
            )

        except Invoice.DoesNotExist:
            logger.error(f"Invoice {pk} does not exist for archive operation")
            return Response(
                {'error': {'code': 'INVOICE_NOT_FOUND', 'message': f'Rechnung mit ID {pk} nicht gefunden'}},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Failed to archive invoice {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': {'code': 'ARCHIVE_FAILED', 'message': f'Fehler beim Archivieren: {str(e)}'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, *args, **kwargs):
        """Delete an invoice permanently"""
        import logging
        logger = logging.getLogger(__name__)

        try:
            invoice = self.get_object()
            invoice_number = invoice.invoice_number

            logger.info(f"Attempting to delete invoice {invoice_number} (ID: {invoice.id}) for user {request.user}")

            # Perform the delete operation
            invoice.delete()

            logger.info(f"Successfully deleted invoice {invoice_number}")
            return Response(
                {'message': f'Rechnung {invoice_number} erfolgreich gelöscht'},
                status=status.HTTP_204_NO_CONTENT
            )

        except Invoice.DoesNotExist:
            logger.error(f"Invoice does not exist for delete operation")
            return Response(
                {'error': {'code': 'INVOICE_NOT_FOUND', 'message': 'Rechnung nicht gefunden'}},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Failed to delete invoice: {str(e)}", exc_info=True)
            return Response(
                {'error': {'code': 'DELETE_FAILED', 'message': f'Fehler beim Löschen: {str(e)}'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='unarchive')
    def unarchive_invoice(self, request, pk=None):
        """Unarchive an invoice with comprehensive error handling"""
        import logging
        logger = logging.getLogger(__name__)

        try:
            # Log the operation attempt
            logger.info(f"Attempting to unarchive invoice {pk} for user {request.user}")

            # This will raise 404 if invoice doesn't exist
            invoice = self.get_object()

            # Additional validation - ensure the invoice can be unarchived
            if not invoice.is_archived:
                logger.warning(f"Invoice {pk} is not archived")
                return Response(
                    {'message': 'Rechnung ist nicht archiviert', 'is_archived': False},
                    status=status.HTTP_200_OK
                )

            # Perform the unarchive operation
            invoice.is_archived = False
            invoice.save(update_fields=['is_archived'])

            logger.info(f"Successfully unarchived invoice {pk}")
            return Response(
                {'message': 'Rechnung erfolgreich dearchiviert', 'is_archived': False},
                status=status.HTTP_200_OK
            )

        except Invoice.DoesNotExist:
            logger.error(f"Invoice {pk} does not exist for unarchive operation")
            return Response(
                {'error': {'code': 'INVOICE_NOT_FOUND', 'message': f'Rechnung mit ID {pk} nicht gefunden'}},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Failed to unarchive invoice {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': {'code': 'UNARCHIVE_FAILED', 'message': f'Fehler beim Dearchivieren: {str(e)}'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='delete')
    def delete_invoice(self, request, pk=None):
        """Delete an invoice via POST action with comprehensive error handling"""
        import logging
        logger = logging.getLogger(__name__)

        try:
            # Log the operation attempt
            logger.info(f"Attempting to delete invoice {pk} for user {request.user}")

            # This will raise 404 if invoice doesn't exist
            invoice = self.get_object()

            # Store invoice info for logging before deletion
            invoice_number = invoice.invoice_number
            customer_name = invoice.order.customer.name if invoice.order and invoice.order.customer else "Unknown"

            # Optional: Add additional checks here (e.g., prevent deletion of paid invoices)
            # You can add business logic validation here

            # Perform the delete operation
            invoice.delete()

            logger.info(f"Successfully deleted invoice {invoice_number} (ID: {pk}) for customer {customer_name}")
            return Response(
                {'message': f'Rechnung {invoice_number} erfolgreich gelöscht'},
                status=status.HTTP_204_NO_CONTENT
            )

        except Invoice.DoesNotExist:
            logger.error(f"Invoice {pk} does not exist for delete operation")
            return Response(
                {'error': {'code': 'INVOICE_NOT_FOUND', 'message': f'Rechnung mit ID {pk} nicht gefunden'}},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Failed to delete invoice {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': {'code': 'DELETE_FAILED', 'message': f'Fehler beim Löschen: {str(e)}'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, *args, **kwargs):
        """Delete an invoice with proper authorization"""
        try:
            instance = self.get_object()
            # Optional: Add additional checks here (e.g., prevent deletion of paid invoices)
            instance.delete()
            return Response(
                {'message': 'Rechnung erfolgreich gelöscht'},
                status=status.HTTP_204_NO_CONTENT
            )
        except Exception as e:
            return Response(
                {'error': {'code': 'DELETE_FAILED', 'message': f'Fehler beim Löschen: {str(e)}'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
