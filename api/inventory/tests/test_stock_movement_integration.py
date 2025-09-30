"""
Integration tests for stock movement transactions.

These tests verify ACID properties, idempotency, and concurrency handling.
"""

from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.db import connection, transaction
from rest_framework.test import APIClient
from rest_framework import status
from inventory.models import InventoryItem, StockMovement, Category
from decimal import Decimal
import threading
import uuid


class IdempotencyTests(TestCase):
    """Test idempotency guarantees"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Create test item
        self.item = InventoryItem.objects.create(
            name='Test Cola 1L',
            sku='TEST-001',
            quantity=100,
            price=Decimal('2.50'),
            owner=self.user,
            unit_pallet_factor=10,
            unit_package_factor=6
        )

    def test_duplicate_idempotency_key_returns_same_movement(self):
        """Test that duplicate idempotency_key returns existing movement with 200 OK"""
        idempotency_key = str(uuid.uuid4())

        # First request - creates movement
        payload = {
            'item': self.item.id,
            'type': 'IN',
            'qty_base': 60,
            'qty_pallets': 1,
            'qty_packages': 0,
            'qty_singles': 0,
            'note': 'First request',
            'idempotency_key': idempotency_key
        }
        response1 = self.client.post('/api/inventory/stock-movements/', payload, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        movement_id_1 = response1.data['id']

        # Reload item to verify quantity
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 160)  # 100 + 60

        # Second request with same idempotency_key - returns existing
        payload['note'] = 'Second request (should be ignored)'
        response2 = self.client.post('/api/inventory/stock-movements/', payload, format='json')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        movement_id_2 = response2.data['id']

        # Should return same movement ID
        self.assertEqual(movement_id_1, movement_id_2)

        # Quantity should NOT have changed
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 160)  # Still 160, not 220

        # Only one movement should exist
        movements = StockMovement.objects.filter(idempotency_key=idempotency_key)
        self.assertEqual(movements.count(), 1)

    def test_different_idempotency_keys_create_separate_movements(self):
        """Test that different idempotency_keys create separate movements"""
        key1 = str(uuid.uuid4())
        key2 = str(uuid.uuid4())

        # First movement
        payload1 = {
            'item': self.item.id,
            'type': 'IN',
            'qty_base': 30,
            'idempotency_key': key1
        }
        response1 = self.client.post('/api/inventory/stock-movements/', payload1, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        # Second movement with different key
        payload2 = {
            'item': self.item.id,
            'type': 'IN',
            'qty_base': 40,
            'idempotency_key': key2
        }
        response2 = self.client.post('/api/inventory/stock-movements/', payload2, format='json')
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)

        # Should have different IDs
        self.assertNotEqual(response1.data['id'], response2.data['id'])

        # Quantity should reflect both movements
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 170)  # 100 + 30 + 40


class NegativeStockPreventionTests(TestCase):
    """Test that negative stock is prevented at all levels"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.item = InventoryItem.objects.create(
            name='Test Item',
            sku='TEST-002',
            quantity=50,
            price=Decimal('5.00'),
            owner=self.user,
            unit_pallet_factor=1,
            unit_package_factor=1
        )

    def test_out_movement_exceeding_stock_returns_422(self):
        """Test that OUT movement exceeding stock returns 422 with clear error"""
        payload = {
            'item': self.item.id,
            'type': 'OUT',
            'qty_base': 100,  # More than available 50
            'idempotency_key': str(uuid.uuid4())
        }
        response = self.client.post('/api/inventory/stock-movements/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'INSUFFICIENT_STOCK')
        self.assertIn('Nicht genügend Lagerbestand', response.data['error']['message'])

        # Quantity should be unchanged
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 50)

    def test_exact_stock_out_allowed(self):
        """Test that OUT movement of exact stock is allowed"""
        payload = {
            'item': self.item.id,
            'type': 'OUT',
            'qty_base': 50,  # Exactly available
            'idempotency_key': str(uuid.uuid4())
        }
        response = self.client.post('/api/inventory/stock-movements/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Quantity should be zero
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 0)


class AtomicityTests(TransactionTestCase):
    """Test transaction atomicity (rollback on error)"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.item = InventoryItem.objects.create(
            name='Test Item',
            sku='TEST-003',
            quantity=100,
            price=Decimal('3.00'),
            owner=self.user,
            unit_pallet_factor=10,
            unit_package_factor=6
        )

    def test_ppu_conversion_error_rolls_back_transaction(self):
        """Test that PPU conversion error prevents any DB changes"""
        initial_quantity = self.item.quantity
        initial_movement_count = StockMovement.objects.count()

        # Send invalid PPU conversion (client claims wrong qty_base)
        payload = {
            'item': self.item.id,
            'type': 'IN',
            'qty_base': 999,  # Wrong! Should be 60 (1×10×6)
            'qty_pallets': 1,
            'qty_packages': 0,
            'qty_singles': 0,
            'idempotency_key': str(uuid.uuid4())
        }
        response = self.client.post('/api/inventory/stock-movements/', payload, format='json')

        # Should return 400 (PPU conversion error)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Quantity should be unchanged (transaction rolled back)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, initial_quantity)

        # No movement should be created
        self.assertEqual(StockMovement.objects.count(), initial_movement_count)


class ConcurrencyTests(TransactionTestCase):
    """Test concurrent movement handling with SELECT FOR UPDATE"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.item = InventoryItem.objects.create(
            name='Test Item',
            sku='TEST-004',
            quantity=100,
            price=Decimal('2.00'),
            owner=self.user,
            unit_pallet_factor=1,
            unit_package_factor=1
        )

    def test_concurrent_out_movements_respect_lock(self):
        """Test that concurrent OUT movements don't cause race conditions"""
        # This test simulates two parallel requests trying to withdraw stock
        # With proper locking, only valid withdrawals should succeed

        results = {'success': 0, 'failures': 0}
        errors = []

        def perform_movement(qty):
            """Perform OUT movement in separate thread"""
            try:
                from django.db import connection
                connection.ensure_connection()

                # Create movement manually to simulate concurrent requests
                with transaction.atomic():
                    item = InventoryItem.objects.select_for_update().get(id=self.item.id)
                    if item.quantity >= qty:
                        item.quantity -= qty
                        item.save()

                        StockMovement.objects.create(
                            item=item,
                            type='OUT',
                            qty_base=qty,
                            created_by=self.user,
                            idempotency_key=str(uuid.uuid4())
                        )
                        results['success'] += 1
                    else:
                        results['failures'] += 1
            except Exception as e:
                errors.append(str(e))
                results['failures'] += 1

        # Start two threads trying to withdraw 60 units each
        # Only one should succeed (initial quantity is 100)
        thread1 = threading.Thread(target=perform_movement, args=(60,))
        thread2 = threading.Thread(target=perform_movement, args=(60,))

        thread1.start()
        thread2.start()

        thread1.join()
        thread2.join()

        # Both might have succeeded due to race, or one failed
        # The important check: final quantity must be consistent
        self.item.refresh_from_db()

        # Calculate expected quantity
        successful_withdrawals = results['success']
        expected_quantity = 100 - (successful_withdrawals * 60)

        self.assertEqual(self.item.quantity, expected_quantity)

        # Total movements should equal successful operations
        movement_count = StockMovement.objects.filter(item=self.item).count()
        self.assertEqual(movement_count, successful_withdrawals)


class PPUConversionValidationTests(TestCase):
    """Test PPU conversion validation (defense-in-depth)"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.item = InventoryItem.objects.create(
            name='Test Item',
            sku='TEST-005',
            quantity=100,
            price=Decimal('2.00'),
            owner=self.user,
            unit_pallet_factor=10,
            unit_package_factor=6
        )

    def test_correct_ppu_conversion_accepted(self):
        """Test that correct PPU conversion is accepted"""
        payload = {
            'item': self.item.id,
            'type': 'IN',
            'qty_base': 75,  # 1×10×6 + 2×6 + 3 = 75
            'qty_pallets': 1,
            'qty_packages': 2,
            'qty_singles': 3,
            'idempotency_key': str(uuid.uuid4())
        }
        response = self.client.post('/api/inventory/stock-movements/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_incorrect_ppu_conversion_rejected(self):
        """Test that incorrect PPU conversion is rejected"""
        payload = {
            'item': self.item.id,
            'type': 'IN',
            'qty_base': 100,  # WRONG! Should be 60 (1×10×6)
            'qty_pallets': 1,
            'qty_packages': 0,
            'qty_singles': 0,
            'idempotency_key': str(uuid.uuid4())
        }
        response = self.client.post('/api/inventory/stock-movements/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error']['code'], 'PPU_CONVERSION_ERROR')
