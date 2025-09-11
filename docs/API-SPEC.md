# Depotix API Specification

## Overview

The Depotix API provides comprehensive inventory management functionality with JWT authentication, RBAC (Role-Based Access Control), and full CRUD operations for all business entities.

**Base URL:** `http://localhost:8000/`
**API Version:** v1  
**Authentication:** JWT Bearer Token  
**Response Format:** JSON  

## Authentication

### JWT Token Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/token/` | POST | Obtain JWT access and refresh tokens |
| `/auth/token/refresh/` | POST | Refresh access token using refresh token |

#### Token Obtain Request
```json
POST /auth/token/
{
  "username": "your_username",
  "password": "your_password"
}
```

#### Token Obtain Response
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

#### Token Refresh Request
```json
POST /auth/token/refresh/
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Using Authentication
Include the access token in the Authorization header:
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

## RBAC (Role-Based Access Control)

### Permission Levels
- **Regular Users**: Can only access their own data (created_by/owner fields)
- **Staff Users**: Can access all data across all users

### Queryset Scoping
All endpoints automatically filter data based on user permissions:
- Non-staff users see only records they own or created
- Staff users see all records

## Core API Endpoints

### Categories

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/v1/categories/` | GET | Authenticated | List all categories |
| `/api/v1/categories/` | POST | Staff Only | Create new category |
| `/api/v1/categories/{id}/` | GET | Authenticated | Get category details |
| `/api/v1/categories/{id}/` | PUT/PATCH | Staff Only | Update category |
| `/api/v1/categories/{id}/` | DELETE | Staff Only | Delete category |

**Filters:** `name`  
**Search:** `name`, `description`  
**Ordering:** `name`, `created_at`  

### Suppliers

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/v1/suppliers/` | GET | Owner/Staff | List suppliers |
| `/api/v1/suppliers/` | POST | Authenticated | Create new supplier |
| `/api/v1/suppliers/{id}/` | GET | Owner/Staff | Get supplier details |
| `/api/v1/suppliers/{id}/` | PUT/PATCH | Owner/Staff | Update supplier |
| `/api/v1/suppliers/{id}/` | DELETE | Owner/Staff | Delete supplier |

**Filters:** `is_active`, `name`  
**Search:** `name`, `contact_name`, `email`  
**Ordering:** `name`, `created_at`  

### Customers

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/v1/customers/` | GET | Owner/Staff | List customers |
| `/api/v1/customers/` | POST | Authenticated | Create new customer |
| `/api/v1/customers/{id}/` | GET | Owner/Staff | Get customer details |
| `/api/v1/customers/{id}/` | PUT/PATCH | Owner/Staff | Update customer |
| `/api/v1/customers/{id}/` | DELETE | Owner/Staff | Delete customer |

**Filters:** `is_active`, `name`  
**Search:** `name`, `contact_name`, `email`  
**Ordering:** `name`, `created_at`  

### Inventory Items

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/v1/items/` | GET | Owner/Staff | List inventory items |
| `/api/v1/items/` | POST | Authenticated | Create new item |
| `/api/v1/items/{id}/` | GET | Owner/Staff | Get item details |
| `/api/v1/items/{id}/` | PUT/PATCH | Owner/Staff | Update item |
| `/api/v1/items/{id}/` | DELETE | Owner/Staff | Delete item |
| `/api/v1/items/low_stock/` | GET | Owner/Staff | Get low stock items |

**Filters:** `category`, `category_name`, `is_active`, `unit_base`, `low_stock`, `min_price`, `max_price`  
**Search:** `name`, `sku`, `description`  
**Ordering:** `name`, `quantity`, `price`, `last_updated`  

#### Low Stock Endpoint
**GET** `/api/v1/items/low_stock/`  
Returns items where `quantity <= min_stock_level`

**Query Parameters:**
- `category`: Filter by category ID
- `supplier`: Filter by supplier ID

### Expenses

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/v1/expenses/` | GET | Owner/Staff | List expenses |
| `/api/v1/expenses/` | POST | Authenticated | Create new expense |
| `/api/v1/expenses/{id}/` | GET | Owner/Staff | Get expense details |
| `/api/v1/expenses/{id}/` | PUT/PATCH | Owner/Staff | Update expense |
| `/api/v1/expenses/{id}/` | DELETE | Owner/Staff | Delete expense |

**Filters:** `category`, `supplier`, `date_from`, `date_to`, `supplier_name`  
**Search:** `description`, `receipt_number`  
**Ordering:** `date`, `amount`, `created_at`  

## Stock Movement Operations

### Stock Movement CRUD

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/v1/stock-movements/` | GET | Owner/Staff | List stock movements |
| `/api/v1/stock-movements/` | POST | Authenticated | Create stock movement |
| `/api/v1/stock-movements/{id}/` | GET | Owner/Staff | Get movement details |
| `/api/v1/stock-movements/{id}/` | PUT/PATCH | Owner/Staff | Update movement |
| `/api/v1/stock-movements/{id}/` | DELETE | Owner/Staff | Delete movement |

**Filters:** `type`, `item`, `supplier`, `customer`, `created_by`, `date_from`, `date_to`, `item_name`  
**Search:** `note`, `item__name`  
**Ordering:** `created_at`, `type`  

### Stock Action Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/stock/in/` | POST | Add stock to inventory |
| `/api/v1/stock/out/` | POST | Remove stock from inventory |
| `/api/v1/stock/return/` | POST | Return stock to inventory |
| `/api/v1/stock/defect/` | POST | Mark stock as defective |
| `/api/v1/stock/adjust/` | POST | Adjust stock quantity |

#### Stock Action Request Format
All stock action endpoints accept the same request format with UoM support:

```json
{
  "item": 1,
  "qty_base": 100,
  "qty_pallets": 1,
  "qty_packages": 5,
  "qty_singles": 25,
  "note": "Operation reason",
  "supplier": 1,
  "customer": 2
}
```

**UoM Conversion:**
- `qty_base` = `qty_pallets` × `unit_pallet_factor` × `unit_package_factor` + `qty_packages` × `unit_package_factor` + `qty_singles`
- Provide either `qty_base` OR UoM quantities (pallets/packages/singles)

#### Business Rules
- **Stock IN**: Increases inventory quantity
- **Stock OUT**: Decreases inventory quantity (validates sufficient stock)
- **Stock RETURN**: Increases inventory quantity (requires customer reference)
- **Stock DEFECT**: Moves stock from available to defective
- **Stock ADJUST**: Sets absolute quantity (requires note field)

#### Example Requests

**Stock IN:**
```json
POST /api/v1/stock/in/
{
  "item": 1,
  "qty_pallets": 2,
  "note": "Weekly delivery",
  "supplier": 1
}
```

**Stock OUT:**
```json
POST /api/v1/stock/out/
{
  "item": 1,
  "qty_base": 50,
  "note": "Sale to customer",
  "customer": 1
}
```

## Sales Order Workflow

### Sales Orders

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/v1/orders/` | GET | Owner/Staff | List sales orders |
| `/api/v1/orders/` | POST | Authenticated | Create new order |
| `/api/v1/orders/{id}/` | GET | Owner/Staff | Get order details |
| `/api/v1/orders/{id}/` | PUT/PATCH | Owner/Staff | Update order |
| `/api/v1/orders/{id}/` | DELETE | Owner/Staff | Delete order |
| `/api/v1/orders/{id}/confirm/` | POST | Owner/Staff | Confirm order |
| `/api/v1/orders/{id}/deliver/` | POST | Owner/Staff | Deliver order |
| `/api/v1/orders/{id}/invoice/` | POST | Owner/Staff | Create invoice |

**Filters:** `status`, `customer`, `created_by`, `date_from`, `date_to`, `customer_name`  
**Search:** `order_number`, `customer__name`  
**Ordering:** `order_date`, `total_gross`, `status`  

### Sales Order Items

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/v1/order-items/` | GET | Owner/Staff | List order items |
| `/api/v1/order-items/` | POST | Authenticated | Create order item |
| `/api/v1/order-items/{id}/` | GET | Owner/Staff | Get item details |
| `/api/v1/order-items/{id}/` | PUT/PATCH | Owner/Staff | Update item |
| `/api/v1/order-items/{id}/` | DELETE | Owner/Staff | Delete item |

**Filters:** `order`, `item`  
**Ordering:** `id`  

### Order Workflow Actions

#### 1. Confirm Order
**POST** `/api/v1/orders/{id}/confirm/`  
- Changes status from `DRAFT` to `CONFIRMED`
- No request body required

#### 2. Deliver Order
**POST** `/api/v1/orders/{id}/deliver/`  
- Changes status from `CONFIRMED` to `DELIVERED`
- Creates stock movements (OUT) for each order item
- Validates stock availability atomically
- Updates inventory quantities

#### 3. Create Invoice
**POST** `/api/v1/orders/{id}/invoice/`  
- Changes status from `DELIVERED` to `INVOICED`
- Creates invoice record with auto-generated number
- Copies financial totals from order

### Order Status Flow
`DRAFT` → `CONFIRMED` → `DELIVERED` → `INVOICED`

## Invoice Management

### Invoices

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/v1/invoices/` | GET | Owner/Staff | List invoices |
| `/api/v1/invoices/` | POST | Authenticated | Create invoice |
| `/api/v1/invoices/{id}/` | GET | Owner/Staff | Get invoice details |
| `/api/v1/invoices/{id}/` | PUT/PATCH | Owner/Staff | Update invoice |
| `/api/v1/invoices/{id}/` | DELETE | Owner/Staff | Delete invoice |
| `/api/v1/invoices/{id}/pdf/` | GET | Owner/Staff | Download PDF |

**Filters:** `invoice_number`, `issue_date`, `due_date`  
**Search:** `invoice_number`, `order__customer__name`  
**Ordering:** `issue_date`, `due_date`, `total_gross`  

### Invoice PDF Generation
**GET** `/api/v1/invoices/{id}/pdf/`  
Returns invoice as HTML (PDF stub implementation)

**Response Headers:**
- `Content-Type`: `text/html` (or `application/pdf` in production)
- `Content-Disposition`: `inline; filename="invoice_INV-YYYY-####.html"`

## Error Handling

### Standard Error Format
All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "fields": {
      "field_name": ["Field-specific error messages"]
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required or failed |
| `FORBIDDEN` | 403 | Permission denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `BUSINESS_RULE_VIOLATION` | 422 | Business logic validation failed |

### Error Examples

**Validation Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "name": ["This field is required."],
      "price": ["A valid number is required."]
    }
  }
}
```

**Business Rule Violation:**
```json
{
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "Cannot out 100 units. Only 50 units available."
  }
}
```

## Pagination

All list endpoints support pagination with the following parameters:

- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 25, max: 100)

### Response Format
```json
{
  "count": 150,
  "next": "http://localhost:8000/api/v1/items/?page=2",
  "previous": null,
  "results": [...]
}
```

## Filtering, Searching, and Ordering

### Query Parameters

#### Filtering
Use field names as query parameters:
- `/api/v1/items/?category=1&is_active=true`
- `/api/v1/orders/?status=CONFIRMED&customer=2`

#### Date Range Filtering
- `date_from`: Start date (YYYY-MM-DD format)
- `date_to`: End date (YYYY-MM-DD format)
- `/api/v1/expenses/?date_from=2024-01-01&date_to=2024-12-31`

#### Searching
Use the `search` parameter:
- `/api/v1/items/?search=apple`
- `/api/v1/customers/?search=john@example.com`

#### Ordering
Use the `ordering` parameter:
- `/api/v1/items/?ordering=name` (ascending)
- `/api/v1/items/?ordering=-price` (descending)
- `/api/v1/orders/?ordering=-order_date,total_gross` (multiple fields)

## OpenAPI Documentation

### Interactive Documentation

| Endpoint | Description |
|----------|-------------|
| `/api/schema/` | OpenAPI schema (JSON/YAML) |
| `/api/docs/` | Swagger UI interface |
| `/api/redoc/` | ReDoc interface |

### Tags
API endpoints are organized by tags:
- **Authentication**: User authentication
- **Categories**: Product categories
- **Suppliers**: Supplier management
- **Customers**: Customer management  
- **Items**: Inventory items
- **Expenses**: Expense tracking
- **Stock Movements**: Stock operations
- **Sales Orders**: Order management
- **Invoices**: Invoice management

## Rate Limiting

Currently no rate limiting is implemented. In production, consider implementing rate limiting based on:
- User authentication status
- IP address
- API endpoint sensitivity

## Data Models

### Key Model Relationships

```
User ──┬─── Supplier (owner)
       ├─── Customer (owner)
       ├─── InventoryItem (owner)
       ├─── Expense (owner)
       ├─── StockMovement (created_by)
       └─── SalesOrder (created_by)

Category ─── InventoryItem (many-to-one)

InventoryItem ──┬─── StockMovement
                ├─── SalesOrderItem
                └─── InventoryItemSupplier

SalesOrder ──┬─── SalesOrderItem
             ├─── Customer
             └─── Invoice (one-to-one)

Invoice ─── SalesOrder (one-to-one)
```

### Document Numbering
- **Sales Orders**: `LS-YYYY-####` (e.g., LS-2024-0001)
- **Invoices**: `INV-YYYY-####` (e.g., INV-2024-0001)

Numbers are generated atomically using the `DocumentSequence` model.

## Environment Variables

### Required Configuration
```bash
# Django
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,yourdomain.com

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Database (if using PostgreSQL)
DATABASE_URL=postgres://user:pass@localhost:5432/depotix
```

## Version History

- **v1.0.0**: Initial API implementation with full CRUD, stock operations, order workflow, and authentication