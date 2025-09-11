from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal


class Category(models.Model):
    """Product categories for inventory items"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.name


class Supplier(models.Model):
    """Vendors and suppliers"""
    name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=200, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    tax_id = models.CharField(max_length=50, blank=True, null=True)
    payment_terms = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='suppliers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name', 'owner']),
            models.Index(fields=['owner']),
        ]

    def __str__(self):
        return self.name


class Customer(models.Model):
    """Customer management"""
    name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=200, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    shipping_address = models.TextField(blank=True, null=True)
    tax_id = models.CharField(max_length=50, blank=True, null=True)
    credit_limit = models.DecimalField(
        max_digits=10, decimal_places=2, 
        blank=True, null=True,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    payment_terms = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='customers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name', 'owner']),
            models.Index(fields=['owner']),
        ]

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    """Enhanced inventory items with multi-unit support"""
    
    UNIT_CHOICES = [
        ('PIECE', 'Piece'),
        ('PACKAGE', 'Package'),
        ('PALLET', 'Pallet'),
        ('KG', 'Kilogram'),
        ('LITER', 'Liter'),
        ('METER', 'Meter'),
    ]
    
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    sku = models.CharField(max_length=100, unique=True, blank=True, null=True)
    quantity = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    defective_qty = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    price = models.DecimalField(
        max_digits=10, decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    cost = models.DecimalField(
        max_digits=10, decimal_places=2, 
        blank=True, null=True,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    min_stock_level = models.IntegerField(
        default=0, 
        validators=[MinValueValidator(0), MaxValueValidator(10000)]
    )
    location = models.CharField(max_length=100, blank=True, null=True)
    unit_base = models.CharField(max_length=20, choices=UNIT_CHOICES, default='PIECE')
    unit_package_factor = models.IntegerField(
        default=1, 
        validators=[MinValueValidator(1)]
    )
    unit_pallet_factor = models.IntegerField(
        default=1, 
        validators=[MinValueValidator(1)]
    )
    category = models.ForeignKey(
        Category, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='items'
    )
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='inventory_items')
    date_added = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['name', 'owner']),
            models.Index(fields=['category']),
            models.Index(fields=['min_stock_level', 'quantity']),
        ]

    @property
    def available_qty(self):
        """Available quantity (total - defective)"""
        return self.quantity - self.defective_qty

    @property
    def is_low_stock(self):
        """Check if item is below minimum stock level"""
        return self.available_qty <= self.min_stock_level

    @property
    def total_value(self):
        """Total value of available stock"""
        return self.available_qty * self.price

    @property
    def category_name(self):
        """Category name for API compatibility"""
        return self.category.name if self.category else None

    @property
    def owner_username(self):
        """Owner username for API compatibility"""
        return self.owner.username if self.owner else None

    def __str__(self):
        return f"{self.name} ({self.sku or 'No SKU'})"


class Expense(models.Model):
    """Financial expense tracking"""
    
    CATEGORY_CHOICES = [
        ('PURCHASE', 'Purchase'),
        ('TRANSPORT', 'Transport'),
        ('UTILITIES', 'Utilities'),
        ('MAINTENANCE', 'Maintenance'),
        ('OFFICE', 'Office'),
        ('MARKETING', 'Marketing'),
        ('OTHER', 'Other'),
    ]
    
    date = models.DateField()
    description = models.CharField(max_length=500)
    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    supplier = models.ForeignKey(
        Supplier, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='expenses'
    )
    receipt_number = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expenses')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['date', 'owner']),
            models.Index(fields=['category', 'owner']),
            models.Index(fields=['supplier']),
        ]

    def __str__(self):
        return f"{self.description} - {self.amount}"


# Legacy compatibility model
class InventoryLog(models.Model):
    """Legacy inventory log model for backward compatibility"""
    
    ACTION_CHOICES = [
        ('ADD', 'Add'),
        ('REMOVE', 'Remove'),
        ('UPDATE', 'Update'),
    ]
    
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    quantity_change = models.IntegerField()
    previous_quantity = models.IntegerField()
    new_quantity = models.IntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    @property
    def item_name(self):
        return self.item.name if self.item else None

    @property
    def username(self):
        return self.user.username if self.user else None

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} - {self.item.name if self.item else 'Unknown'}"


class InventoryItemSupplier(models.Model):
    """Many-to-many relationship between items and suppliers"""
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    supplier_sku = models.CharField(max_length=100, blank=True, null=True)
    supplier_price = models.DecimalField(max_digits=10, decimal_places=2)
    lead_time_days = models.IntegerField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    @property
    def supplier_name(self):
        return self.supplier.name if self.supplier else None

    class Meta:
        unique_together = ['item', 'supplier']

    def __str__(self):
        return f"{self.item.name} - {self.supplier.name}"