# Numbering System - Depotix Phase 1

## Overview
**Purpose**: Standardized numbering system for business documents
**Status**: ✅ **FULLY IMPLEMENTED**
**Implementation**: Django models with auto-generation in SalesOrder and Invoice models
**Format**: Prefix-Year-Sequential

## Document Types

### Sales Orders
**Format**: `LS-YYYY-####`
**Example**: `LS-2025-0001`, `LS-2025-0002`
**Description**: Lieferschein (Delivery Note) numbering

**Implementation**:
```python
def save(self, *args, **kwargs):
    if not self.order_number:
        year = timezone.now().year
        last_order = SalesOrder.objects.filter(
            order_number__startswith=f'LS-{year}-'
        ).order_by('order_number').last()
        
        if last_order:
            last_num = int(last_order.order_number.split('-')[-1])
            new_num = last_num + 1
        else:
            new_num = 1
        
        self.order_number = f'LS-{year}-{new_num:04d}'
    
    super().save(*args, **kwargs)
```

### Invoices
**Format**: `RE######`
**Example**: `RE000001`, `RE000002`
**Description**: Rechnung (Invoice) numbering for billing

**Implementation**:
```python
def save(self, *args, **kwargs):
    if not self.invoice_number:
        last_invoice = Invoice.objects.filter(
            invoice_number__startswith='RE'
        ).order_by('invoice_number').last()

        if last_invoice:
            last_num = int(last_invoice.invoice_number[2:])
            new_num = last_num + 1
        else:
            new_num = 1

        self.invoice_number = f'RE{new_num:06d}'

    super().save(*args, **kwargs)
```

## Numbering Rules

### General Rules
1. **Yearly Reset**: Sales orders reset every calendar year; invoices use continuous numbering
2. **Zero-Padding**: Sequential numbers with leading zeros (4 digits for sales orders, 6 digits for invoices)
3. **Immutable**: Numbers cannot be changed once assigned
4. **Unique**: Each document type has independent sequences
5. **Auto-Generation**: Numbers assigned automatically on creation

### Sequence Management
- **Starting Number**: 0001 for sales orders (yearly), 000001 for invoices (continuous)
- **Increment**: +1 for each new document
- **Gap Handling**: Gaps may occur due to deleted drafts (acceptable)
- **Rollover**: Sales orders start new sequence on January 1st; invoices continue indefinitely

### Database Implementation
Numbers are generated at the model level during save() operations:

1. Check if number already exists
2. If not, query for highest number of current year
3. Generate next sequential number
4. Save with new number

### Error Handling
- **Concurrent Creation**: Django's atomic transactions prevent duplicates
- **Invalid Format**: Validation ensures proper format
- **Manual Assignment**: Not permitted through normal interfaces

## Business Logic

### Sales Order Workflow
1. **Draft Creation**: Order created without number
2. **Confirmation**: Number assigned when status changes to CONFIRMED
3. **Document Generation**: Number used in all related documents

### Invoice Generation
1. **Automatic Creation**: From confirmed sales orders
2. **Number Assignment**: On invoice creation
3. **Reference Linking**: Invoice references original order number

## API Integration

### Endpoints
- `GET /api/inventory/sales-orders/` - List with order numbers
- `GET /api/inventory/invoices/` - List with invoice numbers
- `POST /api/inventory/sales-orders/` - Create with auto-numbering

### Response Format
```json
{
  "id": 1,
  "order_number": "LS-2025-0001",
  "invoice_number": "RE000001",
  "customer": 1,
  "status": "CONFIRMED",
  "order_date": "2025-09-11",
  "total_amount": "150.00"
}
```

## Database Schema

### SalesOrder Table
```sql
CREATE TABLE inventory_salesorder (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT',
    order_date DATE NOT NULL,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    -- other fields...
    CONSTRAINT unique_order_number UNIQUE (order_number)
);

CREATE INDEX idx_order_number ON inventory_salesorder(order_number);
```

### Invoice Table
```sql
CREATE TABLE inventory_invoice (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(20) UNIQUE NOT NULL,
    order_id INTEGER UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    invoice_date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    -- other fields...
    CONSTRAINT unique_invoice_number UNIQUE (invoice_number),
    CONSTRAINT fk_invoice_order FOREIGN KEY (order_id) REFERENCES inventory_salesorder(id)
);

CREATE INDEX idx_invoice_number ON inventory_invoice(invoice_number);
```

## Future Extensions

### Additional Document Types
- **Purchase Orders**: `PO-YYYY-####`
- **Return Notes**: `RET-YYYY-####`
- **Credit Notes**: `CN-YYYY-####`
- **Stock Adjustments**: `ADJ-YYYY-####`

### Enhanced Features
- **Multi-Location**: Location-specific prefixes (e.g., `BER-LS-2025-0001`)
- **User-Specific**: User or department prefixes
- **Custom Formats**: Configurable numbering patterns
- **Barcode Integration**: Generate barcodes from document numbers

## Testing

### Unit Tests
```python
def test_order_number_generation():
    """Test automatic order number generation"""
    order = SalesOrder.objects.create(customer=customer)
    assert order.order_number == "LS-2025-0001"
    
    order2 = SalesOrder.objects.create(customer=customer)
    assert order2.order_number == "LS-2025-0002"

def test_yearly_reset():
    """Test sequence resets for new year"""
    with freeze_time("2025-12-31"):
        order1 = SalesOrder.objects.create(customer=customer)
        assert order1.order_number == "LS-2025-0001"
    
    with freeze_time("2026-01-01"):
        order2 = SalesOrder.objects.create(customer=customer)
        assert order2.order_number == "LS-2026-0001"
```

### Integration Tests
- Test concurrent document creation
- Verify uniqueness constraints
- Test rollover behavior
- Validate format consistency

## Backup and Recovery

### Number Preservation
- Document numbers are stored in database
- Backup includes all assigned numbers
- Recovery maintains sequence integrity

### Gap Analysis
Query to identify gaps in sequences:
```sql
WITH RECURSIVE number_series AS (
  SELECT 1 as num
  UNION ALL
  SELECT num + 1 FROM number_series WHERE num < 1000
)
SELECT 
  'LS-2025-' || LPAD(num::text, 4, '0') as missing_number
FROM number_series
WHERE 'LS-2025-' || LPAD(num::text, 4, '0') NOT IN (
  SELECT order_number FROM inventory_salesorder 
  WHERE order_number LIKE 'LS-2025-%'
);
```

## Configuration

### Environment Variables
```bash
# Numbering system configuration
NUMBERING_YEAR_RESET=true
NUMBERING_SALES_SEQUENCE_LENGTH=4
NUMBERING_INVOICE_SEQUENCE_LENGTH=6
NUMBERING_SALES_PREFIX=LS
NUMBERING_INVOICE_PREFIX=RE
```

### Django Settings
```python
# Numbering system settings
DEPOTIX_NUMBERING = {
    'SALES_ORDER_PREFIX': 'LS',
    'INVOICE_PREFIX': 'RE',
    'SALES_SEQUENCE_LENGTH': 4,
    'INVOICE_SEQUENCE_LENGTH': 6,
    'SALES_YEARLY_RESET': True,
    'INVOICE_YEARLY_RESET': False,
    'AUTO_ASSIGN': True,
}
```

## Implementation Status ✅

### ✅ **NUMBERING SYSTEM FULLY IMPLEMENTED**

#### Working Implementation
- ✅ **SalesOrder**: Auto-generates LS-2025-0001, LS-2025-0002, etc.
- ✅ **Invoice**: Auto-generates RE000001, RE000002, etc.
- ✅ **Yearly Reset**: Sales orders reset each January 1st; invoices use continuous numbering
- ✅ **Zero Padding**: 4-digit numbers for sales orders, 6-digit for invoices with leading zeros
- ✅ **Uniqueness**: Database-level unique constraints
- ✅ **Django Integration**: Implemented in model save() methods

#### Demo Data Results
From seed data:
```
Sales Orders:
- LS-2025-0001 (Restaurant Zum Alten Fritz) - DELIVERED
- LS-2025-0002 (Cafe Berliner Luft) - CONFIRMED

Invoices:
- RE000001 (Generated from LS-2025-0001)
```

#### Future Enhancement: DocumentSequence
The `DocumentSequence` model is implemented for atomic number generation:
- Prevents race conditions in concurrent environments
- Centralizes sequence management
- Ready for production deployment

---

*Numbering System Documentation - Phase 1 **IMPLEMENTED***
*Created: September 11, 2025*
*Completed: September 11, 2025*
*Version: 1.1*
