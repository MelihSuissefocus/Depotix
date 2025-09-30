# Phase 2 Rollback Plan

## Overview
This document describes the rollback procedure for Phase 2 changes (Database & Server Logic Hardening). All changes are backwards-compatible and can be rolled back without data loss.

## Rollback Scenarios

### Scenario 1: Migration Fails During Application
**Symptoms:**
- Migration 0008_add_idempotency_and_constraints fails with constraint violations
- Database reports CHECK constraint violations

**Rollback Steps:**
```bash
# 1. SSH to server
ssh deploy@91.98.136.168

# 2. Navigate to project
cd /home/deploy/Depotix

# 3. Rollback migration
docker exec -it api python manage.py migrate inventory 0007_populate_customer_numbers

# 4. Verify rollback
docker exec -it api python manage.py showmigrations inventory
```

**Expected Result:**
- Migration 0008 is unapplied
- Database constraints removed
- idempotency_key field removed from inventory_stockmovement

---

### Scenario 2: Application Crashes After Deployment
**Symptoms:**
- API container won't start
- Django import errors or module not found

**Rollback Steps:**
```bash
# 1. Revert code changes with git
cd /home/deploy/Depotix
git log --oneline -10  # Find commit hash before Phase 2
git revert <commit-hash> --no-edit

# 2. Rebuild API container
docker build -t server-api /home/deploy/Depotix/api/

# 3. Stop and replace container
docker stop api && docker rm api
docker run -d --name api --network server_appnet -p 8000:8000 \
  -e DJANGO_SETTINGS_MODULE=depotix_api.settings \
  -e DATABASE_URL="postgres://depotix:4Y__dBU85RFg1EnsPPJCjFSY-8D0zQv4UY9qDUcHYY0@server-postgres-1:5432/depotix" \
  server-api

# 4. Rollback migration (if already applied)
docker exec -it api python manage.py migrate inventory 0007_populate_customer_numbers

# 5. Verify API is healthy
curl -I https://api.depotix.ch/healthz
```

---

### Scenario 3: Idempotency Logic Causes Issues
**Symptoms:**
- Movements not being created
- 200 OK responses for new movements (false idempotency matches)

**Quick Fix (without full rollback):**
```bash
# Disable idempotency check temporarily in views.py
# Comment out lines 196-208 in /home/deploy/Depotix/api/inventory/views.py

docker exec -it api bash
cd /app
vi inventory/views.py  # Or use nano/sed to comment out idempotency check

# Restart API container
docker restart api
```

**Full Rollback:**
Follow Scenario 2 steps.

---

### Scenario 4: Negative Stock Still Occurs
**Symptoms:**
- Items show negative quantities
- CHECK constraint not working

**Investigation:**
```bash
# Check if constraint is active
docker exec server-postgres-1 psql -U depotix -d depotix -c "\d inventory_inventoryitem"

# Should show:
# Check constraints:
#     "inventory_inventoryitem_quantity_non_negative" CHECK (quantity >= 0)

# Find items with negative quantity
docker exec server-postgres-1 psql -U depotix -d depotix -c \
  "SELECT id, name, quantity FROM inventory_inventoryitem WHERE quantity < 0;"
```

**Fix:**
```sql
-- Correct negative quantities
UPDATE inventory_inventoryitem SET quantity = 0 WHERE quantity < 0;
```

**If constraint missing:**
```bash
# Re-apply migration
docker exec -it api python manage.py migrate inventory 0008_add_idempotency_and_constraints
```

---

## Data Preservation

### Before Rollback: Backup Database
```bash
# Create backup
docker exec server-postgres-1 pg_dump -U depotix depotix > \
  /home/deploy/backups/depotix_before_rollback_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh /home/deploy/backups/
```

### After Rollback: Verify Data Integrity
```bash
# Count movements
docker exec server-postgres-1 psql -U depotix -d depotix -c \
  "SELECT COUNT(*) FROM inventory_stockmovement;"

# Check for orphaned movements (shouldn't exist)
docker exec server-postgres-1 psql -U depotix -d depotix -c \
  "SELECT COUNT(*) FROM inventory_stockmovement WHERE item_id NOT IN (SELECT id FROM inventory_inventoryitem);"

# Verify inventory quantities are positive
docker exec server-postgres-1 psql -U depotix -d depotix -c \
  "SELECT COUNT(*) FROM inventory_inventoryitem WHERE quantity < 0;"
```

---

## File Rollback Checklist

If doing manual file rollback (not using git revert):

### Files to Revert:
- [ ] `/home/deploy/Depotix/api/inventory/migrations/0008_add_idempotency_and_constraints.py` - DELETE
- [ ] `/home/deploy/Depotix/api/inventory/models.py` - REVERT idempotency_key field addition
- [ ] `/home/deploy/Depotix/api/inventory/utils.py` - DELETE (new file)
- [ ] `/home/deploy/Depotix/api/inventory/exceptions.py` - REVERT IdempotencyConflictError, PPUConversionError
- [ ] `/home/deploy/Depotix/api/inventory/serializers.py` - REVERT idempotency_key field
- [ ] `/home/deploy/Depotix/api/inventory/views.py` - REVERT perform_create() to original

### Test Files (optional to delete):
- `/home/deploy/Depotix/api/inventory/tests/test_utils.py`
- `/home/deploy/Depotix/api/inventory/tests/test_stock_movement_integration.py`

---

## Verification After Rollback

### 1. Check API Health
```bash
curl https://api.depotix.ch/healthz
# Expected: 200 OK
```

### 2. Test Movement Creation
```bash
# Use curl or Postman to create a movement
curl -X POST https://api.depotix.ch/api/inventory/stock-movements/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item": 1,
    "type": "IN",
    "qty_base": 10
  }'

# Expected: 201 Created
```

### 3. Verify Database Schema
```bash
docker exec server-postgres-1 psql -U depotix -d depotix -c "\d inventory_stockmovement"

# Should NOT show idempotency_key field after rollback
```

---

## Contact & Escalation

**If rollback fails:**
1. Check logs: `docker logs api --tail 100`
2. Check database connectivity: `docker exec server-postgres-1 pg_isready`
3. Verify network: `docker network inspect server_appnet`
4. Last resort: Restore from pre-Phase-2 backup

**Support Info:**
- Database password: `4Y__dBU85RFg1EnsPPJCjFSY-8D0zQv4UY9qDUcHYY0`
- Server IP: `91.98.136.168`
- PostgreSQL Port: `5432`

---

## Post-Rollback Actions

After successful rollback:

1. **Document Issue:**
   - What failed?
   - Error messages
   - Reproduction steps

2. **Notify Team:**
   - Phase 2 rolled back
   - Timeline for re-attempt
   - Required fixes

3. **Plan Re-Deployment:**
   - Fix identified issues
   - Re-test in staging
   - Schedule new deployment window

---

**Last Updated:** 2025-09-30
**Tested:** No (create test environment to validate rollback before production deployment)
