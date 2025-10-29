#!/usr/bin/env python3
"""
Test script to verify stock reversal on deletion of StockMovements and Invoices
"""
import requests
import json

API_BASE = "https://depotix.ch/api"

def get_auth_token():
    """Get authentication token"""
    username = input("Enter username for testing: ")
    password = input("Enter password: ")

    response = requests.post(
        f"{API_BASE}/token/",
        json={"username": username, "password": password}
    )

    if response.status_code != 200:
        print(f"❌ Login failed: {response.text}")
        return None

    return response.json()['access']

def test_stock_movement_deletion(token):
    """Test that deleting a StockMovement reverses the stock change"""

    print("\n" + "="*70)
    print("Test 1: StockMovement Deletion - Stock Reversal")
    print("="*70 + "\n")

    headers = {"Authorization": f"Bearer {token}"}

    # Step 1: Get an item to work with
    print("Step 1: Fetching inventory items...")
    items_response = requests.get(f"{API_BASE}/inventory/items/", headers=headers)

    if items_response.status_code != 200:
        print(f"❌ Failed to fetch items: {items_response.text}")
        return False

    items = items_response.json()
    if not items or len(items) == 0:
        print("❌ No items found in inventory")
        return False

    # Use first item
    item = items[0]
    item_id = item['id']
    item_name = item['name']
    initial_palette_qty = item['palette_quantity']
    initial_verpackung_qty = item['verpackung_quantity']

    print(f"✓ Using item: {item_name} (ID: {item_id})")
    print(f"  Initial stock - Paletten: {initial_palette_qty}, Verpackungen: {initial_verpackung_qty}")

    # Step 2: Create a stock IN movement
    print("\nStep 2: Creating stock IN movement (adding 5 Verpackungen)...")

    stock_in_data = {
        "item": item_id,
        "type": "IN",
        "unit": "verpackung",
        "quantity": 5,
        "note": "Test stock in for deletion test"
    }

    stock_response = requests.post(
        f"{API_BASE}/inventory/stock-movements/",
        headers=headers,
        json=stock_in_data
    )

    if stock_response.status_code not in [200, 201]:
        print(f"❌ Failed to create stock movement: {stock_response.text}")
        return False

    stock_movement = stock_response.json()
    stock_movement_id = stock_movement['id']
    print(f"✓ Stock movement created (ID: {stock_movement_id})")

    # Step 3: Verify stock increased
    print("\nStep 3: Verifying stock increased...")
    item_response = requests.get(f"{API_BASE}/inventory/items/{item_id}/", headers=headers)

    if item_response.status_code != 200:
        print(f"❌ Failed to fetch item: {item_response.text}")
        return False

    item_after_in = item_response.json()
    after_palette_qty = item_after_in['palette_quantity']
    after_verpackung_qty = item_after_in['verpackung_quantity']

    print(f"✓ Stock after IN movement:")
    print(f"  Paletten: {initial_palette_qty} -> {after_palette_qty}")
    print(f"  Verpackungen: {initial_verpackung_qty} -> {after_verpackung_qty}")

    # Calculate total verpackungen
    vpk = item_after_in.get('verpackungen_pro_palette', 1)
    initial_total = (initial_palette_qty * vpk) + initial_verpackung_qty
    after_total = (after_palette_qty * vpk) + after_verpackung_qty

    if after_total != initial_total + 5:
        print(f"❌ Stock didn't increase correctly! Expected +5, got +{after_total - initial_total}")
        return False

    print(f"✓ Stock correctly increased by 5 Verpackungen")

    # Step 4: Delete the stock movement
    print(f"\nStep 4: Deleting stock movement (ID: {stock_movement_id})...")
    delete_response = requests.delete(
        f"{API_BASE}/inventory/stock-movements/{stock_movement_id}/",
        headers=headers
    )

    if delete_response.status_code not in [200, 204]:
        print(f"❌ Failed to delete stock movement: {delete_response.text}")
        return False

    print(f"✓ Stock movement deleted")

    # Step 5: Verify stock was reversed
    print("\nStep 5: Verifying stock was reversed to original...")
    item_response_final = requests.get(f"{API_BASE}/inventory/items/{item_id}/", headers=headers)

    if item_response_final.status_code != 200:
        print(f"❌ Failed to fetch item: {item_response_final.text}")
        return False

    item_final = item_response_final.json()
    final_palette_qty = item_final['palette_quantity']
    final_verpackung_qty = item_final['verpackung_quantity']
    final_total = (final_palette_qty * vpk) + final_verpackung_qty

    print(f"  Final stock - Paletten: {final_palette_qty}, Verpackungen: {final_verpackung_qty}")
    print(f"  Initial total: {initial_total}, Final total: {final_total}")

    if final_total == initial_total:
        print(f"✓ Stock correctly reversed to original quantity!")
        return True
    else:
        print(f"❌ Stock reversal failed! Difference: {final_total - initial_total}")
        return False

def main():
    print("\n" + "="*70)
    print("Stock Reversal on Deletion Test Suite")
    print("="*70)

    # Get authentication token
    token = get_auth_token()
    if not token:
        return

    # Run tests
    test1_passed = test_stock_movement_deletion(token)

    # Summary
    print("\n" + "="*70)
    print("Test Summary")
    print("="*70)
    print(f"Test 1 (StockMovement Deletion): {'✓ PASSED' if test1_passed else '❌ FAILED'}")

    if test1_passed:
        print("\n✓ All tests passed! Stock reversal on deletion works correctly.")
    else:
        print("\n❌ Some tests failed. Please check the implementation.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest cancelled by user.")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
