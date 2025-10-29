#!/usr/bin/env python3
"""
Test script to verify concurrent login prevention
"""
import requests
import json

API_BASE = "https://depotix.ch/api"

def test_concurrent_login():
    """Test that logging in from a second device invalidates the first session"""

    # Test credentials (adjust as needed)
    username = input("Enter username for testing: ")
    password = input("Enter password: ")

    print("\n" + "="*60)
    print("Testing Concurrent Login Prevention")
    print("="*60 + "\n")

    # Step 1: First login
    print("Step 1: Logging in as user from Device 1...")
    response1 = requests.post(
        f"{API_BASE}/token/",
        json={"username": username, "password": password}
    )

    if response1.status_code != 200:
        print(f"❌ Login failed: {response1.text}")
        return

    tokens1 = response1.json()
    token1 = tokens1['access']
    session_key1 = tokens1.get('session_key', 'N/A')
    print(f"✓ Device 1 logged in successfully")
    print(f"  Session Key: {session_key1[:8]}...")
    print(f"  Access Token: {token1[:20]}...\n")

    # Step 2: Verify first session works
    print("Step 2: Testing Device 1 session...")
    response_test1 = requests.get(
        f"{API_BASE}/inventory/users/me/",
        headers={"Authorization": f"Bearer {token1}"}
    )

    if response_test1.status_code == 200:
        user_data = response_test1.json()
        print(f"✓ Device 1 can access API")
        print(f"  Username: {user_data['username']}\n")
    else:
        print(f"❌ Device 1 cannot access API: {response_test1.text}\n")
        return

    # Step 3: Second login (should invalidate first session)
    print("Step 3: Logging in from Device 2 (concurrent login)...")
    response2 = requests.post(
        f"{API_BASE}/token/",
        json={"username": username, "password": password}
    )

    if response2.status_code != 200:
        print(f"❌ Second login failed: {response2.text}")
        return

    tokens2 = response2.json()
    token2 = tokens2['access']
    session_key2 = tokens2.get('session_key', 'N/A')
    print(f"✓ Device 2 logged in successfully")
    print(f"  Session Key: {session_key2[:8]}...")
    print(f"  Access Token: {token2[:20]}...\n")

    # Step 4: Verify second session works
    print("Step 4: Testing Device 2 session...")
    response_test2 = requests.get(
        f"{API_BASE}/inventory/users/me/",
        headers={"Authorization": f"Bearer {token2}"}
    )

    if response_test2.status_code == 200:
        print(f"✓ Device 2 can access API\n")
    else:
        print(f"❌ Device 2 cannot access API: {response_test2.text}\n")
        return

    # Step 5: Verify first session is invalidated
    print("Step 5: Testing if Device 1 session was invalidated...")
    response_test1_again = requests.get(
        f"{API_BASE}/inventory/users/me/",
        headers={"Authorization": f"Bearer {token1}"}
    )

    if response_test1_again.status_code == 401:
        error_data = response_test1_again.json()
        print(f"✓ Device 1 session was correctly invalidated!")
        print(f"  Status: 401 Unauthorized")
        print(f"  Error code: {error_data.get('code', 'N/A')}")
        print(f"  Message: {error_data.get('detail', 'N/A')}\n")
    else:
        print(f"❌ Device 1 session is still active (this should NOT happen!)")
        print(f"  Status: {response_test1_again.status_code}\n")
        return

    # Step 6: Verify second session still works
    print("Step 6: Confirming Device 2 session still works...")
    response_final = requests.get(
        f"{API_BASE}/inventory/users/me/",
        headers={"Authorization": f"Bearer {token2}"}
    )

    if response_final.status_code == 200:
        print(f"✓ Device 2 session still active\n")
    else:
        print(f"❌ Device 2 session no longer works: {response_final.text}\n")
        return

    print("\n" + "="*60)
    print("✓ All tests passed! Concurrent login prevention works correctly.")
    print("="*60 + "\n")

    print("Summary:")
    print("  • When a user logs in from Device 2")
    print("  • The session on Device 1 is automatically terminated")
    print("  • Device 1 receives a 401 error with 'session_terminated' code")
    print("  • Only the most recent login remains active")

if __name__ == "__main__":
    try:
        test_concurrent_login()
    except KeyboardInterrupt:
        print("\n\nTest cancelled by user.")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
