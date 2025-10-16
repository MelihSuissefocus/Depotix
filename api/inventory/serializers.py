from rest_framework import serializers
from django.contrib.auth.models import User
from datetime import datetime, date
from .models import (
    Category, Supplier, Customer, InventoryItem,
    Expense, InventoryLog, InventoryItemSupplier,
    StockMovement, SalesOrder, SalesOrderItem, Invoice, DocumentSequence,
    CompanyProfile, InvoiceTemplate
)


class FlexibleDateField(serializers.DateField):
    """Custom date field that accepts both date and datetime objects"""

    def to_representation(self, value):
        if value is None:
            return None
        # Convert datetime to date if needed
        if isinstance(value, datetime):
            value = value.date()
        return super().to_representation(value)


class UserSerializer(serializers.ModelSerializer):
    """User serializer for authentication"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']


class CategorySerializer(serializers.ModelSerializer):
    """Category serializer with full CRUD support"""
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SupplierSerializer(serializers.ModelSerializer):
    """Supplier serializer with owner auto-assignment"""
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'contact_name', 'email', 'phone', 'address',
            'tax_id', 'payment_terms', 'notes', 'owner', 'created_at',
            'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def create(self, validated_data):
        # Auto-assign owner from request user
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)

    def to_representation(self, instance):
        """Always return owner as User object for reads"""
        data = super().to_representation(instance)
        return data


class CustomerSerializer(serializers.ModelSerializer):
    """Customer serializer with owner auto-assignment"""
    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'customer_number', 'contact_name', 'email', 'phone', 'address',
            'shipping_address', 'tax_id', 'credit_limit', 'payment_terms',
            'notes', 'owner', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def validate_customer_number(self, value):
        """Validate customer number uniqueness and format"""
        if not value:
            raise serializers.ValidationError("Kundennummer ist erforderlich")

        # Format validation (also done in model validator, but good to have here too)
        if not value.isdigit() or len(value) != 4:
            raise serializers.ValidationError("Kundennummer muss genau 4 Ziffern haben")

        customer_num = int(value)
        if customer_num < 1000:
            raise serializers.ValidationError("Kundennummer muss mindestens 1000 sein")

        # Uniqueness validation
        customer_queryset = Customer.objects.filter(
            customer_number=value,
            owner=self.context['request'].user
        )

        # If this is an update, exclude the current instance
        if self.instance:
            customer_queryset = customer_queryset.exclude(pk=self.instance.pk)

        if customer_queryset.exists():
            raise serializers.ValidationError("Diese Kundennummer ist bereits vergeben")

        return value

    def create(self, validated_data):
        # Auto-assign owner from request user
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)


class InventoryItemSerializer(serializers.ModelSerializer):
    """Enhanced inventory item serializer with computed fields"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    total_quantity_in_verpackungen = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    total_value = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    # Provide a front-end friendly alias for min_stock_level
    low_stock_threshold = serializers.IntegerField(source='min_stock_level', required=False)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'description', 'sku',
            # Neue Lagerbestände
            'palette_quantity', 'verpackung_quantity', 'defective_qty',
            'price', 'cost', 'min_stock_level', 'low_stock_threshold', 'location', 'unit_base',
            'unit_package_factor', 'unit_pallet_factor', 'category',
            'category_name', 'owner', 'owner_username', 'date_added',
            'last_updated', 'is_active', 'total_quantity_in_verpackungen', 'is_low_stock',
            'total_value',
            # Neue Getränke-spezifische Felder
            'brand', 'beverage_type', 'container_type', 'volume_ml',
            'deposit_chf', 'is_returnable', 'is_alcoholic', 'abv_percent',
            'country_of_origin', 'ean_unit', 'ean_pack', 'vat_rate',
            # Produktstruktur (Umrechnungsfaktoren)
            'verpackungen_pro_palette', 'stueck_pro_verpackung'
        ]
        read_only_fields = [
            'id', 'owner', 'owner_username', 'date_added', 'last_updated',
            'total_quantity_in_verpackungen', 'is_low_stock', 'total_value', 'category_name'
        ]

    def create(self, validated_data):
        # Auto-assign owner from request user
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)

    def validate(self, data):
        """Validate defective quantity doesn't exceed total quantity and beverage-specific rules"""
        from decimal import Decimal

        palette_qty = data.get('palette_quantity', 0)
        verpackung_qty = data.get('verpackung_quantity', 0)
        defective_qty = data.get('defective_qty', 0)

        # Note: defective_qty is tracked in Verpackungen
        # We'll validate in views if needed
        
        # Getränke-spezifische Validierungen
        is_alcoholic = data.get('is_alcoholic', False)
        abv_percent = data.get('abv_percent')
        vat_rate = data.get('vat_rate', Decimal('8.10'))
        
        # Alkoholgehalt prüfen wenn alkoholisch
        if is_alcoholic and abv_percent is None:
            data['abv_percent'] = Decimal('0')
        
        # MwSt.-Rate prüfen (CH-Bereich)
        if vat_rate < 0 or vat_rate > 25:
            raise serializers.ValidationError(
                "MwSt.-Rate muss zwischen 0% und 25% liegen"
            )
        
        return data


class ExpenseSerializer(serializers.ModelSerializer):
    """Expense tracking serializer"""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    receipt_pdf = serializers.FileField(required=False, allow_null=True)
    stock_movement_id = serializers.IntegerField(source='stock_movement.id', read_only=True)
    stock_movement_item_name = serializers.CharField(source='stock_movement.item.name', read_only=True)

    class Meta:
        model = Expense
        fields = [
            'id', 'date', 'description', 'amount', 'category', 'supplier',
            'supplier_name', 'stock_movement', 'stock_movement_id', 'stock_movement_item_name',
            'receipt_number', 'receipt_pdf', 'notes', 'owner',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at', 'supplier_name',
                           'stock_movement_id', 'stock_movement_item_name']

    def create(self, validated_data):
        # Auto-assign owner from request user
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)

    def validate_date(self, value):
        """Ensure expense date is not in the future"""
        from django.utils import timezone
        if value > timezone.now().date():
            raise serializers.ValidationError("Expense date cannot be in the future")
        return value


class InventoryLogSerializer(serializers.ModelSerializer):
    """Legacy inventory log serializer for backward compatibility"""
    item_name = serializers.CharField(source='item.name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = InventoryLog
        fields = [
            'id', 'item', 'item_name', 'user', 'username', 'action',
            'quantity_change', 'previous_quantity', 'new_quantity',
            'timestamp', 'notes'
        ]
        read_only_fields = ['id', 'timestamp', 'item_name', 'username']


class InventoryItemSupplierSerializer(serializers.ModelSerializer):
    """Item-supplier relationship serializer"""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = InventoryItemSupplier
        fields = [
            'id', 'item', 'item_name', 'supplier', 'supplier_name',
            'supplier_sku', 'supplier_price', 'lead_time_days', 'notes'
        ]
        read_only_fields = ['id', 'supplier_name', 'item_name']


# Specialized serializers for specific endpoints
class InventoryItemListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for item lists"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    total_quantity_in_verpackungen = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    # expose low_stock_threshold for list views (read-only)
    low_stock_threshold = serializers.IntegerField(source='min_stock_level', read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'sku', 'palette_quantity', 'verpackung_quantity',
            'total_quantity_in_verpackungen', 'price',
            'category', 'category_name', 'is_low_stock', 'last_updated', 'low_stock_threshold'
        ]


class InventoryLevelSerializer(serializers.ModelSerializer):
    """Serializer for inventory level checks"""
    item_name = serializers.CharField(source='name', read_only=True)
    current_quantity = serializers.IntegerField(source='total_quantity_in_verpackungen', read_only=True)
    low_stock_threshold = serializers.IntegerField(source='min_stock_level', read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'item_id', 'item_name', 'current_quantity',
            'palette_quantity', 'verpackung_quantity',
            'low_stock_threshold', 'is_low_stock', 'last_updated'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['item_id'] = instance.id
        return data


class StockAdjustmentSerializer(serializers.Serializer):
    """Serializer for stock quantity adjustments"""
    quantity_change = serializers.IntegerField()
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate_quantity_change(self, value):
        if value == 0:
            raise serializers.ValidationError("Quantity change cannot be zero")
        return value


# User management serializers
class UserRegistrationSerializer(serializers.ModelSerializer):
    """User registration serializer"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Passwords do not match")
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user


class PasswordChangeSerializer(serializers.Serializer):
    """Password change serializer"""
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError("New passwords do not match")
        return data

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect")
        return value


class StockMovementSerializer(serializers.ModelSerializer):
    """Stock movement serializer with Paletten/Verpackungen support"""
    item_name = serializers.CharField(source='item.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    # Idempotency key for safe retries
    idempotency_key = serializers.CharField(
        max_length=64,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Client-generated UUID for idempotent operations"
    )

    # Optional custom timestamp
    movement_timestamp = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="Optional custom timestamp for when the movement occurred"
    )

    class Meta:
        model = StockMovement
        fields = [
            'id', 'item', 'item_name', 'type', 'unit', 'quantity',
            'purchase_price', 'created_at', 'movement_timestamp', 'note', 'supplier',
            'supplier_name', 'customer', 'customer_name', 'created_by',
            'created_by_username', 'idempotency_key'
        ]
        read_only_fields = [
            'id', 'created_at', 'item_name', 'supplier_name',
            'customer_name', 'created_by_username'
        ]

    def create(self, validated_data):
        # Auto-assign created_by from request user
        validated_data['created_by'] = self.context['request'].user

        # Extract skip_quantity_update from context if present
        # This is passed via serializer.save(skip_quantity_update=True)
        skip_quantity_update = self.context.get('skip_quantity_update', False)

        # Create the movement instance, passing the flag to the model's save()
        instance = self.Meta.model(**validated_data)
        instance.save(skip_quantity_update=skip_quantity_update)

        return instance

    def validate(self, data):
        """Validate stock availability and business rules"""
        item = data.get('item')
        movement_type = data.get('type')
        unit = data.get('unit', 'verpackung')
        quantity = data.get('quantity', 0)

        # Validate stock availability for OUT/DEFECT movements
        if movement_type in ['OUT', 'DEFECT'] and item:
            if unit == 'palette':
                if quantity > item.palette_quantity:
                    raise serializers.ValidationError(
                        f"Cannot {movement_type.lower()} {quantity} Paletten. "
                        f"Only {item.palette_quantity} Paletten available."
                    )
            elif unit == 'verpackung':
                total_verpackungen = item.total_quantity_in_verpackungen
                if quantity > total_verpackungen:
                    raise serializers.ValidationError(
                        f"Cannot {movement_type.lower()} {quantity} Verpackungen. "
                        f"Only {total_verpackungen} Verpackungen available."
                    )

        # RETURN should have customer reference
        if movement_type == 'RETURN' and not data.get('customer'):
            raise serializers.ValidationError(
                "RETURN movements should reference a customer."
            )

        # IN movements should have supplier or note
        if movement_type == 'IN' and not data.get('supplier') and not data.get('note'):
            raise serializers.ValidationError(
                "IN movements should reference a supplier or include a note."
            )

        return data


class SalesOrderItemSerializer(serializers.ModelSerializer):
    """Sales order item serializer with calculated totals"""
    item_name = serializers.CharField(source='item.name', read_only=True)
    line_total_net = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_tax = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_total_gross = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SalesOrderItem
        fields = [
            'id', 'order', 'item', 'item_name', 'qty_base', 'qty_display', 'selected_unit',
            'unit_price', 'tax_rate', 'line_total_net', 'line_tax', 'line_total_gross'
        ]
        read_only_fields = [
            'id', 'item_name', 'line_total_net', 'line_tax', 'line_total_gross'
        ]

    def validate_qty_base(self, value):
        """Ensure positive quantity"""
        if value <= 0:
            raise serializers.ValidationError("Quantity must be positive")
        return value


class SalesOrderSerializer(serializers.ModelSerializer):
    """Sales order serializer with items and totals"""
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    items = SalesOrderItemSerializer(many=True, read_only=True)
    # Allow items to be written during creation
    items_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        help_text="List of items to create with the order"
    )

    class Meta:
        model = SalesOrder
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'status',
            'order_date', 'delivery_date', 'currency', 'total_net',
            'total_tax', 'total_gross', 'created_by', 'created_by_username',
            'items', 'items_data'
        ]
        read_only_fields = [
            'id', 'order_number', 'order_date', 'customer_name',
            'total_net', 'total_tax', 'total_gross', 'created_by_username',
            'items'
        ]

    def create(self, validated_data):
        # Extract items data
        items_data = validated_data.pop('items_data', [])
        
        # Auto-assign created_by from request user
        validated_data['created_by'] = self.context['request'].user
        
        # Create the order
        order = super().create(validated_data)
        
        # Create order items
        for item_data in items_data:
            # Get the InventoryItem instance
            item_id = item_data.pop('item')
            try:
                item_instance = InventoryItem.objects.get(id=item_id)
                item_data['item'] = item_instance
                SalesOrderItem.objects.create(order=order, **item_data)
            except InventoryItem.DoesNotExist:
                raise serializers.ValidationError(f"Item with id {item_id} does not exist")
        
        return order

    def validate_delivery_date(self, value):
        """Validate delivery date - allow past, present, and future dates"""
        # No validation needed - delivery date can be in past, present, or future
        # This allows for retroactive order entry and historical records
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    """Invoice serializer with order and customer details"""
    customer_name = serializers.CharField(source='order.customer.name', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    # Use custom field to handle both datetime and date
    issue_date = FlexibleDateField(required=False, allow_null=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'order', 'order_number', 'customer_name',
            'issue_date', 'delivery_date', 'due_date', 'total_net', 'total_tax', 'total_gross',
            'currency', 'pdf_file', 'is_archived'
        ]
        read_only_fields = [
            'id', 'invoice_number', 'customer_name',
            'order_number', 'total_net', 'total_tax', 'total_gross'
        ]

    def validate_order(self, value):
        """Ensure order doesn't already have an invoice"""
        if hasattr(value, 'invoice'):
            raise serializers.ValidationError("This order already has an invoice")
        return value


class DocumentSequenceSerializer(serializers.ModelSerializer):
    """Document sequence serializer (read-only for monitoring)"""
    
    class Meta:
        model = DocumentSequence
        fields = ['id', 'document_type', 'year', 'last_number']
        read_only_fields = ['id', 'document_type', 'year', 'last_number']


# Specialized serializers for business operations
class StockMovementCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for creating stock movements via API"""

    class Meta:
        model = StockMovement
        fields = ['item', 'type', 'unit', 'quantity', 'note', 'supplier', 'customer']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class OrderToInvoiceSerializer(serializers.Serializer):
    """Serializer for converting order to invoice"""
    order_id = serializers.IntegerField()
    due_date = serializers.DateField(required=False)
    
    def validate_order_id(self, value):
        try:
            order = SalesOrder.objects.get(id=value)
        except SalesOrder.DoesNotExist:
            raise serializers.ValidationError("Order not found")
        
        if order.status != 'DELIVERED':
            raise serializers.ValidationError("Only delivered orders can be invoiced")
        
        if hasattr(order, 'invoice'):
            raise serializers.ValidationError("Order already has an invoice")
        
        return value


class CompanyProfileSerializer(serializers.ModelSerializer):
    """Company profile serializer"""

    def to_representation(self, instance):
        """Override to provide full URL for logo field"""
        data = super().to_representation(instance)
        if instance.logo:
            request = self.context.get('request')
            if request:
                data['logo'] = request.build_absolute_uri(instance.logo.url)
            else:
                # Fallback for when no request context is available
                data['logo'] = f"https://depotix.ch/api/media/{instance.logo.name}"
        return data

    class Meta:
        model = CompanyProfile
        fields = [
            'id', 'user', 'name', 'street', 'postal_code', 'city', 'country',
            'email', 'phone', 'iban', 'bank_name', 'mwst_number', 'currency',
            'logo', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class InvoiceTemplateSerializer(serializers.ModelSerializer):
    """Invoice template serializer"""

    class Meta:
        model = InvoiceTemplate
        fields = [
            'id', 'user', 'html_content', 'css_content', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
