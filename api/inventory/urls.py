from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from .views import CustomTokenObtainPairView, CustomTokenRefreshView
from .viewsets import (
    CategoryViewSet, SupplierViewSet, CustomerViewSet, InventoryItemViewSet,
    ExpenseViewSet, StockMovementViewSet, SalesOrderViewSet, SalesOrderItemViewSet,
    InvoiceViewSet, StockActionViewSet, InventoryLogViewSet, InventoryItemSupplierViewSet,
    DocumentSequenceViewSet
)

# Create router and register ViewSets
router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'items', InventoryItemViewSet, basename='inventoryitem')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'stock-movements', StockMovementViewSet, basename='stockmovement')
router.register(r'orders', SalesOrderViewSet, basename='salesorder')
router.register(r'order-items', SalesOrderItemViewSet, basename='salesorderitem')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'stock', StockActionViewSet, basename='stock')
router.register(r'logs', InventoryLogViewSet, basename='inventorylog')
router.register(r'item-suppliers', InventoryItemSupplierViewSet, basename='inventoryitemsupplier')
router.register(r'document-sequences', DocumentSequenceViewSet)

urlpatterns = [
    # Authentication endpoints
    path('auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    
    # API endpoints
    path('api/v1/', include(router.urls)),
    
    # OpenAPI/Swagger documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
