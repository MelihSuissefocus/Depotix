import io
from datetime import datetime, timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.db import transaction, models
from django.http import HttpResponse
from django.utils import timezone
from django_filters import rest_framework as filters
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.utils import extend_schema, extend_schema_view

from .models import (
    Category, Supplier, Customer, InventoryItem, Expense, InventoryLog,
    InventoryItemSupplier, StockMovement, SalesOrder, SalesOrderItem, 
    Invoice, DocumentSequence
)
from .serializers import (
    UserSerializer, CategorySerializer, SupplierSerializer, CustomerSerializer,
    InventoryItemSerializer, ExpenseSerializer, InventoryLogSerializer,
    InventoryItemSupplierSerializer, StockMovementSerializer, 
    SalesOrderSerializer, SalesOrderItemSerializer, InvoiceSerializer,
    DocumentSequenceSerializer, StockMovementCreateSerializer,
    OrderToInvoiceSerializer, InventoryItemListSerializer
)
from .permissions import (
    IsOwnerOrStaffReadWrite, IsStaffOrReadOnly, StockMovementPermission,
    SalesOrderPermission
)


# Custom exception handler for consistent error responses
def custom_exception_handler(exc, context):
    from rest_framework.views import exception_handler
    from rest_framework import status
    
    response = exception_handler(exc, context)
    
    if response is not None:
        # Create consistent error format
        error_data = {
            "error": {
                "code": "VALIDATION_ERROR" if response.status_code == 400 else "ERROR",
                "message": "An error occurred",
                "fields": {}
            }
        }
        
        if isinstance(response.data, dict):
            if 'detail' in response.data:
                error_data["error"]["message"] = str(response.data['detail'])
            else:
                error_data["error"]["fields"] = response.data
                error_data["error"]["message"] = "Validation failed"
        elif isinstance(response.data, list) and response.data:
            error_data["error"]["message"] = str(response.data[0])
        
        # Map status codes to error codes
        if response.status_code == 401:
            error_data["error"]["code"] = "UNAUTHORIZED"
        elif response.status_code == 403:
            error_data["error"]["code"] = "FORBIDDEN"
        elif response.status_code == 404:
            error_data["error"]["code"] = "NOT_FOUND"
        elif response.status_code == 409:
            error_data["error"]["code"] = "CONFLICT"
        elif response.status_code == 422:
            error_data["error"]["code"] = "BUSINESS_RULE_VIOLATION"
        
        response.data = error_data
    
    return response


# Filters
class InventoryItemFilter(filters.FilterSet):
    """Filter for inventory items"""
    category = filters.NumberFilter(field_name='category__id')
    category_name = filters.CharFilter(field_name='category__name', lookup_expr='icontains')
    low_stock = filters.BooleanFilter(method='filter_low_stock')
    min_price = filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = filters.NumberFilter(field_name='price', lookup_expr='lte')
    
    class Meta:
        model = InventoryItem
        fields = ['category', 'is_active', 'unit_base']
    
    def filter_low_stock(self, queryset, name, value):
        if value:
            return queryset.filter(quantity__lte=models.F('min_stock_level'))
        return queryset


class StockMovementFilter(filters.FilterSet):
    """Filter for stock movements"""
    date_from = filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    date_to = filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')
    item_name = filters.CharFilter(field_name='item__name', lookup_expr='icontains')
    
    class Meta:
        model = StockMovement
        fields = ['type', 'item', 'supplier', 'customer', 'created_by']


class SalesOrderFilter(filters.FilterSet):
    """Filter for sales orders"""
    date_from = filters.DateFilter(field_name='order_date', lookup_expr='gte')
    date_to = filters.DateFilter(field_name='order_date', lookup_expr='lte')
    customer_name = filters.CharFilter(field_name='customer__name', lookup_expr='icontains')
    
    class Meta:
        model = SalesOrder
        fields = ['status', 'customer', 'created_by']


class ExpenseFilter(filters.FilterSet):
    """Filter for expenses"""
    date_from = filters.DateFilter(field_name='date', lookup_expr='gte')
    date_to = filters.DateFilter(field_name='date', lookup_expr='lte')
    supplier_name = filters.CharFilter(field_name='supplier__name', lookup_expr='icontains')
    
    class Meta:
        model = Expense
        fields = ['category', 'supplier']


# Import ViewSets from separate file
from .viewsets import (
    CategoryViewSet, SupplierViewSet, CustomerViewSet, InventoryItemViewSet,
    ExpenseViewSet, StockMovementViewSet, SalesOrderViewSet, SalesOrderItemViewSet,
    InvoiceViewSet, StockActionViewSet, InventoryLogViewSet, InventoryItemSupplierViewSet,
    DocumentSequenceViewSet
)


# Authentication Views
class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom token obtain view with better error handling"""
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 401:
            response.data = {
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid credentials"
                }
            }
        return response


class CustomTokenRefreshView(TokenRefreshView):
    """Custom token refresh view with better error handling"""
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 401:
            response.data = {
                "error": {
                    "code": "UNAUTHORIZED", 
                    "message": "Invalid or expired refresh token"
                }
            }
        return response