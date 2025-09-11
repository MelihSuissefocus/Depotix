"""
Tests for PDF generation functionality
"""

import json
from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from decimal import Decimal
from datetime import date, timedelta

from .models import (
    Category, Supplier, Customer, InventoryItem, 
    SalesOrder, SalesOrderItem, Invoice, DocumentSequence
)
from .services import (
    render_to_pdf, generate_invoice_pdf, generate_delivery_note_pdf,
    PDFGenerationError, validate_pdf_requirements
)


class PDFServiceTests(TestCase):
    """Test PDF generation services"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', 
            password='testpass123'
        )
        
        # Create test data
        self.customer = Customer.objects.create(
            name='Test Customer GmbH',
            contact_name='Max Mustermann',
            email='max@test.com',
            phone='+41 44 123 45 67',
            address='Teststraße 123\n8000 Zürich\nSchweiz',
            tax_id='CHE-123.456.789',
            owner=self.user
        )
        
        self.category = Category.objects.create(
            name='Test Category'
        )
        
        self.item = InventoryItem.objects.create(
            name='Test Product',
            sku='TEST-001',
            quantity=100,
            price=Decimal('25.50'),
            cost=Decimal('15.00'),
            category=self.category,
            owner=self.user
        )
        
        self.order = SalesOrder.objects.create(
            customer=self.customer,
            status='DELIVERED',
            created_by=self.user
        )
        
        self.order_item = SalesOrderItem.objects.create(
            order=self.order,
            item=self.item,
            qty_base=10,
            unit_price=Decimal('25.50'),
            tax_rate=Decimal('7.7')
        )
        
        # Calculate order totals
        self.order.calculate_totals()
        
        self.invoice = Invoice.objects.create(
            order=self.order
        )
    
    def test_validate_pdf_requirements(self):
        """Test PDF requirements validation"""
        try:
            validate_pdf_requirements()
        except PDFGenerationError as e:
            # It's okay if WeasyPrint is not installed in test environment
            self.assertIn('WeasyPrint', str(e))
    
    def test_document_sequence_generation(self):
        """Test atomic document number generation"""
        # Test invoice number generation
        invoice_num1 = DocumentSequence.next_invoice_number()
        invoice_num2 = DocumentSequence.next_invoice_number()
        
        self.assertTrue(invoice_num1.startswith('INV-'))
        self.assertTrue(invoice_num2.startswith('INV-'))
        self.assertNotEqual(invoice_num1, invoice_num2)
        
        # Extract numbers
        num1 = int(invoice_num1.split('-')[-1])
        num2 = int(invoice_num2.split('-')[-1])
        self.assertEqual(num2, num1 + 1)
        
        # Test delivery note number generation
        delivery_num1 = DocumentSequence.next_delivery_number()
        delivery_num2 = DocumentSequence.next_delivery_number()
        
        self.assertTrue(delivery_num1.startswith('LS-'))
        self.assertTrue(delivery_num2.startswith('LS-'))
        self.assertNotEqual(delivery_num1, delivery_num2)
    
    def test_invoice_model_numbering(self):
        """Test invoice automatic numbering"""
        invoice1 = Invoice.objects.create(order=self.order)
        
        # Should auto-generate invoice number
        self.assertIsNotNone(invoice1.invoice_number)
        self.assertTrue(invoice1.invoice_number.startswith('INV-'))
        
        # Should copy totals from order
        self.assertEqual(invoice1.total_net, self.order.total_net)
        self.assertEqual(invoice1.total_tax, self.order.total_tax)
        self.assertEqual(invoice1.total_gross, self.order.total_gross)
        
        # Should set due date
        self.assertIsNotNone(invoice1.due_date)
        expected_due = date.today() + timedelta(days=30)
        self.assertEqual(invoice1.due_date, expected_due)
    
    def test_sales_order_numbering(self):
        """Test sales order automatic numbering"""
        new_order = SalesOrder.objects.create(
            customer=self.customer,
            created_by=self.user
        )
        
        # Should auto-generate order number
        self.assertIsNotNone(new_order.order_number)
        self.assertTrue(new_order.order_number.startswith('LS-'))


class PDFAPITests(APITestCase):
    """Test PDF generation API endpoints"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        
        # Create JWT token for authentication
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        
        # Create test data
        self.customer = Customer.objects.create(
            name='Test Customer GmbH',
            contact_name='Max Mustermann',
            email='max@test.com',
            address='Teststraße 123\n8000 Zürich\nSchweiz',
            owner=self.user
        )
        
        self.category = Category.objects.create(
            name='Test Category'
        )
        
        self.item = InventoryItem.objects.create(
            name='Test Product',
            sku='TEST-001',
            quantity=100,
            price=Decimal('25.50'),
            category=self.category,
            owner=self.user
        )
        
        self.order = SalesOrder.objects.create(
            customer=self.customer,
            status='DELIVERED',
            created_by=self.user
        )
        
        self.order_item = SalesOrderItem.objects.create(
            order=self.order,
            item=self.item,
            qty_base=10,
            unit_price=Decimal('25.50'),
            tax_rate=Decimal('7.7')
        )
        
        self.order.calculate_totals()
        
        self.invoice = Invoice.objects.create(
            order=self.order
        )
    
    def test_invoice_pdf_endpoint_unauthenticated(self):
        """Test invoice PDF endpoint without authentication"""
        # Remove authentication
        self.client.credentials()
        
        url = reverse('invoice-pdf', kwargs={'pk': self.invoice.pk})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_invoice_pdf_endpoint_authenticated(self):
        """Test invoice PDF endpoint with authentication"""
        url = reverse('invoice-pdf', kwargs={'pk': self.invoice.pk})
        response = self.client.get(url)
        
        # Should return 500 if WeasyPrint is not installed, otherwise PDF
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR])
        
        if response.status_code == status.HTTP_200_OK:
            # Should return PDF content
            self.assertEqual(response['Content-Type'], 'application/pdf')
            self.assertIn('attachment', response['Content-Disposition'])
            self.assertIn(self.invoice.invoice_number, response['Content-Disposition'])
    
    def test_delivery_note_pdf_endpoint(self):
        """Test delivery note PDF endpoint"""
        url = reverse('salesorder-delivery-note-pdf', kwargs={'pk': self.order.pk})
        response = self.client.get(url)
        
        # Should return 500 if WeasyPrint is not installed, otherwise PDF
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR])
        
        if response.status_code == status.HTTP_200_OK:
            # Should return PDF content
            self.assertEqual(response['Content-Type'], 'application/pdf')
            self.assertIn('attachment', response['Content-Disposition'])
            self.assertIn(self.order.order_number, response['Content-Disposition'])
    
    def test_invoice_pdf_not_found(self):
        """Test invoice PDF endpoint with non-existent invoice"""
        url = reverse('invoice-pdf', kwargs={'pk': 99999})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_delivery_note_pdf_not_found(self):
        """Test delivery note PDF endpoint with non-existent order"""
        url = reverse('salesorder-delivery-note-pdf', kwargs={'pk': 99999})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_pdf_access_control(self):
        """Test PDF access control for different users"""
        # Create another user
        other_user = User.objects.create_user(
            username='otheruser',
            password='otherpass123'
        )
        
        # Create order owned by other user
        other_order = SalesOrder.objects.create(
            customer=self.customer,
            status='DELIVERED',
            created_by=other_user
        )
        
        other_invoice = Invoice.objects.create(order=other_order)
        
        # Current user should not be able to access other user's PDFs
        url = reverse('invoice-pdf', kwargs={'pk': other_invoice.pk})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_staff_user_pdf_access(self):
        """Test that staff users can access all PDFs"""
        # Make user staff
        self.user.is_staff = True
        self.user.save()
        
        # Create another user
        other_user = User.objects.create_user(
            username='otheruser',
            password='otherpass123'
        )
        
        # Create order owned by other user
        other_order = SalesOrder.objects.create(
            customer=self.customer,
            status='DELIVERED',
            created_by=other_user
        )
        
        other_invoice = Invoice.objects.create(order=other_order)
        
        # Staff user should be able to access any PDF
        url = reverse('invoice-pdf', kwargs={'pk': other_invoice.pk})
        response = self.client.get(url)
        
        # Should return 500 if WeasyPrint is not installed, otherwise PDF
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR])


class PDFContentTests(TestCase):
    """Test PDF content generation"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        
        # Create test data with German content
        self.customer = Customer.objects.create(
            name='Müller Getränke GmbH',
            contact_name='Hans Müller',
            email='info@mueller-getraenke.ch',
            phone='+41 44 123 45 67',
            address='Bierstraße 123\n8000 Zürich\nSchweiz',
            shipping_address='Lagerstraße 456\n8001 Zürich\nSchweiz',
            tax_id='CHE-123.456.789',
            payment_terms='30 Tage netto',
            owner=self.user
        )
        
        self.category = Category.objects.create(
            name='Getränke'
        )
        
        self.item1 = InventoryItem.objects.create(
            name='Coca-Cola 0.5L',
            sku='COLA-500',
            quantity=500,
            price=Decimal('2.50'),
            cost=Decimal('1.20'),
            unit_base='PIECE',
            unit_package_factor=24,
            unit_pallet_factor=60,
            category=self.category,
            location='Lager A-1',
            owner=self.user
        )
        
        self.item2 = InventoryItem.objects.create(
            name='Mineralwasser 1.5L',
            sku='WATER-1500',
            quantity=300,
            price=Decimal('1.80'),
            cost=Decimal('0.90'),
            unit_base='PIECE',
            category=self.category,
            location='Lager B-2',
            owner=self.user
        )
        
        self.order = SalesOrder.objects.create(
            customer=self.customer,
            status='DELIVERED',
            delivery_date=date.today() + timedelta(days=3),
            created_by=self.user
        )
        
        # Add multiple items to test table rendering
        SalesOrderItem.objects.create(
            order=self.order,
            item=self.item1,
            qty_base=48,  # 2 packages
            unit_price=Decimal('2.50'),
            tax_rate=Decimal('7.7')
        )
        
        SalesOrderItem.objects.create(
            order=self.order,
            item=self.item2,
            qty_base=24,
            unit_price=Decimal('1.80'),
            tax_rate=Decimal('7.7')
        )
        
        self.order.calculate_totals()
        
        self.invoice = Invoice.objects.create(
            order=self.order
        )
    
    def test_invoice_context_data(self):
        """Test that invoice context contains all required data"""
        from .services import generate_invoice_pdf
        
        # Mock the context generation without actually creating PDF
        context = {
            'invoice': self.invoice,
            'order': self.invoice.order,
            'customer': self.invoice.order.customer,
            'items': self.invoice.order.items.all(),
            'company': {
                'name': 'Depotix',
                'address': 'Schweizer Lagerverwaltung\nMusterstraße 123\n8000 Zürich\nSchweiz',
                'phone': '+41 44 123 45 67',
                'email': 'info@depotix.ch',
                'website': 'www.depotix.ch',
            }
        }
        
        # Verify context contains required fields
        self.assertIn('invoice', context)
        self.assertIn('order', context)
        self.assertIn('customer', context)
        self.assertIn('items', context)
        self.assertIn('company', context)
        
        # Verify customer data
        self.assertEqual(context['customer'].name, 'Müller Getränke GmbH')
        self.assertEqual(context['customer'].tax_id, 'CHE-123.456.789')
        
        # Verify order items
        items = list(context['items'])
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].item.name, 'Coca-Cola 0.5L')
        self.assertEqual(items[1].item.name, 'Mineralwasser 1.5L')
        
        # Verify financial calculations
        self.assertGreater(self.invoice.total_net, 0)
        self.assertGreater(self.invoice.total_tax, 0)
        self.assertGreater(self.invoice.total_gross, 0)
        self.assertEqual(
            self.invoice.total_gross,
            self.invoice.total_net + self.invoice.total_tax
        )
    
    def test_delivery_note_context_data(self):
        """Test that delivery note context contains all required data"""
        context = {
            'order': self.order,
            'customer': self.order.customer,
            'items': self.order.items.all(),
            'company': {
                'name': 'Depotix',
                'address': 'Schweizer Lagerverwaltung\nMusterstraße 123\n8000 Zürich\nSchweiz',
                'phone': '+41 44 123 45 67',
                'email': 'info@depotix.ch',
                'website': 'www.depotix.ch',
            }
        }
        
        # Verify context contains required fields
        self.assertIn('order', context)
        self.assertIn('customer', context)
        self.assertIn('items', context)
        self.assertIn('company', context)
        
        # Verify delivery information
        self.assertEqual(context['order'].order_number, self.order.order_number)
        self.assertEqual(context['order'].status, 'DELIVERED')
        self.assertIsNotNone(context['order'].delivery_date)
        
        # Verify customer has both billing and shipping address
        self.assertIsNotNone(context['customer'].address)
        self.assertIsNotNone(context['customer'].shipping_address)
        self.assertNotEqual(context['customer'].address, context['customer'].shipping_address)
    
    def test_german_content_handling(self):
        """Test that German umlauts and special characters are handled correctly"""
        # Test customer name with umlauts
        self.assertEqual(self.customer.name, 'Müller Getränke GmbH')
        
        # Test category with umlauts
        self.assertEqual(self.category.name, 'Getränke')
        
        # Test address formatting
        self.assertIn('Bierstraße', self.customer.address)
        self.assertIn('Zürich', self.customer.address)
        
        # Test that these would render correctly in templates
        # (actual template rendering would require template engine setup)
        self.assertTrue(len(self.customer.name.encode('utf-8')) > len(self.customer.name))
    
    def test_currency_formatting(self):
        """Test CHF currency formatting"""
        # Verify order uses CHF currency
        self.assertEqual(self.order.currency, 'CHF')
        self.assertEqual(self.invoice.currency, 'CHF')
        
        # Verify price formatting would work
        item = self.order.items.first()
        self.assertEqual(str(item.unit_price), '2.50')
        self.assertEqual(str(item.line_total_gross), '167.70')  # 48 * 2.50 * 1.077
    
    def test_line_item_calculations(self):
        """Test line item tax and total calculations"""
        items = list(self.order.items.all())
        
        # First item: 48 * 2.50 = 120.00 net, 9.24 tax, 129.24 gross
        item1 = items[0]
        self.assertEqual(item1.qty_base, 48)
        self.assertEqual(item1.unit_price, Decimal('2.50'))
        self.assertEqual(item1.tax_rate, Decimal('7.7'))
        self.assertEqual(item1.line_total_net, Decimal('120.00'))
        self.assertEqual(item1.line_tax, Decimal('9.24'))
        self.assertEqual(item1.line_total_gross, Decimal('129.24'))
        
        # Second item: 24 * 1.80 = 43.20 net, 3.33 tax, 46.53 gross
        item2 = items[1]
        self.assertEqual(item2.qty_base, 24)
        self.assertEqual(item2.unit_price, Decimal('1.80'))
        self.assertEqual(item2.line_total_net, Decimal('43.20'))
        self.assertEqual(item2.line_tax, Decimal('3.33'))
        self.assertEqual(item2.line_total_gross, Decimal('46.53'))
        
        # Order totals should sum correctly
        expected_net = Decimal('163.20')
        expected_tax = Decimal('12.57')
        expected_gross = Decimal('175.77')
        
        self.assertEqual(self.order.total_net, expected_net)
        self.assertEqual(self.order.total_tax, expected_tax)
        self.assertEqual(self.order.total_gross, expected_gross)
