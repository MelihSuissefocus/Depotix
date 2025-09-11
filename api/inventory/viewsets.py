from django.db import transaction, models
from django.http import HttpResponse
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view

from .models import (
    Category, Supplier, Customer, InventoryItem, Expense, InventoryLog,
    InventoryItemSupplier, StockMovement, SalesOrder, SalesOrderItem, 
    Invoice, DocumentSequence
)
from .serializers import (
    CategorySerializer, SupplierSerializer, CustomerSerializer,
    InventoryItemSerializer, ExpenseSerializer, InventoryLogSerializer,
    InventoryItemSupplierSerializer, StockMovementSerializer, 
    SalesOrderSerializer, SalesOrderItemSerializer, InvoiceSerializer,
    DocumentSequenceSerializer, StockMovementCreateSerializer,
    InventoryItemListSerializer
)
from .permissions import (
    IsOwnerOrStaffReadWrite, IsStaffOrReadOnly, StockMovementPermission,
    SalesOrderPermission
)
from .views import (
    InventoryItemFilter, StockMovementFilter, SalesOrderFilter, ExpenseFilter
)


@extend_schema_view(
    list=extend_schema(tags=['Categories']),
    create=extend_schema(tags=['Categories']),
    retrieve=extend_schema(tags=['Categories']),
    update=extend_schema(tags=['Categories']),
    destroy=extend_schema(tags=['Categories']),
)
class CategoryViewSet(viewsets.ModelViewSet):
    """CRUD operations for categories"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsStaffOrReadOnly]
    filterset_fields = ['name']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


@extend_schema_view(
    list=extend_schema(tags=['Suppliers']),
    create=extend_schema(tags=['Suppliers']),
    retrieve=extend_schema(tags=['Suppliers']),
    update=extend_schema(tags=['Suppliers']),
    destroy=extend_schema(tags=['Suppliers']),
)
class SupplierViewSet(viewsets.ModelViewSet):
    """CRUD operations for suppliers"""
    serializer_class = SupplierSerializer
    permission_classes = [IsOwnerOrStaffReadWrite]
    filterset_fields = ['is_active', 'name']
    search_fields = ['name', 'contact_name', 'email']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Supplier.objects.all()
        return Supplier.objects.filter(owner=self.request.user)


@extend_schema_view(
    list=extend_schema(tags=['Customers']),
    create=extend_schema(tags=['Customers']),
    retrieve=extend_schema(tags=['Customers']),
    update=extend_schema(tags=['Customers']),
    destroy=extend_schema(tags=['Customers']),
)
class CustomerViewSet(viewsets.ModelViewSet):
    """CRUD operations for customers"""
    serializer_class = CustomerSerializer
    permission_classes = [IsOwnerOrStaffReadWrite]
    filterset_fields = ['is_active', 'name']
    search_fields = ['name', 'contact_name', 'email']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Customer.objects.all()
        return Customer.objects.filter(owner=self.request.user)


@extend_schema_view(
    list=extend_schema(tags=['Items']),
    create=extend_schema(tags=['Items']),
    retrieve=extend_schema(tags=['Items']),
    update=extend_schema(tags=['Items']),
    destroy=extend_schema(tags=['Items']),
)
class InventoryItemViewSet(viewsets.ModelViewSet):
    """CRUD operations for inventory items"""
    serializer_class = InventoryItemSerializer
    permission_classes = [IsOwnerOrStaffReadWrite]
    filterset_class = InventoryItemFilter
    search_fields = ['name', 'sku', 'description']
    ordering_fields = ['name', 'quantity', 'price', 'last_updated']
    ordering = ['-last_updated']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return InventoryItem.objects.select_related('category', 'owner').all()
        return InventoryItem.objects.select_related('category').filter(owner=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'list':
            return InventoryItemListSerializer
        return InventoryItemSerializer
    
    @extend_schema(
        tags=['Items'],
        summary="Get low stock items",
        description="Returns items where available quantity is below minimum stock level"
    )
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get items with low stock levels"""
        queryset = self.get_queryset().filter(
            quantity__lte=models.F('min_stock_level')
        )
        
        # Apply category/supplier filters if provided
        category = request.query_params.get('category')
        supplier = request.query_params.get('supplier')
        
        if category:
            queryset = queryset.filter(category__id=category)
        if supplier:
            queryset = queryset.filter(
                inventoryitemsupplier__supplier__id=supplier
            ).distinct()
        
        serializer = InventoryItemListSerializer(queryset, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(tags=['Expenses']),
    create=extend_schema(tags=['Expenses']),
    retrieve=extend_schema(tags=['Expenses']),
    update=extend_schema(tags=['Expenses']),
    destroy=extend_schema(tags=['Expenses']),
)
class ExpenseViewSet(viewsets.ModelViewSet):
    """CRUD operations for expenses"""
    serializer_class = ExpenseSerializer
    permission_classes = [IsOwnerOrStaffReadWrite]
    filterset_class = ExpenseFilter
    search_fields = ['description', 'receipt_number']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date', '-created_at']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Expense.objects.select_related('supplier', 'owner').all()
        return Expense.objects.select_related('supplier').filter(owner=self.request.user)


@extend_schema_view(
    list=extend_schema(tags=['Stock Movements']),
    create=extend_schema(tags=['Stock Movements']),
    retrieve=extend_schema(tags=['Stock Movements']),
    update=extend_schema(tags=['Stock Movements']),
    destroy=extend_schema(tags=['Stock Movements']),
)
class StockMovementViewSet(viewsets.ModelViewSet):
    """CRUD operations for stock movements"""
    serializer_class = StockMovementSerializer
    permission_classes = [StockMovementPermission]
    filterset_class = StockMovementFilter
    search_fields = ['note', 'item__name']
    ordering_fields = ['created_at', 'type']
    ordering = ['-created_at']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return StockMovement.objects.select_related(
                'item', 'supplier', 'customer', 'created_by'
            ).all()
        return StockMovement.objects.select_related(
            'item', 'supplier', 'customer', 'created_by'
        ).filter(
            models.Q(item__owner=self.request.user) |
            models.Q(created_by=self.request.user)
        )


@extend_schema_view(
    list=extend_schema(tags=['Sales Orders']),
    create=extend_schema(tags=['Sales Orders']),
    retrieve=extend_schema(tags=['Sales Orders']),
    update=extend_schema(tags=['Sales Orders']),
    destroy=extend_schema(tags=['Sales Orders']),
)
class SalesOrderViewSet(viewsets.ModelViewSet):
    """CRUD operations for sales orders"""
    serializer_class = SalesOrderSerializer
    permission_classes = [SalesOrderPermission]
    filterset_class = SalesOrderFilter
    search_fields = ['order_number', 'customer__name']
    ordering_fields = ['order_date', 'total_gross', 'status']
    ordering = ['-order_date']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return SalesOrder.objects.select_related('customer', 'created_by').prefetch_related('items').all()
        return SalesOrder.objects.select_related('customer').prefetch_related('items').filter(
            created_by=self.request.user
        )
    
    @extend_schema(
        tags=['Sales Orders'],
        summary="Confirm sales order",
        description="Changes order status from DRAFT to CONFIRMED"
    )
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm a sales order"""
        order = self.get_object()
        
        if order.status != 'DRAFT':
            return Response(
                {"error": {"code": "BUSINESS_RULE_VIOLATION", "message": "Only draft orders can be confirmed"}},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        
        order.status = 'CONFIRMED'
        order.save()
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @extend_schema(
        tags=['Sales Orders'],
        summary="Deliver sales order",
        description="Creates stock movements and changes status to DELIVERED"
    )
    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        """Deliver a sales order - creates stock movements and updates status"""
        order = self.get_object()
        
        if order.status != 'CONFIRMED':
            return Response(
                {"error": {"code": "BUSINESS_RULE_VIOLATION", "message": "Only confirmed orders can be delivered"}},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        
        try:
            with transaction.atomic():
                # Check stock availability for all items first
                for order_item in order.items.all():
                    if order_item.qty_base > order_item.item.available_qty:
                        return Response(
                            {"error": {
                                "code": "BUSINESS_RULE_VIOLATION", 
                                "message": f"Insufficient stock for {order_item.item.name}. Available: {order_item.item.available_qty}, Required: {order_item.qty_base}"
                            }},
                            status=status.HTTP_422_UNPROCESSABLE_ENTITY
                        )
                
                # Create stock movements for each item
                for order_item in order.items.all():
                    StockMovement.objects.create(
                        item=order_item.item,
                        type='OUT',
                        qty_base=order_item.qty_base,
                        note=f"Delivery for order {order.order_number}",
                        customer=order.customer,
                        created_by=request.user
                    )
                
                order.status = 'DELIVERED'
                order.save()
        
        except Exception as e:
            return Response(
                {"error": {"code": "BUSINESS_RULE_VIOLATION", "message": str(e)}},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @extend_schema(
        tags=['Sales Orders'],
        summary="Create invoice from order",
        description="Creates an invoice for a delivered order"
    )
    @action(detail=True, methods=['post'])
    def invoice(self, request, pk=None):
        """Create invoice from delivered order"""
        order = self.get_object()
        
        if order.status != 'DELIVERED':
            return Response(
                {"error": {"code": "BUSINESS_RULE_VIOLATION", "message": "Only delivered orders can be invoiced"}},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        
        if hasattr(order, 'invoice'):
            return Response(
                {"error": {"code": "BUSINESS_RULE_VIOLATION", "message": "Order already has an invoice"}},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        
        try:
            with transaction.atomic():
                invoice = Invoice.objects.create(order=order)
                order.status = 'INVOICED'
                order.save()
                
                serializer = InvoiceSerializer(invoice)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response(
                {"error": {"code": "BUSINESS_RULE_VIOLATION", "message": str(e)}},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
    
    @extend_schema(
        tags=['Sales Orders'],
        summary="Download delivery note PDF",
        description="Returns PDF file for the delivery note (Lieferschein)"
    )
    @action(detail=True, methods=['get'], url_path='delivery-note-pdf')
    def delivery_note_pdf(self, request, pk=None):
        """Generate and return PDF for delivery note"""
        from .services import generate_delivery_note_pdf, PDFGenerationError
        
        try:
            order = self.get_object()
            return generate_delivery_note_pdf(order)
        except PDFGenerationError as e:
            return Response(
                {"error": {"code": "PDF_GENERATION_ERROR", "message": str(e)}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            return Response(
                {"error": {"code": "INTERNAL_ERROR", "message": "PDF generation failed"}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema_view(
    list=extend_schema(tags=['Sales Orders']),
    create=extend_schema(tags=['Sales Orders']),
    retrieve=extend_schema(tags=['Sales Orders']),
    update=extend_schema(tags=['Sales Orders']),
    destroy=extend_schema(tags=['Sales Orders']),
)
class SalesOrderItemViewSet(viewsets.ModelViewSet):
    """CRUD operations for sales order items"""
    serializer_class = SalesOrderItemSerializer
    permission_classes = [SalesOrderPermission]
    filterset_fields = ['order', 'item']
    ordering_fields = ['id']
    ordering = ['id']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return SalesOrderItem.objects.select_related('order', 'item').all()
        return SalesOrderItem.objects.select_related('order', 'item').filter(
            order__created_by=self.request.user
        )


@extend_schema_view(
    list=extend_schema(tags=['Invoices']),
    create=extend_schema(tags=['Invoices']),
    retrieve=extend_schema(tags=['Invoices']),
    update=extend_schema(tags=['Invoices']),
    destroy=extend_schema(tags=['Invoices']),
)
class InvoiceViewSet(viewsets.ModelViewSet):
    """CRUD operations for invoices"""
    serializer_class = InvoiceSerializer
    permission_classes = [SalesOrderPermission]
    filterset_fields = ['invoice_number', 'issue_date', 'due_date']
    search_fields = ['invoice_number', 'order__customer__name']
    ordering_fields = ['issue_date', 'due_date', 'total_gross']
    ordering = ['-issue_date']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Invoice.objects.select_related('order__customer').all()
        return Invoice.objects.select_related('order__customer').filter(
            order__created_by=self.request.user
        )
    
    @extend_schema(
        tags=['Invoices'],
        summary="Download invoice PDF",
        description="Returns PDF file for the invoice"
    )
    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Generate and return PDF for invoice"""
        from .services import generate_invoice_pdf, PDFGenerationError
        
        try:
            invoice = self.get_object()
            return generate_invoice_pdf(invoice)
        except PDFGenerationError as e:
            return Response(
                {"error": {"code": "PDF_GENERATION_ERROR", "message": str(e)}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            return Response(
                {"error": {"code": "INTERNAL_ERROR", "message": "PDF generation failed"}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Stock Movement Action Endpoints
@extend_schema(tags=['Stock Movements'])
class StockActionViewSet(viewsets.ViewSet):
    """Stock movement action endpoints"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return InventoryItem.objects.all()
        return InventoryItem.objects.filter(owner=self.request.user)
    
    @extend_schema(
        summary="Stock In",
        description="Add stock to inventory",
        request=StockMovementCreateSerializer
    )
    @action(detail=False, methods=['post'], url_path='in')
    def stock_in(self, request):
        """Stock IN operation"""
        serializer = StockMovementCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.validated_data['type'] = 'IN'
            movement = serializer.save()
            return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
        return Response(
            {"error": {"code": "VALIDATION_ERROR", "message": "Invalid data", "fields": serializer.errors}},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @extend_schema(
        summary="Stock Out",
        description="Remove stock from inventory",
        request=StockMovementCreateSerializer
    )
    @action(detail=False, methods=['post'], url_path='out')
    def stock_out(self, request):
        """Stock OUT operation"""
        serializer = StockMovementCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.validated_data['type'] = 'OUT'
            movement = serializer.save()
            return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
        return Response(
            {"error": {"code": "VALIDATION_ERROR", "message": "Invalid data", "fields": serializer.errors}},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @extend_schema(
        summary="Stock Return",
        description="Return stock to inventory",
        request=StockMovementCreateSerializer
    )
    @action(detail=False, methods=['post'], url_path='return')
    def stock_return(self, request):
        """Stock RETURN operation"""
        serializer = StockMovementCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.validated_data['type'] = 'RETURN'
            movement = serializer.save()
            return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
        return Response(
            {"error": {"code": "VALIDATION_ERROR", "message": "Invalid data", "fields": serializer.errors}},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @extend_schema(
        summary="Mark as Defective",
        description="Mark stock as defective",
        request=StockMovementCreateSerializer
    )
    @action(detail=False, methods=['post'], url_path='defect')
    def stock_defect(self, request):
        """Stock DEFECT operation"""
        serializer = StockMovementCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.validated_data['type'] = 'DEFECT'
            movement = serializer.save()
            return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
        return Response(
            {"error": {"code": "VALIDATION_ERROR", "message": "Invalid data", "fields": serializer.errors}},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @extend_schema(
        summary="Adjust Stock",
        description="Adjust stock quantity (requires reason)",
        request=StockMovementCreateSerializer
    )
    @action(detail=False, methods=['post'], url_path='adjust')
    def stock_adjust(self, request):
        """Stock ADJUST operation"""
        serializer = StockMovementCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            if not serializer.validated_data.get('note'):
                return Response(
                    {"error": {"code": "VALIDATION_ERROR", "message": "ADJUST movements require a reason in the note field"}},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer.validated_data['type'] = 'ADJUST'
            movement = serializer.save()
            return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
        return Response(
            {"error": {"code": "VALIDATION_ERROR", "message": "Invalid data", "fields": serializer.errors}},
            status=status.HTTP_400_BAD_REQUEST
        )


# Read-only ViewSets for additional models
class InventoryLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for inventory logs (legacy compatibility)"""
    serializer_class = InventoryLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['action', 'item', 'user']
    ordering = ['-timestamp']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return InventoryLog.objects.select_related('item', 'user').all()
        return InventoryLog.objects.select_related('item', 'user').filter(
            models.Q(item__owner=self.request.user) | models.Q(user=self.request.user)
        )


class InventoryItemSupplierViewSet(viewsets.ModelViewSet):
    """CRUD operations for item-supplier relationships"""
    serializer_class = InventoryItemSupplierSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['item', 'supplier']
    ordering = ['id']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return InventoryItemSupplier.objects.select_related('item', 'supplier').all()
        return InventoryItemSupplier.objects.select_related('item', 'supplier').filter(
            models.Q(item__owner=self.request.user) | models.Q(supplier__owner=self.request.user)
        )


class DocumentSequenceViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for document sequences (monitoring only)"""
    queryset = DocumentSequence.objects.all()
    serializer_class = DocumentSequenceSerializer
    permission_classes = [permissions.IsAdminUser]
    ordering = ['document_type', 'year']
