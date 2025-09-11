from django.contrib import admin
from .models import (
    Category, Supplier, Customer, InventoryItem, 
    Expense, InventoryLog, InventoryItemSupplier
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
        'name', 'sku', 'quantity', 'defective_qty', 'available_qty', 
        'price', 'category', 'is_low_stock', 'owner', 'is_active'
    ]
    list_filter = [
        'is_active', 'category', 'unit_base', 'owner', 'date_added'
    ]
    search_fields = ['name', 'sku', 'description']
    ordering = ['name']
    readonly_fields = [
        'date_added', 'last_updated', 'available_qty', 'is_low_stock', 
        'total_value', 'category_name', 'owner_username'
    ]
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'sku', 'category', 'is_active', 'owner')
        }),
        ('Inventory Details', {
            'fields': ('quantity', 'defective_qty', 'available_qty', 'min_stock_level', 'location')
        }),
        ('Pricing', {
            'fields': ('price', 'cost', 'total_value')
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