from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Category, Supplier, Customer, InventoryItem, StockMovement, 
    SalesOrder, SalesOrderItem, Invoice, Expense
)


class AuthenticationTestCase(APITestCase):
    """Test authentication flows"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.staff_user = User.objects.create_user(
            username='staffuser',
            email='staff@example.com',
            password='staffpass123',
            is_staff=True
        )
    
    def test_token_obtain(self):
        """Test JWT token obtain"""
        url = reverse('token_obtain_pair')
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
    
    def test_token_obtain_invalid_credentials(self):
        """Test JWT token obtain with invalid credentials"""
        url = reverse('token_obtain_pair')
        data = {
            'username': 'testuser',
            'password': 'wrongpassword'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'UNAUTHORIZED')
    
    def test_token_refresh(self):
        """Test JWT token refresh"""
        refresh = RefreshToken.for_user(self.user)
        url = reverse('token_refresh')
        data = {'refresh': str(refresh)}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)


class RBACTestCase(APITestCase):
    """Test Role-Based Access Control and queryset scoping"""
    
    def setUp(self):
        self.user1 = User.objects.create_user(
            username='user1',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            password='testpass123'
        )
        self.staff_user = User.objects.create_user(
            username='staff',
            password='testpass123',
            is_staff=True
        )
        
        # Create test data owned by different users
        self.category = Category.objects.create(name='Test Category')
        
        self.supplier1 = Supplier.objects.create(
            name='Supplier 1',
            owner=self.user1
        )
        self.supplier2 = Supplier.objects.create(
            name='Supplier 2',
            owner=self.user2
        )
        
        self.item1 = InventoryItem.objects.create(
            name='Item 1',
            sku='ITEM001',
            price=Decimal('10.00'),
            quantity=100,
            owner=self.user1,
            category=self.category
        )
        self.item2 = InventoryItem.objects.create(
            name='Item 2',
            sku='ITEM002',
            price=Decimal('20.00'),
            quantity=50,
            owner=self.user2,
            category=self.category
        )
    
    def test_user_sees_only_own_items(self):
        """Test that non-staff users only see their own items"""
        self.client.force_authenticate(user=self.user1)
        url = reverse('inventoryitem-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Item 1')
    
    def test_staff_sees_all_items(self):
        """Test that staff users see all items"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('inventoryitem-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_user_cannot_access_others_items(self):
        """Test that users cannot access items they don't own"""
        self.client.force_authenticate(user=self.user1)
        url = reverse('inventoryitem-detail', kwargs={'pk': self.item2.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_user_can_access_own_items(self):
        """Test that users can access their own items"""
        self.client.force_authenticate(user=self.user1)
        url = reverse('inventoryitem-detail', kwargs={'pk': self.item1.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Item 1')


class StockMovementTestCase(APITestCase):
    """Test stock movement operations"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.category = Category.objects.create(name='Test Category')
        self.supplier = Supplier.objects.create(
            name='Test Supplier',
            owner=self.user
        )
        self.customer = Customer.objects.create(
            name='Test Customer',
            owner=self.user
        )
        self.item = InventoryItem.objects.create(
            name='Test Item',
            sku='TEST001',
            price=Decimal('10.00'),
            quantity=100,
            min_stock_level=10,
            owner=self.user,
            category=self.category,
            unit_package_factor=10,
            unit_pallet_factor=100
        )
        self.client.force_authenticate(user=self.user)
    
    def test_stock_in_operation(self):
        """Test stock IN operation"""
        url = reverse('stock-in')
        data = {
            'item': self.item.id,
            'qty_base': 50,
            'note': 'Stock replenishment',
            'supplier': self.supplier.id
        }
        
        initial_qty = self.item.quantity
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, initial_qty + 50)
    
    def test_stock_out_operation(self):
        """Test stock OUT operation"""
        url = reverse('stock-out')
        data = {
            'item': self.item.id,
            'qty_base': 30,
            'note': 'Sale to customer',
            'customer': self.customer.id
        }
        
        initial_qty = self.item.quantity
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, initial_qty - 30)
    
    def test_stock_out_insufficient_stock(self):
        """Test stock OUT operation with insufficient stock"""
        url = reverse('stock-out')
        data = {
            'item': self.item.id,
            'qty_base': 200,  # More than available
            'note': 'Oversell attempt'
        }
        
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_stock_uom_conversion(self):
        """Test UoM conversion in stock operations"""
        url = reverse('stock-in')
        data = {
            'item': self.item.id,
            'qty_pallets': 1,  # 1 pallet = 100 * 10 = 1000 base units
            'qty_packages': 5,  # 5 packages = 5 * 10 = 50 base units
            'qty_singles': 25,  # 25 singles = 25 base units
            'note': 'UoM test',
            'supplier': self.supplier.id
        }
        
        initial_qty = self.item.quantity
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        # Expected: 1000 + 50 + 25 = 1075 units added
        self.assertEqual(self.item.quantity, initial_qty + 1075)
    
    def test_stock_return_operation(self):
        """Test stock RETURN operation"""
        url = reverse('stock-return')
        data = {
            'item': self.item.id,
            'qty_base': 10,
            'note': 'Customer return',
            'customer': self.customer.id
        }
        
        initial_qty = self.item.quantity
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, initial_qty + 10)
    
    def test_stock_defect_operation(self):
        """Test stock DEFECT operation"""
        url = reverse('stock-defect')
        data = {
            'item': self.item.id,
            'qty_base': 5,
            'note': 'Damaged goods'
        }
        
        initial_qty = self.item.quantity
        initial_defective = self.item.defective_qty
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, initial_qty - 5)
        self.assertEqual(self.item.defective_qty, initial_defective + 5)
    
    def test_stock_adjust_requires_note(self):
        """Test that ADJUST operations require a note"""
        url = reverse('stock-adjust')
        data = {
            'item': self.item.id,
            'qty_base': 75  # New total quantity
        }
        
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('reason', response.data['error']['message'].lower())


class LowStockTestCase(APITestCase):
    """Test low stock endpoint"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.category = Category.objects.create(name='Test Category')
        
        # Create items with different stock levels
        self.low_stock_item = InventoryItem.objects.create(
            name='Low Stock Item',
            sku='LOW001',
            price=Decimal('10.00'),
            quantity=5,  # Below min_stock_level
            min_stock_level=10,
            owner=self.user,
            category=self.category
        )
        
        self.adequate_stock_item = InventoryItem.objects.create(
            name='Adequate Stock Item',
            sku='ADQ001',
            price=Decimal('15.00'),
            quantity=50,  # Above min_stock_level
            min_stock_level=10,
            owner=self.user,
            category=self.category
        )
        
        self.client.force_authenticate(user=self.user)
    
    def test_low_stock_endpoint(self):
        """Test low stock items endpoint"""
        url = reverse('inventoryitem-low-stock')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Low Stock Item')
    
    def test_low_stock_threshold_edge_case(self):
        """Test item exactly at threshold"""
        self.low_stock_item.quantity = 10  # Exactly at min_stock_level
        self.low_stock_item.save()
        
        url = reverse('inventoryitem-low-stock')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


class SalesOrderWorkflowTestCase(APITestCase):
    """Test sales order workflow (confirm/deliver/invoice)"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.category = Category.objects.create(name='Test Category')
        self.customer = Customer.objects.create(
            name='Test Customer',
            owner=self.user
        )
        self.item = InventoryItem.objects.create(
            name='Test Item',
            sku='TEST001',
            price=Decimal('10.00'),
            quantity=100,
            owner=self.user,
            category=self.category
        )
        
        self.order = SalesOrder.objects.create(
            customer=self.customer,
            created_by=self.user
        )
        self.order_item = SalesOrderItem.objects.create(
            order=self.order,
            item=self.item,
            qty_base=10,
            unit_price=Decimal('10.00'),
            tax_rate=Decimal('7.7')
        )
        
        self.client.force_authenticate(user=self.user)
    
    def test_order_confirm_workflow(self):
        """Test order confirmation"""
        url = reverse('salesorder-confirm', kwargs={'pk': self.order.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'CONFIRMED')
    
    def test_order_deliver_workflow(self):
        """Test order delivery"""
        # First confirm the order
        self.order.status = 'CONFIRMED'
        self.order.save()
        
        initial_stock = self.item.quantity
        url = reverse('salesorder-deliver', kwargs={'pk': self.order.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.item.refresh_from_db()
        
        self.assertEqual(self.order.status, 'DELIVERED')
        self.assertEqual(self.item.quantity, initial_stock - 10)
    
    def test_order_deliver_insufficient_stock(self):
        """Test delivery fails with insufficient stock"""
        self.order.status = 'CONFIRMED'
        self.order.save()
        
        # Set item quantity below order requirement
        self.item.quantity = 5
        self.item.save()
        
        url = reverse('salesorder-deliver', kwargs={'pk': self.order.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'BUSINESS_RULE_VIOLATION')
    
    def test_order_invoice_workflow(self):
        """Test invoice creation from delivered order"""
        # Set order as delivered
        self.order.status = 'DELIVERED'
        self.order.save()
        
        url = reverse('salesorder-invoice', kwargs={'pk': self.order.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.order.refresh_from_db()
        
        self.assertEqual(self.order.status, 'INVOICED')
        self.assertTrue(hasattr(self.order, 'invoice'))
        self.assertIsNotNone(self.order.invoice.invoice_number)
    
    def test_invoice_before_delivery_fails(self):
        """Test that invoicing fails for non-delivered orders"""
        url = reverse('salesorder-invoice', kwargs={'pk': self.order.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertIn('error', response.data)
    
    def test_double_invoice_fails(self):
        """Test that creating invoice twice fails"""
        # Create invoice first time
        self.order.status = 'DELIVERED'
        self.order.save()
        Invoice.objects.create(order=self.order)
        
        url = reverse('salesorder-invoice', kwargs={'pk': self.order.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertIn('already has an invoice', response.data['error']['message'])


class InvoicePDFTestCase(APITestCase):
    """Test invoice PDF generation"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.customer = Customer.objects.create(
            name='Test Customer',
            address='123 Test St',
            email='customer@test.com',
            owner=self.user
        )
        self.order = SalesOrder.objects.create(
            customer=self.customer,
            status='DELIVERED',
            created_by=self.user
        )
        self.invoice = Invoice.objects.create(order=self.order)
        
        self.client.force_authenticate(user=self.user)
    
    def test_invoice_pdf_endpoint(self):
        """Test invoice PDF generation endpoint"""
        url = reverse('invoice-pdf', kwargs={'pk': self.invoice.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Content-Disposition', response)
        self.assertIn(f'invoice_{self.invoice.invoice_number}', response['Content-Disposition'])
    
    def test_invoice_pdf_not_found(self):
        """Test PDF endpoint with non-existent invoice"""
        url = reverse('invoice-pdf', kwargs={'pk': 99999})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    

class FilterTestCase(APITestCase):
    """Test filtering, searching, and ordering functionality"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.category1 = Category.objects.create(name='Category 1')
        self.category2 = Category.objects.create(name='Category 2')
        
        # Create test items with different attributes
        self.item1 = InventoryItem.objects.create(
            name='Apple',
            sku='APPLE001',
            price=Decimal('1.50'),
            quantity=100,
            category=self.category1,
            owner=self.user
        )
        self.item2 = InventoryItem.objects.create(
            name='Banana',
            sku='BANANA001',
            price=Decimal('0.75'),
            quantity=50,
            category=self.category2,
            owner=self.user
        )
        
        self.client.force_authenticate(user=self.user)
    
    def test_item_search(self):
        """Test item search functionality"""
        url = reverse('inventoryitem-list')
        response = self.client.get(url, {'search': 'Apple'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Apple')
    
    def test_item_filter_by_category(self):
        """Test item filtering by category"""
        url = reverse('inventoryitem-list')
        response = self.client.get(url, {'category': self.category1.id})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['category'], self.category1.id)
    
    def test_item_price_range_filter(self):
        """Test item filtering by price range"""
        url = reverse('inventoryitem-list')
        response = self.client.get(url, {'min_price': '1.00', 'max_price': '2.00'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Apple')
    
    def test_item_ordering(self):
        """Test item ordering"""
        url = reverse('inventoryitem-list')
        response = self.client.get(url, {'ordering': 'price'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
        # Should be ordered by price ascending (Banana first)
        self.assertEqual(response.data['results'][0]['name'], 'Banana')
        self.assertEqual(response.data['results'][1]['name'], 'Apple')


class ErrorHandlingTestCase(APITestCase):
    """Test error handling and response format"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_validation_error_format(self):
        """Test validation error response format"""
        url = reverse('inventoryitem-list')
        # Send invalid data (missing required fields)
        data = {
            'name': '',  # Required field empty
            'price': 'invalid'  # Invalid price format
        }
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')
        self.assertIn('fields', response.data['error'])
    
    def test_not_found_error_format(self):
        """Test 404 error response format"""
        url = reverse('inventoryitem-detail', kwargs={'pk': 99999})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'NOT_FOUND')
    
    def test_unauthorized_error_format(self):
        """Test unauthorized access error format"""
        self.client.force_authenticate(user=None)  # Remove authentication
        url = reverse('inventoryitem-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'UNAUTHORIZED')


class PaginationTestCase(APITestCase):
    """Test pagination functionality"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.category = Category.objects.create(name='Test Category')
        
        # Create more than 25 items to test pagination
        for i in range(30):
            InventoryItem.objects.create(
                name=f'Item {i:02d}',
                sku=f'ITEM{i:03d}',
                price=Decimal(f'{i + 1}.00'),
                quantity=100,
                category=self.category,
                owner=self.user
            )
        
        self.client.force_authenticate(user=self.user)
    
    def test_pagination_default_page_size(self):
        """Test default pagination page size (25 items)"""
        url = reverse('inventoryitem-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 25)
        self.assertIsNotNone(response.data['next'])
        self.assertIsNone(response.data['previous'])
    
    def test_pagination_second_page(self):
        """Test accessing second page"""
        url = reverse('inventoryitem-list')
        response = self.client.get(url, {'page': 2})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 5)  # Remaining 5 items
        self.assertIsNone(response.data['next'])
        self.assertIsNotNone(response.data['previous'])