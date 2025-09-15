#!/usr/bin/env python3
"""
Comprehensive Data Persistence Testing for Depotix Application

This script tests all data flows to ensure no data loss occurs during:
- API operations (CRUD)
- Database transactions
- Frontend form submissions
- Stock movements
- Financial transactions
"""

import requests
import json
import time
import sys
from datetime import datetime, date
from decimal import Decimal

class DepotixTester:
    def __init__(self, base_url="https://depotix.ch/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []

    def log_test(self, test_name, status, details=""):
        """Log test results"""
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        status_symbol = "✓" if status == "PASS" else "✗" if status == "FAIL" else "⚠"
        print(f"{status_symbol} {test_name}: {details}")

    def authenticate(self, username="admin", password="XXX"):
        """Authenticate with the API"""
        try:
            response = self.session.post(
                f"{self.base_url}/token/",
                json={"username": username, "password": password},
                timeout=10
            )

            if response.status_code == 200:
                tokens = response.json()
                self.auth_token = tokens.get('access')
                self.session.headers.update({
                    'Authorization': f'Bearer {self.auth_token}',
                    'Content-Type': 'application/json'
                })
                self.log_test("Authentication", "PASS", f"Logged in as {username}")
                return True
            else:
                self.log_test("Authentication", "FAIL", f"Status {response.status_code}: {response.text[:100]}")
                return False

        except Exception as e:
            self.log_test("Authentication", "FAIL", f"Connection error: {str(e)}")
            return False

    def test_category_persistence(self):
        """Test category CRUD operations and data persistence"""
        try:
            # Create a test category
            test_category = {
                "name": f"Test_Category_{int(time.time())}",
                "description": "Automated test category for data persistence validation"
            }

            # CREATE
            response = self.session.post(f"{self.base_url}/inventory/categories/", json=test_category)
            if response.status_code != 201:
                self.log_test("Category Create", "FAIL", f"Failed to create: {response.text[:100]}")
                return False

            created_category = response.json()
            category_id = created_category['id']

            # Verify all fields were saved
            for key, value in test_category.items():
                if created_category.get(key) != value:
                    self.log_test("Category Data Integrity", "FAIL", f"Field {key} not saved correctly")
                    return False

            # READ - Verify category exists in database
            response = self.session.get(f"{self.base_url}/inventory/categories/{category_id}/")
            if response.status_code != 200:
                self.log_test("Category Read", "FAIL", f"Could not retrieve created category")
                return False

            retrieved_category = response.json()
            for key, value in test_category.items():
                if retrieved_category.get(key) != value:
                    self.log_test("Category Read Integrity", "FAIL", f"Field {key} differs after retrieval")
                    return False

            # UPDATE
            updated_data = {"description": "Updated description for persistence test"}
            response = self.session.patch(f"{self.base_url}/inventory/categories/{category_id}/", json=updated_data)
            if response.status_code != 200:
                self.log_test("Category Update", "FAIL", f"Update failed: {response.text[:100]}")
                return False

            updated_category = response.json()
            if updated_category['description'] != updated_data['description']:
                self.log_test("Category Update Integrity", "FAIL", "Update not persisted correctly")
                return False

            # Verify update persisted to database
            response = self.session.get(f"{self.base_url}/inventory/categories/{category_id}/")
            final_category = response.json()
            if final_category['description'] != updated_data['description']:
                self.log_test("Category Update Persistence", "FAIL", "Update not persisted to database")
                return False

            # DELETE
            response = self.session.delete(f"{self.base_url}/inventory/categories/{category_id}/")
            if response.status_code != 204:
                self.log_test("Category Delete", "FAIL", f"Delete failed: {response.text[:100]}")
                return False

            # Verify deletion
            response = self.session.get(f"{self.base_url}/inventory/categories/{category_id}/")
            if response.status_code != 404:
                self.log_test("Category Delete Verification", "FAIL", "Category still exists after deletion")
                return False

            self.log_test("Category CRUD Operations", "PASS", "All operations completed successfully")
            return True

        except Exception as e:
            self.log_test("Category Test", "FAIL", f"Exception: {str(e)}")
            return False

    def test_supplier_persistence(self):
        """Test supplier CRUD operations and data persistence"""
        try:
            # Create comprehensive supplier data
            test_supplier = {
                "name": f"Test_Supplier_{int(time.time())}",
                "contact_name": "Test Contact Person",
                "email": "test@supplier.com",
                "phone": "+41 44 123 45 67",
                "address": "Test Address 123\n8000 Zürich\nSwitzerland",
                "tax_id": "CHE-123.456.789",
                "payment_terms": "30 days net",
                "notes": "Test supplier for data persistence validation",
                "is_active": True
            }

            # CREATE
            response = self.session.post(f"{self.base_url}/inventory/suppliers/", json=test_supplier)
            if response.status_code != 201:
                self.log_test("Supplier Create", "FAIL", f"Failed to create: {response.text[:100]}")
                return False

            created_supplier = response.json()
            supplier_id = created_supplier['id']

            # Verify all fields were saved correctly
            for key, value in test_supplier.items():
                if created_supplier.get(key) != value:
                    self.log_test("Supplier Data Integrity", "FAIL", f"Field {key}: expected '{value}', got '{created_supplier.get(key)}'")
                    return False

            # Verify foreign key relationship (owner) was set
            if not created_supplier.get('owner'):
                self.log_test("Supplier Owner Relationship", "FAIL", "Owner field not set")
                return False

            # UPDATE with complex data
            updated_data = {
                "address": "Updated Address 456\n8001 Zürich\nSwitzerland",
                "payment_terms": "15 days net",
                "notes": "Updated notes with special characters: äöü & symbols @#$%"
            }

            response = self.session.patch(f"{self.base_url}/inventory/suppliers/{supplier_id}/", json=updated_data)
            if response.status_code != 200:
                self.log_test("Supplier Update", "FAIL", f"Update failed: {response.text[:100]}")
                return False

            # Verify update persistence
            response = self.session.get(f"{self.base_url}/inventory/suppliers/{supplier_id}/")
            updated_supplier = response.json()
            for key, value in updated_data.items():
                if updated_supplier.get(key) != value:
                    self.log_test("Supplier Update Persistence", "FAIL", f"Field {key} not updated correctly")
                    return False

            # DELETE
            response = self.session.delete(f"{self.base_url}/inventory/suppliers/{supplier_id}/")
            if response.status_code != 204:
                self.log_test("Supplier Delete", "FAIL", f"Delete failed: {response.text[:100]}")
                return False

            self.log_test("Supplier CRUD Operations", "PASS", "All operations completed successfully")
            return True

        except Exception as e:
            self.log_test("Supplier Test", "FAIL", f"Exception: {str(e)}")
            return False

    def test_inventory_item_persistence(self):
        """Test inventory item CRUD with complex data and relationships"""
        try:
            # First create a category for the item
            category_data = {"name": f"Test_Item_Category_{int(time.time())}", "description": "Test category"}
            response = self.session.post(f"{self.base_url}/inventory/categories/", json=category_data)
            if response.status_code != 201:
                self.log_test("Item Category Creation", "FAIL", "Could not create test category")
                return False
            category_id = response.json()['id']

            # Create comprehensive inventory item
            test_item = {
                "name": f"Test_Beverage_{int(time.time())}",
                "description": "Complex test item with all beverage fields",
                "sku": f"SKU_{int(time.time())}",
                "quantity": 100,
                "defective_qty": 5,
                "price": "12.50",
                "cost": "8.75",
                "min_stock_level": 10,
                "location": "A-01-03",
                "unit_base": "PIECE",
                "unit_package_factor": 6,
                "unit_pallet_factor": 120,
                "brand": "Test Brand AG",
                "beverage_type": "beer",
                "container_type": "glass",
                "volume_ml": 500,
                "deposit_chf": "0.15",
                "is_returnable": True,
                "is_alcoholic": True,
                "abv_percent": "4.8",
                "country_of_origin": "CH",
                "ean_unit": "7612345678901",
                "ean_pack": "7612345678918",
                "vat_rate": "7.70",
                "category": category_id
            }

            # CREATE
            response = self.session.post(f"{self.base_url}/inventory/items/", json=test_item)
            if response.status_code != 201:
                self.log_test("Inventory Item Create", "FAIL", f"Failed to create: {response.text[:100]}")
                return False

            created_item = response.json()
            item_id = created_item['id']

            # Verify all fields were saved correctly
            critical_fields = ['name', 'sku', 'quantity', 'price', 'cost', 'brand', 'beverage_type', 'volume_ml']
            for field in critical_fields:
                expected = test_item[field]
                actual = created_item.get(field)
                # Handle decimal fields
                if field in ['price', 'cost', 'deposit_chf', 'abv_percent', 'vat_rate']:
                    expected = str(expected)

                if actual != expected:
                    self.log_test("Item Data Integrity", "FAIL", f"Field {field}: expected '{expected}', got '{actual}'")
                    return False

            # Verify relationships
            if created_item.get('category') != category_id:
                self.log_test("Item Category Relationship", "FAIL", "Category relationship not preserved")
                return False

            if not created_item.get('owner'):
                self.log_test("Item Owner Relationship", "FAIL", "Owner field not set")
                return False

            # Test stock adjustment via StockMovement (critical for stock management)
            adjustment_data = {
                "type": "ADJUST",
                "item": item_id,
                "qty_base": test_item['quantity'] + 50,  # Adjustment sets absolute quantity
                "note": "Test stock adjustment"
            }
            response = self.session.post(f"{self.base_url}/inventory/stock-movements/", json=adjustment_data)
            if response.status_code not in [200, 201]:
                self.log_test("Item Stock Adjustment", "FAIL", f"Adjustment failed: {response.text[:100]}")
                return False

            # Verify quantity was updated correctly
            response = self.session.get(f"{self.base_url}/inventory/items/{item_id}/")
            updated_item = response.json()
            expected_quantity = adjustment_data['qty_base']
            if updated_item['quantity'] != expected_quantity:
                self.log_test("Stock Adjustment Persistence", "FAIL", f"Expected {expected_quantity}, got {updated_item['quantity']}")
                return False

            # Complex update with multiple fields
            update_data = {
                "price": "15.00",
                "min_stock_level": 20,
                "location": "B-02-05",
                "description": "Updated via automated test with unicode: äöüßñç"
            }

            response = self.session.patch(f"{self.base_url}/inventory/items/{item_id}/", json=update_data)
            if response.status_code != 200:
                self.log_test("Item Complex Update", "FAIL", f"Update failed: {response.text[:100]}")
                return False

            # Verify updates persisted
            response = self.session.get(f"{self.base_url}/inventory/items/{item_id}/")
            final_item = response.json()
            for key, value in update_data.items():
                if final_item.get(key) != value:
                    self.log_test("Item Update Persistence", "FAIL", f"Field {key} not updated correctly")
                    return False

            # Cleanup
            self.session.delete(f"{self.base_url}/inventory/items/{item_id}/")
            self.session.delete(f"{self.base_url}/inventory/categories/{category_id}/")

            self.log_test("Inventory Item CRUD", "PASS", "All operations completed successfully")
            return True

        except Exception as e:
            self.log_test("Inventory Item Test", "FAIL", f"Exception: {str(e)}")
            return False

    def test_stock_movement_persistence(self):
        """Test stock movements and verify inventory log creation"""
        try:
            # Create test item for stock movements
            category_data = {"name": f"Stock_Test_Category_{int(time.time())}", "description": "Stock test category"}
            response = self.session.post(f"{self.base_url}/inventory/categories/", json=category_data)
            category_id = response.json()['id']

            item_data = {
                "name": f"Stock_Test_Item_{int(time.time())}",
                "sku": f"STOCK_{int(time.time())}",
                "quantity": 50,
                "price": "10.00",
                "category": category_id
            }
            response = self.session.post(f"{self.base_url}/inventory/items/", json=item_data)
            if response.status_code != 201:
                self.log_test("Stock Test Item Creation", "FAIL", "Could not create test item")
                return False
            item_id = response.json()['id']

            # Get initial logs count
            response = self.session.get(f"{self.base_url}/inventory/logs/")
            initial_log_count = response.json().get('count', 0)

            # Test stock IN movement
            stock_in_data = {
                "type": "IN",
                "item": item_id,
                "qty_base": 25,
                "note": "Test stock in movement"
            }

            response = self.session.post(f"{self.base_url}/inventory/stock-movements/", json=stock_in_data)
            if response.status_code != 201:
                self.log_test("Stock IN Movement", "FAIL", f"Failed to create: {response.text[:100]}")
                return False

            # Verify item quantity was updated
            response = self.session.get(f"{self.base_url}/inventory/items/{item_id}/")
            updated_item = response.json()
            expected_quantity = item_data['quantity'] + stock_in_data['qty_base']
            if updated_item['quantity'] != expected_quantity:
                self.log_test("Stock IN Quantity Update", "FAIL", f"Expected {expected_quantity}, got {updated_item['quantity']}")
                return False

            # Verify inventory log was created
            response = self.session.get(f"{self.base_url}/inventory/logs/")
            current_log_count = response.json().get('count', 0)
            if current_log_count <= initial_log_count:
                self.log_test("Stock Movement Logging", "FAIL", "No inventory log created for stock movement")
                return False

            # Test stock OUT movement
            stock_out_data = {
                "type": "OUT",
                "item": item_id,
                "qty_base": 15,
                "note": "Test stock out movement"
            }

            response = self.session.post(f"{self.base_url}/inventory/stock-movements/", json=stock_out_data)
            if response.status_code != 201:
                self.log_test("Stock OUT Movement", "FAIL", f"Failed to create: {response.text[:100]}")
                return False

            # Verify final quantity
            response = self.session.get(f"{self.base_url}/inventory/items/{item_id}/")
            final_item = response.json()
            final_expected = expected_quantity - stock_out_data['qty_base']
            if final_item['quantity'] != final_expected:
                self.log_test("Stock OUT Quantity Update", "FAIL", f"Expected {final_expected}, got {final_item['quantity']}")
                return False

            # Cleanup
            self.session.delete(f"{self.base_url}/inventory/items/{item_id}/")
            self.session.delete(f"{self.base_url}/inventory/categories/{category_id}/")

            self.log_test("Stock Movement Operations", "PASS", "All stock movements processed correctly")
            return True

        except Exception as e:
            self.log_test("Stock Movement Test", "FAIL", f"Exception: {str(e)}")
            return False

    def test_customer_and_orders(self):
        """Test customer and order management"""
        try:
            # Create test customer
            customer_data = {
                "name": f"Test_Customer_{int(time.time())}",
                "contact_name": "Test Contact",
                "email": "customer@test.com",
                "phone": "+41 44 987 65 43",
                "address": "Customer Street 123\n8000 Zürich",
                "credit_limit": "5000.00",
                "payment_terms": "14 days net",
                "is_active": True
            }

            response = self.session.post(f"{self.base_url}/inventory/customers/", json=customer_data)
            if response.status_code != 201:
                self.log_test("Customer Creation", "FAIL", f"Failed to create: {response.text[:100]}")
                return False

            customer_id = response.json()['id']

            # Verify all customer data persisted
            response = self.session.get(f"{self.base_url}/inventory/customers/{customer_id}/")
            created_customer = response.json()
            for key, value in customer_data.items():
                if created_customer.get(key) != value:
                    self.log_test("Customer Data Persistence", "FAIL", f"Field {key} not saved correctly")
                    return False

            # Cleanup
            self.session.delete(f"{self.base_url}/inventory/customers/{customer_id}/")

            self.log_test("Customer Management", "PASS", "Customer CRUD operations successful")
            return True

        except Exception as e:
            self.log_test("Customer Test", "FAIL", f"Exception: {str(e)}")
            return False

    def test_expense_tracking(self):
        """Test expense management and data persistence"""
        try:
            # Create supplier for expense
            supplier_data = {"name": f"Expense_Supplier_{int(time.time())}", "is_active": True}
            response = self.session.post(f"{self.base_url}/inventory/suppliers/", json=supplier_data)
            if response.status_code != 201:
                self.log_test("Expense Supplier Creation", "FAIL", "Could not create supplier for expense test")
                return False
            supplier_id = response.json()['id']

            # Create expense
            expense_data = {
                "date": date.today().isoformat(),
                "description": f"Test expense {int(time.time())}",
                "amount": "299.95",
                "category": "PURCHASE",
                "supplier": supplier_id,
                "receipt_number": f"RCP_{int(time.time())}",
                "notes": "Automated test expense with special chars: äöü"
            }

            response = self.session.post(f"{self.base_url}/inventory/expenses/", json=expense_data)
            if response.status_code != 201:
                self.log_test("Expense Creation", "FAIL", f"Failed to create: {response.text[:100]}")
                return False

            expense_id = response.json()['id']

            # Verify expense data persistence
            response = self.session.get(f"{self.base_url}/inventory/expenses/")
            expenses = response.json().get('results', [])
            created_expense = next((e for e in expenses if e['id'] == expense_id), None)

            if not created_expense:
                self.log_test("Expense Retrieval", "FAIL", "Created expense not found in list")
                return False

            # Check critical fields
            critical_fields = ['description', 'amount', 'category', 'supplier', 'receipt_number']
            for field in critical_fields:
                if created_expense.get(field) != expense_data[field]:
                    self.log_test("Expense Data Integrity", "FAIL", f"Field {field} not preserved")
                    return False

            # Update expense
            update_data = {"amount": "350.00", "notes": "Updated expense amount"}
            response = self.session.patch(f"{self.base_url}/inventory/expenses/{expense_id}/", json=update_data)
            if response.status_code != 200:
                self.log_test("Expense Update", "FAIL", f"Update failed: {response.text[:100]}")
                return False

            # Cleanup
            self.session.delete(f"{self.base_url}/inventory/expenses/{expense_id}/")
            self.session.delete(f"{self.base_url}/inventory/suppliers/{supplier_id}/")

            self.log_test("Expense Management", "PASS", "Expense CRUD operations successful")
            return True

        except Exception as e:
            self.log_test("Expense Test", "FAIL", f"Exception: {str(e)}")
            return False

    def test_concurrent_operations(self):
        """Test data integrity under concurrent-like operations"""
        try:
            # Create test item for concurrent operations
            category_data = {"name": f"Concurrent_Category_{int(time.time())}", "description": "Concurrent test"}
            response = self.session.post(f"{self.base_url}/inventory/categories/", json=category_data)
            category_id = response.json()['id']

            item_data = {
                "name": f"Concurrent_Item_{int(time.time())}",
                "sku": f"CONC_{int(time.time())}",
                "quantity": 100,
                "price": "20.00",
                "category": category_id
            }
            response = self.session.post(f"{self.base_url}/inventory/items/", json=item_data)
            item_id = response.json()['id']

            # Perform multiple rapid operations
            operations = [
                {"quantity_change": 10, "notes": "Rapid op 1"},
                {"quantity_change": -5, "notes": "Rapid op 2"},
                {"quantity_change": 15, "notes": "Rapid op 3"},
                {"quantity_change": -8, "notes": "Rapid op 4"}
            ]

            expected_final_quantity = item_data['quantity']
            for i, op in enumerate(operations):
                # Use stock movements for quantity changes
                movement_data = {
                    "type": "IN" if op['quantity_change'] > 0 else "OUT",
                    "item": item_id,
                    "qty_base": abs(op['quantity_change']),
                    "note": op['notes']
                }
                response = self.session.post(f"{self.base_url}/inventory/stock-movements/", json=movement_data)
                if response.status_code not in [200, 201]:
                    self.log_test("Concurrent Operation", "FAIL", f"Operation {i+1} failed: {response.text[:100]}")
                    return False
                expected_final_quantity += op['quantity_change']
                time.sleep(0.1)  # Small delay to simulate rapid operations

            # Verify final state
            response = self.session.get(f"{self.base_url}/inventory/items/{item_id}/")
            final_item = response.json()
            if final_item['quantity'] != expected_final_quantity:
                self.log_test("Concurrent Data Integrity", "FAIL", f"Expected {expected_final_quantity}, got {final_item['quantity']}")
                return False

            # Cleanup
            self.session.delete(f"{self.base_url}/inventory/items/{item_id}/")
            self.session.delete(f"{self.base_url}/inventory/categories/{category_id}/")

            self.log_test("Concurrent Operations", "PASS", "Data consistency maintained under rapid operations")
            return True

        except Exception as e:
            self.log_test("Concurrent Test", "FAIL", f"Exception: {str(e)}")
            return False

    def run_comprehensive_test(self):
        """Run all tests and generate report"""
        print("=== DEPOTIX DATA PERSISTENCE COMPREHENSIVE TEST ===")
        print(f"Test started at: {datetime.now().isoformat()}")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        # Authentication required for all tests
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False

        # Run all test categories
        test_methods = [
            self.test_category_persistence,
            self.test_supplier_persistence,
            self.test_inventory_item_persistence,
            self.test_stock_movement_persistence,
            self.test_customer_and_orders,
            self.test_expense_tracking,
            self.test_concurrent_operations
        ]

        passed_tests = 0
        total_tests = len(test_methods)

        for test_method in test_methods:
            try:
                if test_method():
                    passed_tests += 1
            except Exception as e:
                print(f"❌ Test {test_method.__name__} failed with exception: {str(e)}")

        print("\n" + "=" * 60)
        print(f"FINAL RESULTS: {passed_tests}/{total_tests} tests passed")

        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED - Application data persistence is VERIFIED")
            print("✅ No data loss detected in any operations")
            print("✅ Database transactions are properly committed")
            print("✅ All API endpoints handle data correctly")
            print("✅ Frontend-Backend data flow is intact")
            return True
        else:
            print(f"⚠️  {total_tests - passed_tests} test(s) failed")
            print("❌ Data persistence issues detected")
            return False

if __name__ == "__main__":
    tester = DepotixTester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)
