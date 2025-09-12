from django.contrib import admin
from .models import (
    Category, Supplier, Customer, InventoryItem, 
    Expense, InventoryLog, InventoryItemSupplier,
    StockMovement, SalesOrder, SalesOrderItem, Invoice, DocumentSequence,
    CompanyProfile
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'created_at', 'updated_at']
    search_fields = ['name', 'description']
    ordering = ['name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ['name', 'contact_name', 'email', 'phone', 'owner', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at', 'owner']
    search_fields = ['name', 'contact_name', 'email', 'tax_id']
    ordering = ['name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'is_active', 'owner')
        }),
        ('Contact Details', {
            'fields': ('contact_name', 'email', 'phone', 'address')
        }),
        ('Business Information', {
            'fields': ('tax_id', 'payment_terms', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'contact_name', 'email', 'phone', 'credit_limit', 'owner', 'is_active']
    list_filter = ['is_active', 'created_at', 'owner']
    search_fields = ['name', 'contact_name', 'email', 'tax_id']
    ordering = ['name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'is_active', 'owner')
        }),
        ('Contact Details', {
            'fields': ('contact_name', 'email', 'phone', 'address', 'shipping_address')
        }),
        ('Business Information', {
            'fields': ('tax_id', 'credit_limit', 'payment_terms', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'sku', 'brand', 'beverage_type', 'container_type', 
        'volume_ml', 'quantity', 'defective_qty', 'available_qty', 
        'price', 'category', 'is_low_stock', 'owner', 'is_active'
    ]
    list_filter = [
        'is_active', 'category', 'unit_base', 'beverage_type', 
        'container_type', 'is_alcoholic', 'is_returnable', 'owner', 'date_added'
    ]
    search_fields = ['name', 'sku', 'description', 'brand', 'ean_unit', 'ean_pack']
    ordering = ['name']
    readonly_fields = [
        'date_added', 'last_updated', 'available_qty', 'is_low_stock', 
        'total_value', 'category_name', 'owner_username'
    ]
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'sku', 'category', 'is_active', 'owner')
        }),
        ('Produkt', {
            'fields': ('brand', 'beverage_type', 'container_type', 'volume_ml')
        }),
        ('Kennzeichnung', {
            'fields': ('ean_unit', 'ean_pack', 'country_of_origin')
        }),
        ('Inventory Details', {
            'fields': ('quantity', 'defective_qty', 'available_qty', 'min_stock_level', 'location')
        }),
        ('Pricing', {
            'fields': ('price', 'cost', 'total_value')
        }),
        ('Steuern & Pfand', {
            'fields': ('vat_rate', 'deposit_chf', 'is_returnable')
        }),
        ('Alkohol', {
            'fields': ('is_alcoholic', 'abv_percent')
        }),
        ('Unit Configuration', {
            'fields': ('unit_base', 'unit_package_factor', 'unit_pallet_factor')
        }),
        ('Status', {
            'fields': ('is_low_stock',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('date_added', 'last_updated'),
            'classes': ('collapse',)
        }),
    )
    
    def available_qty(self, obj):
        return obj.available_qty
    available_qty.short_description = 'Available Qty'
    
    def is_low_stock(self, obj):
        return obj.is_low_stock
    is_low_stock.boolean = True
    is_low_stock.short_description = 'Low Stock'


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ['date', 'description', 'amount', 'category', 'supplier', 'owner']
    list_filter = ['category', 'date', 'supplier', 'owner']
    search_fields = ['description', 'receipt_number', 'notes']
    ordering = ['-date', '-created_at']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'date'
    fieldsets = (
        ('Expense Details', {
            'fields': ('date', 'description', 'amount', 'category', 'owner')
        }),
        ('Related Information', {
            'fields': ('supplier', 'receipt_number', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(InventoryLog)
class InventoryLogAdmin(admin.ModelAdmin):
    list_display = [
        'timestamp', 'item', 'action', 'quantity_change', 
        'previous_quantity', 'new_quantity', 'user'
    ]
    list_filter = ['action', 'timestamp', 'user']
    search_fields = ['item__name', 'item__sku', 'notes']
    ordering = ['-timestamp']
    readonly_fields = ['timestamp', 'item_name', 'username']
    
    def has_add_permission(self, request):
        # Inventory logs should be created automatically, not manually
        return False
    
    def has_change_permission(self, request, obj=None):
        # Inventory logs should not be edited
        return False


@admin.register(InventoryItemSupplier)
class InventoryItemSupplierAdmin(admin.ModelAdmin):
    list_display = ['item', 'supplier', 'supplier_sku', 'supplier_price', 'lead_time_days']
    list_filter = ['supplier', 'lead_time_days']
    search_fields = ['item__name', 'supplier__name', 'supplier_sku']
    ordering = ['item__name', 'supplier__name']
    readonly_fields = ['supplier_name']
    
    fieldsets = (
        ('Relationship', {
            'fields': ('item', 'supplier', 'supplier_name')
        }),
        ('Supplier Details', {
            'fields': ('supplier_sku', 'supplier_price', 'lead_time_days')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
    )


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = [
        'created_at', 'type', 'item', 'qty_base', 'qty_pallets', 
        'qty_packages', 'qty_singles', 'supplier', 'customer', 'created_by'
    ]
    list_filter = ['type', 'created_at', 'supplier', 'customer', 'created_by']
    search_fields = ['item__name', 'item__sku', 'note', 'supplier__name', 'customer__name']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
    raw_id_fields = ['item', 'supplier', 'customer', 'created_by']
    
    fieldsets = (
        ('Movement Details', {
            'fields': ('item', 'type', 'qty_base', 'note')
        }),
        ('UoM Input Helpers', {
            'fields': ('qty_pallets', 'qty_packages', 'qty_singles'),
            'classes': ('collapse',)
        }),
        ('Relationships', {
            'fields': ('supplier', 'customer', 'created_by')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


class SalesOrderItemInline(admin.TabularInline):
    model = SalesOrderItem
    extra = 1
    raw_id_fields = ['item']
    readonly_fields = ['line_total_net', 'line_tax', 'line_total_gross']


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = [
        'order_number', 'customer', 'status', 'order_date', 
        'total_gross', 'currency', 'created_by'
    ]
    list_filter = ['status', 'order_date', 'currency', 'created_by']
    search_fields = ['order_number', 'customer__name']
    ordering = ['-order_date']
    readonly_fields = ['order_number', 'order_date', 'total_net', 'total_tax', 'total_gross']
    raw_id_fields = ['customer', 'created_by']
    inlines = [SalesOrderItemInline]
    
    fieldsets = (
        ('Order Information', {
            'fields': ('order_number', 'customer', 'status', 'created_by')
        }),
        ('Dates', {
            'fields': ('order_date', 'delivery_date')
        }),
        ('Financial Summary', {
            'fields': ('currency', 'total_net', 'total_tax', 'total_gross'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:  # New object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(SalesOrderItem)
class SalesOrderItemAdmin(admin.ModelAdmin):
    list_display = [
        'order', 'item', 'qty_base', 'unit_price', 'tax_rate', 
        'line_total_net', 'line_tax', 'line_total_gross'
    ]
    list_filter = ['order__status', 'tax_rate']
    search_fields = ['order__order_number', 'item__name', 'item__sku']
    ordering = ['order__order_date', 'order', 'item__name']
    readonly_fields = ['line_total_net', 'line_tax', 'line_total_gross']
    raw_id_fields = ['order', 'item']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = [
        'invoice_number', 'customer', 'issue_date', 'due_date', 
        'total_gross', 'currency'
    ]
    list_filter = ['issue_date', 'due_date', 'currency']
    search_fields = ['invoice_number', 'order__customer__name', 'order__order_number']
    ordering = ['-issue_date']
    readonly_fields = [
        'invoice_number', 'issue_date', 'customer', 'total_net', 
        'total_tax', 'total_gross'
    ]
    raw_id_fields = ['order']
    
    fieldsets = (
        ('Invoice Information', {
            'fields': ('invoice_number', 'order', 'customer')
        }),
        ('Dates', {
            'fields': ('issue_date', 'due_date')
        }),
        ('Financial Details', {
            'fields': ('currency', 'total_net', 'total_tax', 'total_gross')
        }),
        ('Documents', {
            'fields': ('pdf_file',),
            'classes': ('collapse',)
        }),
    )
    
    def customer(self, obj):
        return obj.order.customer.name
    customer.short_description = 'Customer'


@admin.register(DocumentSequence)
class DocumentSequenceAdmin(admin.ModelAdmin):
    list_display = ['document_type', 'year', 'last_number']
    list_filter = ['document_type', 'year']
    ordering = ['document_type', '-year']
    
    def has_add_permission(self, request):
        # Sequences should be managed automatically
        return False
    
    def has_change_permission(self, request, obj=None):
        # Sequences should not be manually edited
        return False


@admin.register(CompanyProfile)
class CompanyProfileAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'city', 'country', 'email', 'phone', 'created_at']
    list_filter = ['country', 'currency', 'created_at']
    search_fields = ['name', 'email', 'user__username', 'mwst_number']
    ordering = ['name']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['user']
    
    fieldsets = (
        ('Company Information', {
            'fields': ('user', 'name')
        }),
        ('Address', {
            'fields': ('street', 'postal_code', 'city', 'country')
        }),
        ('Contact Details', {
            'fields': ('email', 'phone')
        }),
        ('Financial Information', {
            'fields': ('iban', 'bank_name', 'mwst_number', 'currency')
        }),
        ('Branding', {
            'fields': ('logo',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )