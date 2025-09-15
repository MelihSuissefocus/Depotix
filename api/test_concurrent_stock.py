#!/usr/bin/env python
"""
Test script for concurrent stock movement operations to verify transactional consistency.

This script tests the atomic stock movement operations under concurrent load
to ensure no race conditions or inconsistent states occur.
"""

import os
import sys
import django
import threading
import time
import random
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed

# Setup Django environment
sys.path.insert(0, '/home/deploy/Depotix/api')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'depotix.settings')
django.setup()

from django.db import transaction
from django.contrib.auth.models import User
from inventory.models import InventoryItem, Category, StockMovement
from inventory.services import book_stock_change, StockOperationError


def create_test_data():
    """Create test user, category, and inventory item for testing"""
    print("Setting up test data...")

    # Create test user
    user, created = User.objects.get_or_create(
        username='test_concurrent_user',
        defaults={
            'email': 'test@example.com',
            'first_name': 'Test',
            'last_name': 'User'
        }
    )

    # Create test category
    category, created = Category.objects.get_or_create(
        name='Test Category',
        defaults={'description': 'Category for concurrent testing'}
    )

    # Create test item with initial stock
    item, created = InventoryItem.objects.get_or_create(
        name='Test Concurrent Item',
        owner=user,
        defaults={
            'sku': 'TEST-CONCURRENT-001',
            'description': 'Item for testing concurrent stock operations',
            'category': category,
            'quantity': Decimal('1000'),  # Start with 1000 units
            'price': Decimal('10.00'),
            'low_stock_threshold': 10
        }
    )

    # Reset quantity to known state if item already exists
    if not created:
        item.quantity = Decimal('1000')
        item.save()

    print(f"Test data created - Item ID: {item.id}, Initial quantity: {item.quantity}")
    return user, item


def concurrent_stock_operation(item_id, user_id, operation_type, quantity, thread_id):
    """
    Perform a single stock operation in a thread.

    Args:
        item_id: ID of the inventory item
        user_id: ID of the user performing the operation
        operation_type: 'IN' or 'OUT'
        quantity: Amount to move
        thread_id: Identifier for the thread (for logging)

    Returns:
        Dict with operation result and timing info
    """
    start_time = time.time()

    try:
        # Calculate delta based on operation type
        delta = Decimal(str(quantity)) if operation_type == 'IN' else -Decimal(str(quantity))

        # Perform the stock operation
        result = book_stock_change(
            item_id=item_id,
            delta=delta,
            movement_type=operation_type,
            note=f"Concurrent test - Thread {thread_id}",
            actor_id=user_id
        )

        end_time = time.time()

        return {
            'success': True,
            'thread_id': thread_id,
            'operation_type': operation_type,
            'quantity': float(quantity),
            'delta': float(delta),
            'new_qty': result['new_qty'],
            'movement_id': result['movement_id'],
            'duration': end_time - start_time,
            'error': None
        }

    except StockOperationError as e:
        end_time = time.time()
        return {
            'success': False,
            'thread_id': thread_id,
            'operation_type': operation_type,
            'quantity': float(quantity),
            'error': str(e),
            'duration': end_time - start_time
        }

    except Exception as e:
        end_time = time.time()
        return {
            'success': False,
            'thread_id': thread_id,
            'operation_type': operation_type,
            'quantity': float(quantity),
            'error': f"Unexpected error: {str(e)}",
            'duration': end_time - start_time
        }


def test_concurrent_operations(item_id, user_id, num_threads=10, operations_per_thread=5):
    """
    Test concurrent stock operations with multiple threads.

    Args:
        item_id: ID of the inventory item to test
        user_id: ID of the user performing operations
        num_threads: Number of concurrent threads
        operations_per_thread: Number of operations per thread

    Returns:
        Dict with test results and statistics
    """
    print(f"\nStarting concurrent test with {num_threads} threads, {operations_per_thread} operations each...")

    # Get initial quantity
    initial_item = InventoryItem.objects.get(id=item_id)
    initial_qty = initial_item.quantity
    print(f"Initial quantity: {initial_qty}")

    # Prepare operations (mix of IN and OUT)
    operations = []
    expected_final_qty = initial_qty

    for thread_id in range(num_threads):
        for op_num in range(operations_per_thread):
            # Randomly choose operation type and quantity
            op_type = random.choice(['IN', 'OUT'])
            quantity = random.randint(1, 20)  # Small quantities to avoid too many failures

            operations.append((item_id, user_id, op_type, quantity, f"{thread_id}-{op_num}"))

            # Track expected final quantity
            if op_type == 'IN':
                expected_final_qty += quantity
            else:
                expected_final_qty -= quantity

    print(f"Planned {len(operations)} operations, expected final quantity: {expected_final_qty}")

    # Execute operations concurrently
    start_time = time.time()
    results = []

    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        future_to_operation = {
            executor.submit(concurrent_stock_operation, *op): op
            for op in operations
        }

        for future in as_completed(future_to_operation):
            result = future.result()
            results.append(result)

            # Print progress
            if len(results) % 10 == 0:
                print(f"Completed {len(results)}/{len(operations)} operations...")

    end_time = time.time()
    total_duration = end_time - start_time

    # Analyze results
    successful_operations = [r for r in results if r['success']]
    failed_operations = [r for r in results if not r['success']]

    print(f"\nOperation completed in {total_duration:.2f} seconds")
    print(f"Successful operations: {len(successful_operations)}")
    print(f"Failed operations: {len(failed_operations)}")

    # Check final quantity consistency
    final_item = InventoryItem.objects.get(id=item_id)
    final_qty = final_item.quantity

    # Calculate actual final quantity based on successful operations
    actual_expected_qty = initial_qty
    for result in successful_operations:
        actual_expected_qty += Decimal(str(result.get('delta', 0)))

    print(f"\nQuantity Analysis:")
    print(f"Initial quantity: {initial_qty}")
    print(f"Final quantity: {final_qty}")
    print(f"Expected final (based on successful ops): {actual_expected_qty}")
    print(f"Difference: {final_qty - actual_expected_qty}")

    # Check if quantities match (this is the critical test for consistency)
    quantity_consistent = (final_qty == actual_expected_qty)
    print(f"Quantity consistency: {'✓ PASS' if quantity_consistent else '✗ FAIL'}")

    # Count movement records
    movement_count = StockMovement.objects.filter(
        item_id=item_id,
        note__startswith="Concurrent test"
    ).count()

    print(f"Movement records created: {movement_count}")
    print(f"Expected movement records: {len(successful_operations)}")

    movement_consistent = (movement_count == len(successful_operations))
    print(f"Movement consistency: {'✓ PASS' if movement_consistent else '✗ FAIL'}")

    # Error analysis
    if failed_operations:
        print(f"\nError Analysis:")
        error_types = {}
        for result in failed_operations:
            error = result.get('error', 'Unknown')
            error_types[error] = error_types.get(error, 0) + 1

        for error, count in error_types.items():
            print(f"  {error}: {count} occurrences")

    # Performance statistics
    if successful_operations:
        durations = [r['duration'] for r in successful_operations]
        avg_duration = sum(durations) / len(durations)
        max_duration = max(durations)
        min_duration = min(durations)

        print(f"\nPerformance Statistics:")
        print(f"Average operation duration: {avg_duration:.4f}s")
        print(f"Min operation duration: {min_duration:.4f}s")
        print(f"Max operation duration: {max_duration:.4f}s")
        print(f"Operations per second: {len(successful_operations) / total_duration:.2f}")

    return {
        'total_operations': len(operations),
        'successful_operations': len(successful_operations),
        'failed_operations': len(failed_operations),
        'quantity_consistent': quantity_consistent,
        'movement_consistent': movement_consistent,
        'initial_qty': float(initial_qty),
        'final_qty': float(final_qty),
        'expected_qty': float(actual_expected_qty),
        'total_duration': total_duration,
        'results': results
    }


def cleanup_test_data(item_id):
    """Clean up test movements for repeated testing"""
    print("\nCleaning up test data...")
    deleted_count = StockMovement.objects.filter(
        item_id=item_id,
        note__startswith="Concurrent test"
    ).delete()[0]

    print(f"Deleted {deleted_count} test movement records")


def main():
    """Main test execution"""
    print("=== Concurrent Stock Movement Test ===")
    print("Testing transactional consistency under concurrent load...")

    try:
        # Setup test data
        user, item = create_test_data()

        # Test 1: Light load
        print("\n" + "="*50)
        print("TEST 1: Light load (5 threads, 3 operations each)")
        result1 = test_concurrent_operations(item.id, user.id, num_threads=5, operations_per_thread=3)

        # Cleanup between tests
        cleanup_test_data(item.id)

        # Reset item quantity for next test
        item.quantity = Decimal('1000')
        item.save()

        # Test 2: Medium load
        print("\n" + "="*50)
        print("TEST 2: Medium load (10 threads, 5 operations each)")
        result2 = test_concurrent_operations(item.id, user.id, num_threads=10, operations_per_thread=5)

        # Cleanup between tests
        cleanup_test_data(item.id)

        # Reset item quantity for next test
        item.quantity = Decimal('1000')
        item.save()

        # Test 3: Heavy load
        print("\n" + "="*50)
        print("TEST 3: Heavy load (20 threads, 10 operations each)")
        result3 = test_concurrent_operations(item.id, user.id, num_threads=20, operations_per_thread=10)

        # Summary
        print("\n" + "="*50)
        print("SUMMARY")
        print("="*50)

        tests = [
            ("Light load", result1),
            ("Medium load", result2),
            ("Heavy load", result3)
        ]

        all_passed = True
        for test_name, result in tests:
            consistent = result['quantity_consistent'] and result['movement_consistent']
            status = "✓ PASS" if consistent else "✗ FAIL"
            success_rate = (result['successful_operations'] / result['total_operations']) * 100

            print(f"{test_name:12} | {status} | Success rate: {success_rate:5.1f}% | Ops/sec: {result['successful_operations']/result['total_duration']:5.1f}")

            if not consistent:
                all_passed = False

        print("="*50)
        overall_status = "✓ ALL TESTS PASSED" if all_passed else "✗ SOME TESTS FAILED"
        print(f"Overall result: {overall_status}")

        if all_passed:
            print("\n🎉 Transactional consistency verified!")
            print("   - No race conditions detected")
            print("   - Stock quantities remain consistent")
            print("   - Movement logs are accurate")
        else:
            print("\n⚠️  Consistency issues detected!")
            print("   - Review the transactional implementation")
            print("   - Check for race conditions")

    except Exception as e:
        print(f"\nTest execution failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        # Final cleanup
        cleanup_test_data(item.id)

    return all_passed


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)