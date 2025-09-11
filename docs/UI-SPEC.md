# Depotix UI Specification

**Version**: Phase 3 - Frontend Integration  
**Date**: September 11, 2025  
**Status**: Implementation Complete

## Overview

This document specifies the user interface design, navigation flows, form fields, validation rules, and user interactions for the Depotix inventory management system. The UI implements all Phase 2 backend capabilities with a modern, responsive React/Next.js frontend.

## Architecture

### Technology Stack
- **Framework**: Next.js 15.2.4 with App Router
- **Language**: TypeScript with strict type checking
- **Styling**: Tailwind CSS + Shadcn UI components
- **State Management**: React hooks + custom CRUD hooks
- **API Integration**: Fetch-based API client with JWT authentication
- **Charts**: Recharts for data visualization
- **Notifications**: React Hot Toast for user feedback

### API Client Usage

```typescript
// Generic CRUD operations
import { useCRUD } from '@/lib/hooks'
import { customerAPI } from '@/lib/api'

function CustomerList() {
  const { data, loading, fetchList, create, update, remove } = useCRUD(customerAPI)
  
  useEffect(() => {
    fetchList({ search: 'filter', page: 1 }) // Supports pagination, search, ordering
  }, [])
}

// Stock actions
import { useAction } from '@/lib/hooks'
import { stockActionAPI } from '@/lib/api'

const { execute: performStockIn } = useAction(stockActionAPI.stockIn)
await performStockIn({ item: 1, qty_base: 100, supplier: 2 })
```

## Navigation Structure

### Main Navigation (Sidebar)
```
Dashboard          [/]                     - KPI overview, widgets
├── Inventory      [/inventory]            - Item management + stock actions
├── Categories     [/categories]           - Product categorization
├── Suppliers      [/suppliers]            - Vendor management
├── Customers      [/customers]            - Customer relationship management
├── Expenses       [/expenses]             - Financial expense tracking
├── Stock Movements [/stock-movements]     - Inventory transaction history
├── Orders         [/orders]               - Sales order workflow
├── Invoices       [/invoices]             - Invoice management + PDF
├── Item Suppliers [/item-suppliers]       - Item-supplier relationships (legacy)
├── Logs           [/logs]                 - System activity logs (legacy)
├── Reports        [/reports]              - Analytics and reporting
└── Settings       [/settings]             - User preferences
```

### Route Guards
- **Authentication Required**: All routes except `/login` and `/register`
- **Role-Based Access**: Admin features visible to `is_staff` users
- **Ownership Filtering**: Non-staff users see only their own data

## Screen Specifications

### 1. Dashboard (`/`)

**Purpose**: Executive overview with KPIs and quick access to critical information

**Layout**: 
- Welcome header with user name
- KPI cards grid (4 columns on desktop, 2 on tablet, 1 on mobile)
- Widget section (3 columns: Low Stock, Recent Movements, Recent Orders)
- Legacy charts (Inventory Trend, Low Stock Alerts)
- Recent activity table

**KPI Cards**:
- Total Items, Low Stock Items, Stock In/Out (month), Monthly Expenses, Monthly Orders, Monthly Revenue

**Widgets**:
- **Low Stock Widget**: Items below `min_stock_level` with direct links to item pages
- **Stock Movement Timeline**: Latest 8 movements with type icons and quantities
- **Recent Orders Widget**: Latest 5 orders with status badges and amounts

**Screenshot Placeholder**: `[Dashboard-Overview.png]`

---

### 2. Inventory Management (`/inventory`)

**Purpose**: Complete item management with UoM support and stock actions

**Enhanced Features (Phase 3)**:
- **UoM Fields**: Base unit, package factor, pallet factor with live conversion preview
- **Stock Information**: Total, available, defective quantities with visual indicators
- **Integrated Stock Actions**: Quick IN/OUT buttons in table rows
- **Enhanced Search**: Name, SKU, category filtering with sorting

**Form Fields**:
```typescript
interface ItemForm {
  name: string                    // Required, max 200 chars
  description?: string            // Optional, textarea
  sku?: string                    // Optional, unique per owner
  quantity: number                // Required, min 0
  price: string                   // Required, CHF format, 2 decimals
  cost?: string                   // Optional, CHF format
  category?: number               // Optional, select from categories
  location?: string               // Optional, storage location
  min_stock_level: number         // Required, default 10
  unit_base: UnitType            // Required, enum selection
  unit_package_factor: number    // Required, default 1, min 1
  unit_pallet_factor: number     // Required, default 1, min 1
}
```

**UoM Conversion Display**:
- **Visual**: `1 Pallet = {pallet_factor} Packages = {pallet_factor × package_factor} {unit_base}`
- **Example**: `1 Pallet = 60 Packages = 1440 Pieces`

**Validation Rules**:
- Name: Required, 1-200 characters
- Price/Cost: Positive numbers, up to 2 decimal places
- Quantity: Non-negative integer
- UoM Factors: Positive integers, minimum 1

**Screenshot Placeholder**: `[Inventory-Enhanced-Form.png]`, `[Inventory-List-StockActions.png]`

---

### 3. Stock Actions (Modal System)

**Purpose**: Execute inventory movements with UoM conversion and business validation

**Action Types**:
- **IN**: Add inventory (requires supplier)
- **OUT**: Remove inventory (requires customer, validates availability)
- **RETURN**: Customer returns (requires customer)
- **DEFECT**: Mark damaged (no supplier/customer needed)
- **ADJUST**: Manual adjustment (requires reason in notes)

**Modal Components**:
```typescript
interface StockActionData {
  item: number                    // Required, item selection
  qty_base?: number              // Calculated from UoM converter
  qty_pallets?: number           // UoM input
  qty_packages?: number          // UoM input  
  qty_singles?: number           // UoM input
  supplier?: number | null       // Required for IN
  customer?: number | null       // Required for OUT/RETURN
  note?: string                  // Required for ADJUST
}
```

**UoM Converter Integration**:
- Real-time conversion between pallets/packages/singles → base units
- Visual display of current stock levels (total, available, defective)
- Live calculation preview showing impact on inventory

**Business Validation**:
- OUT operations: Cannot exceed `available_qty = total_qty - defective_qty`
- RETURN operations: Must specify customer
- ADJUST operations: Must provide reasoning in notes
- All operations: Positive quantities only

**Screenshot Placeholder**: `[StockAction-Modal-UoM.png]`, `[StockAction-Validation.png]`

---

### 4. Customer Management (`/customers`)

**Purpose**: B2B customer relationship management

**List View Features**:
- Search: Company name, contact person, email
- Sortable columns: Name, created date, credit limit
- Pagination: 25 customers per page
- Quick status filtering: Active/Inactive

**Form Fields**:
```typescript
interface CustomerForm {
  name: string                    // Required, company name
  contact_name?: string           // Optional, contact person
  email?: string                  // Optional, email validation
  phone?: string                  // Optional, phone number
  address?: string                // Optional, billing address (textarea)
  shipping_address?: string       // Optional, delivery address (textarea)
  tax_id?: string                 // Optional, tax identification
  credit_limit?: number           // Optional, CHF amount
  payment_terms?: string          // Optional, e.g. "Net 30"
  notes?: string                  // Optional, internal notes (textarea)
  is_active: boolean              // Required, default true
}
```

**Validation Rules**:
- Name: Required, 1-200 characters
- Email: Valid email format if provided
- Credit limit: Non-negative number
- Phone: No specific format required (international compatibility)

**Integration Points**:
- **Order Forms**: Customer selection dropdown
- **Stock OUT/RETURN**: Customer reference in stock movements
- **Dashboard**: Customer count in KPIs

**Screenshot Placeholder**: `[Customer-List-Search.png]`, `[Customer-Form-Validation.png]`

---

### 5. Expense Management (`/expenses`)

**Purpose**: Financial expense tracking with categorization

**Dashboard KPIs**:
- Total expenses (filtered set)
- Current month expenses
- Expense categories count

**Form Fields**:
```typescript
interface ExpenseForm {
  date: string                    // Required, date picker
  description: string             // Required, expense description
  amount: string                  // Required, CHF amount, 2 decimals
  category: ExpenseCategory       // Required, enum selection
  supplier?: number               // Optional, link to supplier
  receipt_number?: string         // Optional, receipt reference
  notes?: string                  // Optional, additional details (textarea)
}

type ExpenseCategory = 'PURCHASE' | 'TRANSPORT' | 'UTILITIES' | 'MAINTENANCE' | 'OFFICE' | 'MARKETING' | 'OTHER'
```

**Filtering & Search**:
- **Date Range**: Filter by date periods
- **Category Filter**: Dropdown with all categories
- **Text Search**: Description, supplier name, receipt number
- **Sorting**: Date, amount, category

**CHF Formatting**:
- Input: Decimal numbers (e.g., 123.45)
- Display: `CHF 123.45` using Swiss locale formatting
- Validation: Positive amounts, up to 2 decimal places

**Screenshot Placeholder**: `[Expense-Dashboard-KPIs.png]`, `[Expense-Form-Categories.png]`

---

### 6. Stock Movements History (`/stock-movements`)

**Purpose**: Complete audit trail of inventory transactions

**Table Columns**:
- Date & Time (formatted with Swiss locale)
- Movement Type (icon + badge with color coding)
- Item Name (with link to item detail)
- Quantity (signed: +/- with UoM display)
- Supplier/Customer (contextual based on movement type)
- User (who performed the action)
- Note (truncated with hover tooltip)

**Filtering Options**:
```typescript
interface MovementFilters {
  type?: 'IN' | 'OUT' | 'RETURN' | 'DEFECT' | 'ADJUST'
  date_from?: string              // Date range start
  date_to?: string                // Date range end  
  item_name?: string              // Text search in item names
  supplier?: number               // Filter by supplier ID
  customer?: number               // Filter by customer ID
}
```

**Export Functionality**:
- CSV export with all filtered data
- Filename: `stock-movements-YYYY-MM-DD.csv`
- Includes: Date, Type, Item, Quantity, Units, Supplier/Customer, User, Note

**Visual Design**:
- **Type Icons**: Colored icons for each movement type (green IN, red OUT, etc.)
- **Quantity Display**: Signed values with UoM context (e.g., "+50 (2 packages + 2 pieces)")
- **Pagination**: Standard 25 items per page

**Screenshot Placeholder**: `[StockMovements-Filtered-Export.png]`, `[StockMovements-Timeline.png]`

---

### 7. Sales Order Workflow (`/orders`, `/orders/[id]`)

**Purpose**: Complete order-to-invoice business process

**Order Status Flow**:
```
DRAFT → CONFIRMED → DELIVERED → INVOICED
  ↓       ↓          ↓          ↓
 Edit   Deliver    Invoice    Complete
```

**List View (`/orders`)**:
- Order number (auto-generated or manual)
- Customer name with link
- Order date and status badge
- Total amount in CHF
- Quick action dropdown with workflow buttons

**Detail View (`/orders/[id]`)**:

**Order Header**:
- Order number, customer, dates
- Status badge with workflow action buttons
- PDF download (when INVOICED)

**Order Items Management**:
```typescript
interface OrderItemForm {
  item: number                    // Required, inventory item selection
  quantity: number                // Required, via UoM converter
  unit_price: string              // Required, CHF per base unit
  tax_rate: number                // Required, default 7.7%
}
```

**UoM Integration**:
- Item selection shows current stock and price
- UoM converter for quantity input
- Live calculation of line totals (net, tax, gross)
- Real-time order summary updates

**Workflow Actions**:
- **Confirm**: DRAFT → CONFIRMED (validates line items exist)
- **Deliver**: CONFIRMED → DELIVERED (validates stock availability, creates movements)
- **Invoice**: DELIVERED → INVOICED (creates invoice record, enables PDF)

**Business Validation**:
- Cannot edit items in non-DRAFT orders
- Delivery validates sufficient stock for all line items
- Only DELIVERED orders can generate invoices
- No backwards status transitions allowed

**Screenshot Placeholder**: `[Order-Detail-LineItems.png]`, `[Order-Workflow-Actions.png]`

---

### 8. Invoice Management (`/invoices`)

**Purpose**: Invoice viewing and PDF document generation

**List Features**:
- Invoice number (auto-generated: INV-YYYY-####)
- Linked order number (clickable)
- Customer name
- Invoice and due dates
- Total amount in CHF
- PDF download action

**PDF Generation**:
```typescript
// Download implementation
const handleDownloadPDF = async (invoiceId: number) => {
  const blob = await invoicePDFAPI.downloadPDF(invoiceId)
  // Creates download with filename: invoice_number.pdf
  // Handles errors: 404 (not found), 403 (access denied), 422 (generation failed)
}
```

**Document Features**:
- Professional HTML template converted to PDF
- Includes all order line items with calculations
- Company branding placeholder
- Sequential numbering system

**Error Handling**:
- Network errors: Retry with toast notification
- Access errors: Permission denied message
- File errors: Generation failed notification

**Screenshot Placeholder**: `[Invoice-List-PDF.png]`, `[Invoice-PDF-Preview.png]`

---

## Form Validation Rules

### Global Validation Patterns

**Required Fields**: Red asterisk (*), prevent submission when empty
**CHF Amounts**: 
- Format: Positive decimal, 2 decimal places max
- Display: `CHF 123.45` 
- Validation: `^[0-9]+(\.[0-9]{1,2})?$`

**Dates**:
- Format: ISO date strings (YYYY-MM-DD)
- Input: HTML5 date picker
- Validation: Cannot be future dates for completed transactions

**Text Fields**:
- Names: 1-200 characters, no special validation
- Descriptions/Notes: 0-1000 characters, optional
- Emails: Standard email validation when provided

**Numbers**:
- Quantities: Non-negative integers
- Factors: Positive integers (minimum 1)
- Percentages: 0-100 range for tax rates

### Real-time Validation

**UoM Converter**: Live calculation feedback, prevents invalid combinations
**Stock Actions**: Real-time availability checking before submission
**Order Totals**: Client-side preview with server-side validation on save

## Error Handling & User Feedback

### Toast Notifications
```typescript
// Success: Green toast, 3-second duration
toast.success('Customer created successfully')

// Error: Red toast, 5-second duration with retry option
toast.error('Failed to save customer. Please try again.')

// Loading: Spinner toast during API calls
const loadingToast = toast.loading('Saving customer...')
toast.dismiss(loadingToast)
```

### Error States
- **Network Errors**: Retry button with exponential backoff
- **Validation Errors**: Field-level error messages, prevent submission
- **Business Rule Violations**: Clear explanation with suggested actions
- **Permission Errors**: Informative message with navigation options

### Loading States
- **List Views**: Skeleton loading with proper dimensions
- **Forms**: Button disabled with spinner, prevent double-submission
- **File Downloads**: Progress indicator, success/error feedback

### Empty States
- **No Data**: Descriptive message with action suggestions
- **Search Results**: "No results found" with clear filters option
- **Restricted Access**: Permission explanation with contact information

## Responsive Design

### Breakpoints
- **Mobile**: < 768px - Single column, stacked forms
- **Tablet**: 768px - 1024px - Two column layouts, condensed tables
- **Desktop**: > 1024px - Full layouts, sidebar navigation

### Mobile Adaptations
- **Navigation**: Collapsible hamburger menu
- **Tables**: Horizontal scroll with sticky first column
- **Forms**: Single column layout with larger touch targets
- **Modals**: Full-screen on mobile, centered on desktop

### Touch Interactions
- **Buttons**: Minimum 44px touch targets
- **Form Fields**: Proper input types for mobile keyboards
- **Tables**: Swipe gestures for horizontal scroll

## Navigation Flows

### Customer Order Flow
```
Dashboard → Orders → New Order → Select Customer → Add Items (UoM) → Confirm → Deliver → Invoice → PDF
```

### Inventory Restocking Flow
```
Dashboard → Low Stock Widget → Item Detail → Stock IN Action → UoM Input → Supplier Selection → Confirm
```

### Expense Tracking Flow
```
Dashboard → Expenses → Add Expense → Category Selection → Supplier Link → Save → Updated KPIs
```

### Stock Movement Investigation
```
Dashboard → Recent Movements → Stock Movements List → Filter by Item → Export CSV
```

## Integration Points

### API Endpoints Used
- **CRUD Operations**: All entities via generic `createListAPI<T>()` pattern
- **Stock Actions**: `POST /api/v1/stock/{action}/` endpoints
- **Order Workflow**: `POST /api/v1/orders/{id}/{action}/` endpoints  
- **PDF Generation**: `GET /api/v1/invoices/{id}/pdf/` with blob response
- **Low Stock**: `GET /api/v1/items/low_stock/` with filtering support

### Authentication Flow
- JWT tokens stored in localStorage (security improvement needed)
- Automatic token refresh on 401 responses
- Role-based UI element visibility (`is_staff` checks)
- Ownership filtering for non-staff users

### Data Refresh Strategy
- **Optimistic Updates**: Immediate UI updates with server sync
- **Real-time Sync**: Refetch after state-changing operations
- **Cache Invalidation**: Clear stale data on navigation
- **Error Recovery**: Rollback optimistic updates on API failures

---

## Screenshot References

The following screenshots should be captured for documentation:

1. `Dashboard-Overview.png` - Main dashboard with all widgets
2. `Inventory-Enhanced-Form.png` - Item form with UoM fields
3. `Inventory-List-StockActions.png` - Inventory table with action buttons
4. `StockAction-Modal-UoM.png` - Stock action modal with UoM converter
5. `StockAction-Validation.png` - Error states in stock actions
6. `Customer-List-Search.png` - Customer list with search and filters
7. `Customer-Form-Validation.png` - Customer form with validation errors
8. `Expense-Dashboard-KPIs.png` - Expense page with summary cards
9. `Expense-Form-Categories.png` - Expense form with category selection
10. `StockMovements-Filtered-Export.png` - Filtered movements with export
11. `StockMovements-Timeline.png` - Recent movements widget
12. `Order-Detail-LineItems.png` - Order detail with line item management
13. `Order-Workflow-Actions.png` - Order workflow action buttons
14. `Invoice-List-PDF.png` - Invoice list with PDF download buttons
15. `Invoice-PDF-Preview.png` - Generated PDF document preview

---

**Status**: ✅ **IMPLEMENTATION COMPLETE**  
**Next Phase**: User Acceptance Testing and Deployment Preparation
