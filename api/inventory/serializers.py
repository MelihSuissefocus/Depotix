from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Category, Supplier, Customer, InventoryItem, 
    Expense, InventoryLog, InventoryItemSupplier
)


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


class CustomerSerializer(serializers.ModelSerializer):
    """Customer serializer with owner auto-assignment"""
    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'contact_name', 'email', 'phone', 'address',
            'shipping_address', 'tax_id', 'credit_limit', 'payment_terms', 
            'notes', 'owner', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def create(self, validated_data):
        # Auto-assign owner from request user
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)


class InventoryItemSerializer(serializers.ModelSerializer):
    """Enhanced inventory item serializer with computed fields"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    available_qty = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    total_value = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'description', 'sku', 'quantity', 'defective_qty',
            'price', 'cost', 'min_stock_level', 'location', 'unit_base',
            'unit_package_factor', 'unit_pallet_factor', 'category', 
            'category_name', 'owner', 'owner_username', 'date_added', 
            'last_updated', 'is_active', 'available_qty', 'is_low_stock', 
            'total_value'
        ]
        read_only_fields = [
            'id', 'owner', 'owner_username', 'date_added', 'last_updated',
            'available_qty', 'is_low_stock', 'total_value', 'category_name'
        ]

    def create(self, validated_data):
        # Auto-assign owner from request user
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)

    def validate(self, data):
        """Validate defective quantity doesn't exceed total quantity"""
        quantity = data.get('quantity', 0)
        defective_qty = data.get('defective_qty', 0)
        
        if defective_qty > quantity:
            raise serializers.ValidationError(
                "Defective quantity cannot exceed total quantity"
            )
        
        return data


class ExpenseSerializer(serializers.ModelSerializer):
    """Expense tracking serializer"""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Expense
        fields = [
            'id', 'date', 'description', 'amount', 'category', 'supplier',
            'supplier_name', 'receipt_number', 'notes', 'owner', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at', 'supplier_name']

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
    available_qty = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'sku', 'quantity', 'available_qty', 'price',
            'category', 'category_name', 'is_low_stock', 'last_updated'
        ]


class InventoryLevelSerializer(serializers.ModelSerializer):
    """Serializer for inventory level checks"""
    item_name = serializers.CharField(source='name', read_only=True)
    current_quantity = serializers.IntegerField(source='available_qty', read_only=True)
    low_stock_threshold = serializers.IntegerField(source='min_stock_level', read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'item_id', 'item_name', 'current_quantity', 
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
