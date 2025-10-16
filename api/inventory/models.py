from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal

def validate_customer_number(value):
    """Custom validator for customer number"""
    if not value.isdigit() or len(value) != 4:
        raise ValidationError('Kundennummer muss genau 4 Ziffern haben.')

    customer_num = int(value)
    if customer_num < 1000:
        raise ValidationError('Kundennummer muss mindestens 1000 sein.')


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
    customer_number = models.CharField(
        max_length=4,
        unique=True,
        null=True,
        blank=True,
        help_text="4-stellige Kundennummer (ab 1000)",
        validators=[validate_customer_number]
    )
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

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

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
    
    # Getränke-spezifische Konstanten
    BRAND_MAXLEN = 120
    COUNTRY_MAXLEN = 2  # ISO-3166-1 alpha-2 (z.B. 'CH','DE')
    EAN_MAXLEN = 14
    
    BEVERAGE_TYPE_CHOICES = [
        ("water", "Wasser"),
        ("softdrink", "Softdrink"),
        ("beer", "Bier"),
        ("wine", "Wein"),
        ("spirits", "Spirituose"),
        ("energy", "Energy Drink"),
        ("juice", "Saft"),
        ("other", "Sonstiges"),
    ]
    
    CONTAINER_TYPE_CHOICES = [
        ("glass", "Glasflasche"),
        ("pet", "PET"),
        ("can", "Dose"),
        ("crate", "Kiste/Tray"),
        ("keg", "Fass/Keg"),
    ]
    
    # Bestehende Felder
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    sku = models.CharField(max_length=100, unique=True, blank=True, null=True)

    # Lagerbestände
    palette_quantity = models.IntegerField(default=0, validators=[MinValueValidator(0)], help_text="Anzahl Paletten auf Lager")
    verpackung_quantity = models.IntegerField(default=0, validators=[MinValueValidator(0)], help_text="Anzahl Verpackungen auf Lager")
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
    
    # Neue Getränke-spezifische Felder
    brand = models.CharField(max_length=BRAND_MAXLEN, blank=True, null=True)
    beverage_type = models.CharField(max_length=20, choices=BEVERAGE_TYPE_CHOICES, blank=True, null=True)
    container_type = models.CharField(max_length=12, choices=CONTAINER_TYPE_CHOICES, blank=True, null=True)
    
    volume_ml = models.PositiveIntegerField(blank=True, null=True, help_text="Füllmenge je Einheit in ml")
    deposit_chf = models.DecimalField(max_digits=6, decimal_places=2, default=0, help_text="Pfand in CHF")
    is_returnable = models.BooleanField(default=False, help_text="Mehrweg/Rücknahme")
    
    is_alcoholic = models.BooleanField(default=False)
    abv_percent = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, help_text="Alkoholgehalt % vol")
    
    country_of_origin = models.CharField(max_length=COUNTRY_MAXLEN, blank=True, null=True, help_text="ISO-2 Landescode, z. B. CH")
    ean_unit = models.CharField(max_length=EAN_MAXLEN, blank=True, null=True)
    ean_pack = models.CharField(max_length=EAN_MAXLEN, blank=True, null=True)
    
    vat_rate = models.DecimalField(max_digits=4, decimal_places=2, default=8.10, help_text="MwSt. %")

    # Produktstruktur (Umrechnungsfaktoren)
    verpackungen_pro_palette = models.IntegerField(default=1, validators=[MinValueValidator(1)], help_text="Wie viele Verpackungen hat eine Palette")
    stueck_pro_verpackung = models.IntegerField(default=1, validators=[MinValueValidator(1)], help_text="Wie viele Stück hat eine Verpackung (nur Info)")

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
            models.Index(fields=['min_stock_level', 'palette_quantity']),
        ]

    @property
    def total_quantity_in_verpackungen(self):
        """Calculate total stock in Verpackungen (Paletten * verpackungen_pro_palette + verpackung_quantity)"""
        return (self.palette_quantity * self.verpackungen_pro_palette) + self.verpackung_quantity

    @property
    def is_low_stock(self):
        """Check if item is below minimum stock level (converted to Verpackungen)"""
        return self.total_quantity_in_verpackungen <= self.min_stock_level

    @property
    def total_value(self):
        """Total value of available stock (in Verpackungen)"""
        return self.total_quantity_in_verpackungen * self.price

    @property
    def category_name(self):
        """Category name for API compatibility"""
        return self.category.name if self.category else None

    @property
    def owner_username(self):
        """Owner username for API compatibility"""
        return self.owner.username if self.owner else None

    def save(self, *args, **kwargs):
        """Override save to convert empty SKU to NULL"""
        if self.sku == '':
            self.sku = None
        super().save(*args, **kwargs)

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
    stock_movement = models.ForeignKey(
        'StockMovement',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='expense',
        verbose_name="Warenbewegung",
        help_text="Verknüpfte Warenbewegung (automatisch erstellt bei Wareneingang)"
    )
    receipt_number = models.CharField(max_length=100, blank=True, null=True)
    receipt_pdf = models.FileField(upload_to='expense_receipts/', blank=True, null=True)
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


class StockMovement(models.Model):
    """Enhanced stock movement tracking with Paletten/Verpackungen support"""

    MOVEMENT_TYPE_CHOICES = [
        ('IN', 'Stock In'),
        ('OUT', 'Stock Out'),
        ('RETURN', 'Return'),
        ('DEFECT', 'Defective'),
        ('ADJUST', 'Adjustment'),
    ]

    UNIT_CHOICES = [
        ('palette', 'Palette'),
        ('verpackung', 'Verpackung'),
    ]

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='stock_movements')
    type = models.CharField(max_length=20, choices=MOVEMENT_TYPE_CHOICES)

    # Neue Struktur: Einheit + Menge
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='verpackung', help_text="Einheit der Bewegung")
    quantity = models.IntegerField(default=0, help_text="Menge in der gewählten Einheit")

    # Einkaufspreis für Wareneingänge
    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Einkaufspreis",
        help_text="Einkaufspreis für diesen Wareneingang (nur bei type=IN)",
        validators=[MinValueValidator(Decimal('0.00'))]
    )

    # Idempotency for safe retries
    idempotency_key = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text="UUID for idempotent operations - prevents duplicate submissions",
        db_index=True,
    )

    # Tracking and relationships
    created_at = models.DateTimeField(auto_now_add=True)
    movement_timestamp = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Optional custom timestamp for when the movement occurred. If not set, created_at is used."
    )
    note = models.TextField(blank=True, help_text="Movement notes or reason")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='stock_movements')
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='stock_movements')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='created_movements')
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['item', 'created_at']),
            models.Index(fields=['type', 'created_at']),
            models.Index(fields=['created_by', 'created_at']),
            models.Index(fields=['item', 'type', 'created_at']),
        ]

    def clean(self):
        """Validate stock availability and business rules"""
        from django.core.exceptions import ValidationError

        # Validate stock availability for OUT/DEFECT movements
        if self.type in ['OUT', 'DEFECT']:
            if self.unit == 'palette':
                if self.quantity > self.item.palette_quantity:
                    raise ValidationError(
                        f"Cannot {self.type.lower()} {self.quantity} Paletten. "
                        f"Only {self.item.palette_quantity} Paletten available."
                    )
            elif self.unit == 'verpackung':
                total_verpackungen = self.item.total_quantity_in_verpackungen
                if self.quantity > total_verpackungen:
                    raise ValidationError(
                        f"Cannot {self.type.lower()} {self.quantity} Verpackungen. "
                        f"Only {total_verpackungen} Verpackungen available."
                    )

        # RETURN should have customer reference
        if self.type == 'RETURN' and not self.customer:
            raise ValidationError("RETURN movements should reference a customer.")

        # IN movements typically have supplier reference
        if self.type == 'IN' and not self.supplier and not self.note:
            raise ValidationError("IN movements should reference a supplier or include a note.")

    def save(self, *args, **kwargs):
        # Note: Validation is handled by the serializer, not here
        # self.clean() is intentionally not called to avoid ValidationErrors during save

        # Check if quantity update should be skipped (when ViewSet already handled it)
        skip_quantity_update = kwargs.pop('skip_quantity_update', False)

        # IMPORTANT: Reload item from database to get the latest conversion factors
        # This ensures we always use the current verpackungen_pro_palette value
        self.item.refresh_from_db()

        # Store previous quantities for logging
        previous_palette_qty = self.item.palette_quantity
        previous_verpackung_qty = self.item.verpackung_quantity

        # Save the movement first
        super().save(*args, **kwargs)

        # Prepare for logging
        log_action = 'UPDATE'
        log_unit = self.unit
        log_quantity_change = self.quantity

        if not skip_quantity_update:
            # Get conversion factor
            vpk = self.item.verpackungen_pro_palette

            # Helper function to normalize inventory (consolidate packages into palettes)
            def normalize_inventory(palette_qty, verpackung_qty, verpackungen_pro_palette):
                """
                Consolidate loose packages into full palettes.
                Returns (palette_quantity, verpackung_quantity)
                """
                # Calculate total packages
                total_verpackungen = (palette_qty * verpackungen_pro_palette) + verpackung_qty

                # Split into full palettes and remaining packages
                new_palette_qty = total_verpackungen // verpackungen_pro_palette
                new_verpackung_qty = total_verpackungen % verpackungen_pro_palette

                return new_palette_qty, new_verpackung_qty

            # Update item quantities based on movement type and unit
            if self.type == 'IN':
                log_action = 'ADD'
                if self.unit == 'palette':
                    # Adding palettes is straightforward
                    self.item.palette_quantity += self.quantity
                elif self.unit == 'verpackung':
                    # Add packages and consolidate into palettes if possible
                    self.item.verpackung_quantity += self.quantity
                    self.item.palette_quantity, self.item.verpackung_quantity = normalize_inventory(
                        self.item.palette_quantity,
                        self.item.verpackung_quantity,
                        vpk
                    )

            elif self.type == 'OUT':
                log_action = 'REMOVE'
                if self.unit == 'palette':
                    # Remove palettes (cannot go below 0)
                    self.item.palette_quantity = max(0, self.item.palette_quantity - self.quantity)
                elif self.unit == 'verpackung':
                    # Calculate total available packages
                    total_verpackungen = (self.item.palette_quantity * vpk) + self.item.verpackung_quantity

                    # Subtract requested packages
                    remaining_verpackungen = max(0, total_verpackungen - self.quantity)

                    # Recalculate palettes and packages
                    self.item.palette_quantity = remaining_verpackungen // vpk
                    self.item.verpackung_quantity = remaining_verpackungen % vpk

            elif self.type == 'RETURN':
                log_action = 'ADD'
                if self.unit == 'palette':
                    # Returning palettes is straightforward
                    self.item.palette_quantity += self.quantity
                elif self.unit == 'verpackung':
                    # Return packages and consolidate into palettes if possible
                    self.item.verpackung_quantity += self.quantity
                    self.item.palette_quantity, self.item.verpackung_quantity = normalize_inventory(
                        self.item.palette_quantity,
                        self.item.verpackung_quantity,
                        vpk
                    )

            elif self.type == 'DEFECT':
                log_action = 'REMOVE'
                if self.unit == 'palette':
                    # Mark palettes as defective
                    transfer_qty = min(self.quantity, self.item.palette_quantity)
                    self.item.palette_quantity -= transfer_qty
                    self.item.defective_qty += transfer_qty * vpk
                elif self.unit == 'verpackung':
                    # Mark packages as defective (may need to break palettes)
                    total_verpackungen = (self.item.palette_quantity * vpk) + self.item.verpackung_quantity
                    transfer_qty = min(self.quantity, total_verpackungen)

                    remaining_verpackungen = total_verpackungen - transfer_qty

                    # Recalculate inventory
                    self.item.palette_quantity = remaining_verpackungen // vpk
                    self.item.verpackung_quantity = remaining_verpackungen % vpk
                    self.item.defective_qty += transfer_qty

            elif self.type == 'ADJUST':
                log_action = 'UPDATE'
                if self.unit == 'palette':
                    # Direct palette adjustment
                    self.item.palette_quantity = max(0, self.quantity)
                    # Keep existing loose packages
                elif self.unit == 'verpackung':
                    # Direct package adjustment
                    self.item.verpackung_quantity = max(0, self.quantity)
                    # Keep existing palettes

            self.item.save()

        # Always create InventoryLog entry for backward compatibility
        new_palette_qty = self.item.palette_quantity
        new_verpackung_qty = self.item.verpackung_quantity

        InventoryLog.objects.create(
            item=self.item,
            user=self.created_by,
            action=log_action,
            quantity_change=abs(log_quantity_change),
            previous_quantity=previous_palette_qty + previous_verpackung_qty,  # Simplified for legacy
            new_quantity=new_palette_qty + new_verpackung_qty,  # Simplified for legacy
            notes=f"{self.get_type_display()} ({log_quantity_change} {log_unit}): {self.note}" if self.note else f"{self.get_type_display()} ({log_quantity_change} {log_unit})"
        )

    def __str__(self):
        return f"{self.type} - {self.item.name} - {self.quantity} {self.unit}"


class SalesOrder(models.Model):
    """Sales order management with status tracking"""
    
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('CONFIRMED', 'Confirmed'),
        ('DELIVERED', 'Delivered'),
        ('INVOICED', 'Invoiced'),
    ]
    
    order_number = models.CharField(max_length=20, unique=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    order_date = models.DateTimeField(auto_now_add=True)
    delivery_date = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=3, default='CHF')
    
    # Financial totals
    total_net = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='created_orders')

    class Meta:
        ordering = ['-order_date']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['customer', 'order_date']),
            models.Index(fields=['status', 'order_date']),
        ]

    def save(self, *args, **kwargs):
        if not self.order_number:
            # Generate order number: LS-YYYY-####
            year = timezone.now().year
            last_order = SalesOrder.objects.filter(
                order_number__startswith=f'LS-{year}-'
            ).order_by('order_number').last()
            
            if last_order:
                last_num = int(last_order.order_number.split('-')[-1])
                new_num = last_num + 1
            else:
                new_num = 1
            
            self.order_number = f'LS-{year}-{new_num:04d}'
        
        super().save(*args, **kwargs)

    def calculate_totals(self):
        """Recalculate order totals from line items"""
        total_net = sum(item.line_total_net for item in self.items.all())
        total_tax = sum(item.line_tax for item in self.items.all())
        
        self.total_net = total_net
        self.total_tax = total_tax
        self.total_gross = total_net + total_tax
        self.save()

    def __str__(self):
        return f"{self.order_number} - {self.customer.name}"


class SalesOrderItem(models.Model):
    """Sales order line items with tax calculations"""

    UNIT_CHOICES = [
        ('palette', 'Palette'),
        ('verpackung', 'Verpackung'),
    ]

    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='order_items')
    qty_base = models.PositiveIntegerField(help_text="Quantity in base units (Verpackungen)")
    qty_display = models.PositiveIntegerField(default=1, help_text="Display quantity (in selected unit)")
    selected_unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='verpackung',
                                     help_text="Unit selected for display on invoice")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2,
                                    help_text="Price per base unit")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'),
                                  help_text="Tax rate as percentage (e.g., 7.7 for 7.7%)")

    class Meta:
        indexes = [
            models.Index(fields=['order']),
            models.Index(fields=['item']),
        ]

    @property
    def line_total_net(self):
        """Net line total without tax"""
        return self.qty_base * self.unit_price

    @property
    def line_tax(self):
        """Tax amount for this line"""
        return self.line_total_net * (self.tax_rate / 100)

    @property
    def line_total_gross(self):
        """Gross line total including tax"""
        return self.line_total_net + self.line_tax

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Trigger order total recalculation
        self.order.calculate_totals()

    def __str__(self):
        return f"{self.order.order_number} - {self.item.name} ({self.qty_base} units)"


class Invoice(models.Model):
    """Invoice generation from sales orders"""

    invoice_number = models.CharField(max_length=20, unique=True, blank=True)
    order = models.OneToOneField(SalesOrder, on_delete=models.CASCADE, related_name='invoice')
    issue_date = models.DateField(null=True, blank=True, help_text="Dokument Datum")
    delivery_date = models.DateField(null=True, blank=True, help_text="Lieferdatum")
    due_date = models.DateField(null=True, blank=True, help_text="Fälligkeitsdatum")
    
    # Financial amounts (copied from order)
    total_net = models.DecimalField(max_digits=12, decimal_places=2)
    total_tax = models.DecimalField(max_digits=12, decimal_places=2)
    total_gross = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='CHF')
    
    # Optional PDF file path
    pdf_file = models.TextField(blank=True, help_text="Path to generated PDF file")

    # Archive status
    is_archived = models.BooleanField(default=False, help_text="Whether this invoice is archived")

    class Meta:
        ordering = ['-issue_date']
        indexes = [
            models.Index(fields=['invoice_number']),
            models.Index(fields=['issue_date']),
            models.Index(fields=['due_date']),
            models.Index(fields=['is_archived']),
        ]

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            # Generate invoice number: RE######
            last_invoice = Invoice.objects.filter(
                invoice_number__startswith='RE'
            ).order_by('invoice_number').last()

            if last_invoice:
                last_num = int(last_invoice.invoice_number[2:])
                new_num = last_num + 1
            else:
                new_num = 1

            self.invoice_number = f'RE{new_num:06d}'
        
        # Copy totals from order if not set
        if not self.total_net:
            self.total_net = self.order.total_net
            self.total_tax = self.order.total_tax
            self.total_gross = self.order.total_gross
            self.currency = self.order.currency
        
        # Set due date if not set (30 days from issue)
        if not self.due_date:
            from datetime import timedelta
            self.due_date = timezone.now().date() + timedelta(days=30)
        
        super().save(*args, **kwargs)

    @property
    def customer(self):
        """Access customer through order"""
        return self.order.customer

    def __str__(self):
        return f"{self.invoice_number} - {self.order.customer.name}"


# TODO: DocumentSequence for atomic number generation
class DocumentSequence(models.Model):
    """Atomic document number sequence generation"""
    
    document_type = models.CharField(max_length=10, unique=True,
                                    choices=[('LS', 'Sales Order'), ('INV', 'Invoice')])
    year = models.IntegerField()
    last_number = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ['document_type', 'year']
    
    def __str__(self):
        return f"{self.document_type}-{self.year} (last: {self.last_number})"


class CompanyProfile(models.Model):
    """Company profile for supplier firm data"""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='company_profile')
    name = models.CharField(max_length=200)
    street = models.CharField(max_length=200)
    postal_code = models.CharField(max_length=20)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=2, default='CH')
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    iban = models.CharField(max_length=34, blank=True, null=True)
    bank_name = models.CharField(max_length=200, blank=True, null=True)
    mwst_number = models.CharField(max_length=50, blank=True, null=True)
    currency = models.CharField(max_length=3, default='CHF')
    logo = models.ImageField(upload_to='company_logos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return self.name


class InvoiceTemplate(models.Model):
    """Custom invoice template for PDF generation"""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='invoice_template')
    html_content = models.TextField(help_text="HTML template für Rechnung")
    css_content = models.TextField(help_text="CSS Styles für Rechnung")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"Invoice Template for {self.user.username}"