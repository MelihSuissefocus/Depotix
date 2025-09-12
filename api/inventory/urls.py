from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    UserViewSet, CategoryViewSet, InventoryItemViewSet, InventoryLogViewSet,
    SupplierViewSet, CustomerViewSet, StockMovementViewSet, ExpenseViewSet,
    CompanyProfileView, SalesOrderViewSet, SalesOrderItemViewSet, InvoiceViewSet
)

# Create router and register viewsets
router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'items', InventoryItemViewSet)
router.register(r'logs', InventoryLogViewSet)
router.register(r'suppliers', SupplierViewSet)
router.register(r'customers', CustomerViewSet)
router.register(r'stock-movements', StockMovementViewSet, basename='stockmovement')
router.register(r'expenses', ExpenseViewSet, basename='expenses')
router.register(r'orders', SalesOrderViewSet, basename='orders')
router.register(r'order-items', SalesOrderItemViewSet, basename='order-items')
router.register(r'invoices', InvoiceViewSet, basename='invoices')

urlpatterns = [
    # API routes
    path('', include(router.urls)),
    
    # JWT token endpoints  
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Convenient stock movement endpoints
    path('stock/in/', StockMovementViewSet.as_view({'post': 'stock_in'}), name='stock-in'),
    path('stock/out/', StockMovementViewSet.as_view({'post': 'stock_out'}), name='stock-out'),
    
    # Company profile endpoint
    path('company-profile/', CompanyProfileView.as_view(), name='company-profile'),
]