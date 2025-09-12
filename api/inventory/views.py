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
        """Create stock movement with atomic transaction"""
        try:
            with transaction.atomic():
                serializer.save()
        except ValidationError as e:
            # Convert Django ValidationError to DRF ValidationError with 422 status
            error_message = str(e)
            
            # Check if it's a stock availability error for 422 response
            if "Only" in error_message and "units available" in error_message:
                # Create custom response for 422
                from rest_framework.response import Response
                error_data = {
                    'error': {
                        'code': 'INSUFFICIENT_STOCK',
                        'message': error_message
                    }
                }
                # Use custom exception that we can catch in exception handler
                raise InsufficientStockError(error_message)
            else:
                # Other validation errors as 400
                raise rf_serializers.ValidationError({"detail": error_message})
    
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
            with transaction.atomic():
                self.perform_create(serializer)
        except rf_serializers.ValidationError:
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
            with transaction.atomic():
                self.perform_create(serializer)
        except rf_serializers.ValidationError:
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
            with transaction.atomic():
                self.perform_create(serializer)
        except rf_serializers.ValidationError:
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


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Invoice management viewset (read-only)"""
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
            return Invoice.objects.all().select_related('order', 'order__customer', 'order__created_by')
        else:
            return Invoice.objects.filter(order__created_by=user).select_related('order', 'order__customer', 'order__created_by')
    
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
            try:
                qr_data_uri = _qr_svg_data_uri(
                    iban=company_profile.iban,
                    creditor=creditor,
                    debtor=debtor,
                    amount=invoice.total_gross,
                    currency=invoice.currency,
                    reference=invoice.invoice_number,
                    message=f"Rechnung {invoice.invoice_number}"
                )
            except Exception as e:
                # QR bill generation failed, continue without it
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
