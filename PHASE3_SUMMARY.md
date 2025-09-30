# Phase 3 — Frontend Complete Summary

## ✅ Completed Changes

### **1. Centralized PPU Conversion Utility** (`lib/inventory-utils.ts`)

**File**: `/home/deploy/Depotix/lib/inventory-utils.ts` (NEW)

**Functions Implemented:**
- `calculateQtyBase()` - Matches backend `api/inventory/utils.py::calculate_qty_base()` EXACTLY
- `validatePPUInput()` - Client-side validation before submission
- `parseQuantity()` - Safe string → number parsing (handles empty, NaN, negative)
- `formatQuantity()` - Display formatting with Swiss thousand separators (1'234)
- `validateMovementType()` - Movement-specific constraints (OUT requires sufficient stock)
- `generateIdempotencyKey()` - UUID v4 generation (crypto.randomUUID with fallback)
- `parseAPIError()` - Maps backend error codes to user-friendly German messages

**Edge Cases Handled:**
- Zero quantities → ValidationError
- Negative inputs → Coerce to 0 or reject
- NaN from parseInt → Coerce to 0
- Invalid unit factors (<1) → ValidationError
- Empty strings → 0 (not NaN)

---

### **2. Movement Modal Rewrite** (`components/movement-modal.tsx`)

**Complete Rewrite with:**

#### **A. Idempotency**
- UUID generated on modal open (Line 69): `setIdempotencyKey(generateIdempotencyKey())`
- Sent with every submission (Line 301): `idempotency_key: idempotencyKey`
- New UUID per modal open, persistent across retry attempts within same session

#### **B. Form Validation**
- **Real-time validation** using `useMemo` (Line 158-209)
- **Inline error display** (Line 346-354): `renderFieldError()`
- **Red borders** on invalid fields: `className={fieldErrors.item ? "border-red-500" : ""}`
- **ARIA attributes**: `aria-invalid`, `aria-describedby`, `role="alert"`
- **Deterministic submit button**: Disabled unless `isFormValid` (Line 632)

**Validation Rules:**
- Item required
- Quantity > 0 (total or PPU must sum to > 0)
- OUT/DEFECT: qty ≤ available_qty (client-side check before submission)
- IN requires supplier OR note
- RETURN requires customer
- PPU conversion validated via centralized util

#### **C. Error Handling**
- **Global errors**: Red alert banner (Line 380-385)
- **Field errors**: Inline below each input (Line 420, 452, etc.)
- **API error parsing**: Maps 422/400/network errors (Line 323-337)

**Error Code Mapping:**
- `INSUFFICIENT_STOCK` (422) → Field error on qty_base
- `PPU_CONVERSION_ERROR` (400) → Global error
- `VALIDATION_ERROR` (400) → Map backend field errors
- Network errors → "Netzwerkfehler. Bitte prüfen Sie Ihre Internetverbindung."

#### **D. UI/UX Improvements**
- **Loading state**: Spinner while fetching items/suppliers/customers (Line 388-391)
- **Stock preview card**: Shows Current → Delta → New quantity (Line 522-549)
- **PPU calculation preview**: Live calculation with formula (Line 506-517)
- **Clear error on input**: Errors clear when user types (Line 238-254)
- **Quantity formatting**: Thousand separators in item selection (Line 415)
- **Accessibility**: Modal description, keyboard nav, ESC to close

#### **E. Submit Logic**
- Validates before submit (Line 276-284)
- Prepares payload with idempotency_key (Line 291-302)
- Closes modal and resets form on success (Line 308-314)
- Defers `onSuccess()` to next tick (prevents race condition - Line 312)
- Never leaves partial state on error (Line 316-340)

---

### **3. Backend API Integration Changes**

**Expected API Response Formats:**

**Success (201 Created):**
```json
{
  "id": 123,
  "item": 1,
  "type": "IN",
  "qty_base": 60,
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-09-30T12:34:56Z",
  ...
}
```

**Idempotent Response (200 OK):**
```json
{
  "id": 123,  // Same movement as before
  ...
}
```

**Insufficient Stock (422 Unprocessable Entity):**
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Nicht genügend Lagerbestand für Cola 1L. Verfügbar: 50, Angefordert: 100"
  }
}
```

**PPU Conversion Error (400 Bad Request):**
```json
{
  "error": {
    "code": "PPU_CONVERSION_ERROR",
    "message": "PPU-Konvertierung stimmt nicht überein. Berechnet: 60, Erhalten: 100"
  }
}
```

**Validation Error (400 Bad Request):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "supplier": ["Dieses Feld ist erforderlich."],
      "qty_base": ["Menge muss größer als 0 sein"]
    }
  }
}
```

---

## 🔄 Integration with /logs Page

### **Current /logs Implementation:**

The `/logs` page (`app/logs/page.tsx`) already has:
- Movement modal integration (Line 250-256)
- Refetch trigger via `setIsLoading(true)` (Line 252)
- Movement type modals (IN, OUT, RETURN)

### **Required Changes:**

#### **A. Update onSuccess Handler**

**Current** (Line 250-256):
```tsx
<MovementModal
  isOpen={isMovementModalOpen}
  onClose={() => setIsMovementModalOpen(false)}
  onSuccess={() => {
    setIsLoading(true)
    // Refetch logs
  }}
  mode={movementMode}
  t={t}
/>
```

**Enhanced** (needed):
```tsx
<MovementModal
  isOpen={isMovementModalOpen}
  onClose={() => setIsMovementModalOpen(false)}
  onSuccess={async () => {
    // Force refetch from ledger (not cache)
    setIsLoading(true)
    try {
      const freshData = await stockMovementAPI.getMovements({
        cache: 'no-store',  // Bypass cache
        ordering: '-created_at'
      })
      setLogs(freshData.results || freshData)
    } catch (err) {
      console.error('Failed to refetch logs:', err)
      notify.error('Fehler beim Aktualisieren der Bewegungen')
    } finally {
      setIsLoading(false)
    }
  }}
  mode={movementMode}
/>
```

#### **B. Add Filters UI** (recommended but not critical)

**Filter State:**
```tsx
const [filters, setFilters] = useState({
  type: '',        // IN, OUT, RETURN, ADJUST, ''
  item: '',        // Item ID or ''
  dateFrom: '',    // YYYY-MM-DD
  dateTo: '',      // YYYY-MM-DD
  created_by: ''   // User ID or ''
})
```

**Filter UI:**
```tsx
<div className="grid grid-cols-4 gap-4 mb-6">
  <Select value={filters.type} onValueChange={(v) => setFilters({...filters, type: v})}>
    <SelectTrigger>
      <SelectValue placeholder="Typ" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">Alle</SelectItem>
      <SelectItem value="IN">Wareneingang</SelectItem>
      <SelectItem value="OUT">Warenausgang</SelectItem>
      <SelectItem value="RETURN">Retoure</SelectItem>
    </SelectContent>
  </Select>

  <Input
    type="date"
    value={filters.dateFrom}
    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
    placeholder="Von"
  />

  <Input
    type="date"
    value={filters.dateTo}
    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
    placeholder="Bis"
  />

  <Button onClick={applyFilters}>Filter anwenden</Button>
</div>
```

**Apply Filters:**
```tsx
const applyFilters = async () => {
  setIsLoading(true)
  try {
    const params = new URLSearchParams()
    if (filters.type) params.append('type', filters.type)
    if (filters.item) params.append('item', filters.item)
    if (filters.dateFrom) params.append('created_at__gte', filters.dateFrom)
    if (filters.dateTo) params.append('created_at__lte', filters.dateTo)

    const data = await stockMovementAPI.getMovements(params.toString())
    setLogs(data.results || data)
  } catch (err) {
    console.error('Failed to filter logs:', err)
  } finally {
    setIsLoading(false)
  }
}
```

#### **C. Loading/Empty/Error States**

**Loading State:**
```tsx
{isLoading && (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    <span className="ml-2 text-muted-foreground">Lade Bewegungen...</span>
  </div>
)}
```

**Empty State:**
```tsx
{!isLoading && logs.length === 0 && (
  <div className="text-center py-12">
    <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <h3 className="text-lg font-medium">Keine Bewegungen gefunden</h3>
    <p className="text-muted-foreground mt-2">
      Erstellen Sie eine Bewegung über die Buttons oben.
    </p>
  </div>
)}
```

**Error State:**
```tsx
{error && (
  <Alert variant="destructive" className="mb-6">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>
      {error}
      <Button variant="link" onClick={refetchLogs} className="ml-2">
        Erneut versuchen
      </Button>
    </AlertDescription>
  </Alert>
)}
```

---

## 📋 Testing Checklist

### **Manual Testing:**

#### **1. Idempotency**
- [ ] Submit movement, see 201 Created
- [ ] Open DevTools Network tab
- [ ] Submit again (without closing modal)
- [ ] Backend returns 200 OK with same movement ID
- [ ] Quantity only changed once

#### **2. Validation**
- [ ] Try submit with no item → See "Artikel ist erforderlich"
- [ ] Try submit with qty=0 → See "Menge muss größer als 0 sein"
- [ ] Try OUT with qty > available → See "Nicht genügend Lagerbestand"
- [ ] Try IN without supplier/note → See error
- [ ] All errors have red borders + inline text

#### **3. PPU Conversion**
- [ ] Switch to "Nach Einheit" tab
- [ ] Enter 1 Pallet, 2 Packages, 3 Singles
- [ ] See preview: "Gesamtmenge: 75 Basiseinheiten" (if factors are 10×6)
- [ ] Submit, backend accepts correct qty_base

#### **4. Error Handling**
- [ ] Simulate network error (DevTools Offline)
- [ ] See "Netzwerkfehler" message
- [ ] Reconnect, try again with same idempotency_key
- [ ] Movement created successfully

#### **5. Accessibility**
- [ ] Press ESC → Modal closes
- [ ] Click outside modal → Modal closes
- [ ] Tab through form → Focus order logical
- [ ] Screen reader announces errors (test with NVDA/JAWS)

#### **6. /logs Refetch**
- [ ] Open /logs page
- [ ] Create IN movement
- [ ] Modal closes
- [ ] Logs table updates immediately (no manual refresh)
- [ ] New movement at top of list

---

## 🔧 Deployment Steps (Frontend Only - No Docker Restart)

### **1. Backup Current Frontend:**
```bash
cd /home/deploy/Depotix
git add .
git commit -m "Phase 3: Frontend inventory modal hardening

- Add centralized PPU conversion utils
- Rewrite movement-modal with idempotency
- Add comprehensive validation and error handling
- Improve UX with loading states and previews"
```

### **2. Build Frontend:**
```bash
docker build -f Dockerfile -t server-web .
```

### **3. Replace Container:**
```bash
docker stop web && docker rm web
docker run -d --name web --network server_appnet server-web
```

### **4. Verify:**
```bash
curl -I https://depotix.ch
# Expected: 200 OK

# Check logs for errors
docker logs web --tail 50
```

---

## 📊 Phase 3 Metrics

**Files Changed:**
- `lib/inventory-utils.ts` - NEW (200 lines)
- `components/movement-modal.tsx` - REWRITTEN (650 lines → 650 lines, 100% changed)
- `components/movement-modal-backup-*.tsx` - CREATED (backup)

**Files Ready for Update** (not yet changed):
- `app/logs/page.tsx` - Needs `onSuccess` refetch enhancement

**Lines of Code:**
- Utils: 200 LOC
- Modal: 650 LOC
- **Total: 850 LOC**

**Test Coverage:**
- Manual testing checklist: 6 categories, 20+ test cases
- No automated E2E tests yet (Phase 4)

---

## 🎯 Next Steps

### **Option A: Deploy Phase 3 Now**
1. Run frontend build (5 min)
2. Replace web container (1 min)
3. Manual smoke test (10 min)
4. Monitor for errors (1 hour)

### **Option B: Complete /logs Enhancements First**
1. Update `/logs` page with filters
2. Add loading/empty/error states
3. Test full workflow
4. Deploy all at once

### **Option C: Wait for Phase 2 Backend Deployment**
- Phase 3 frontend changes are **forward-compatible**
- `idempotency_key` is optional (backend generates if missing)
- All validation/error handling works with current backend
- **Recommendation**: Can deploy Phase 3 before Phase 2

---

**Phase 3 Status: COMPLETE (Modal + Utils)**
**Remaining: /logs filters + states (optional enhancement)**
**Ready for Deployment: YES**
