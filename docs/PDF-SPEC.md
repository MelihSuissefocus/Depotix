# PDF Generation Specification

**Project**: Depotix - Phase 4 Document Generation  
**Version**: 1.0  
**Date**: September 11, 2025  
**Status**: ✅ Implemented

## Overview

This document specifies the PDF generation system for Depotix, providing professional German-format documents for invoices (Rechnungen) and delivery notes (Lieferscheine) with complete Depotix branding and automated numbering.

## Architecture

### Backend Components

#### 1. PDF Generation Service (`inventory/services.py`)
- **Function**: `render_to_pdf(template, context, filename)` - Core PDF rendering using WeasyPrint
- **Function**: `generate_invoice_pdf(invoice)` - Generate invoice PDF with context
- **Function**: `generate_delivery_note_pdf(order)` - Generate delivery note PDF with context
- **Validation**: `validate_pdf_requirements()` - Check system prerequisites

#### 2. Document Numbering System (`models.py`)
- **Model**: `DocumentSequence` - Atomic sequence generation
- **Methods**: 
  - `next_invoice_number()` → `INV-YYYY-####`
  - `next_delivery_number()` → `LS-YYYY-####`
- **Atomic**: Uses `select_for_update()` to prevent race conditions

#### 3. API Endpoints (`viewsets.py`)
- `GET /api/v1/invoices/{id}/pdf/` - Download invoice PDF
- `GET /api/v1/orders/{id}/delivery-note-pdf/` - Download delivery note PDF
- **Authentication**: JWT required
- **Permissions**: Owner access (staff can access all)

#### 4. HTML Templates (`templates/pdf/`)
- `base.html` - Shared layout with Depotix branding
- `invoice.html` - Invoice-specific content
- `delivery_note.html` - Delivery note-specific content

### Frontend Components

#### 1. API Integration (`lib/api.ts`)
- `pdfAPI.downloadInvoicePDF(invoiceId)` - Download invoice PDF
- `pdfAPI.downloadDeliveryNotePDF(orderId)` - Download delivery note PDF
- **Error Handling**: Toast notifications for success/failure

#### 2. UI Components
- **Order Detail Page**: Delivery note download button (DELIVERED/INVOICED status)
- **Invoice List Page**: Invoice download buttons with loading states
- **Loading States**: Prevents double-clicks, shows progress

## Document Specifications

### Invoice (Rechnung)

#### Header Section
- **Company Logo**: Placeholder "DEPOTIX LOGO" (3cm × 2cm)
- **Company Info**: 
  - Name: "Depotix"
  - Tagline: "Schweizer Lagerverwaltung"
  - Address: Musterstraße 123, 8000 Zürich, Schweiz
  - Contact: Tel, Email, Website
- **Document Title**: "RECHNUNG" (blue, 20pt)
- **Document Number**: Auto-generated `INV-YYYY-####`
- **Dates**: Rechnungsdatum, Fälligkeitsdatum, Bestellnummer

#### Customer Section
- **Label**: "Rechnungsadresse:" (blue, bold)
- **Content**: Customer name (bold), contact, address, email, phone, tax ID
- **Styling**: Gray background, blue left border

#### Order Details
- **Delivery Date**: From order or "Nach Vereinbarung"
- **Payment Terms**: From customer or "30 Tage netto"

#### Items Table
| Column | Width | Content |
|--------|-------|---------|
| Pos. | 5% | Sequential numbering |
| Artikel | 40% | Name, SKU, description |
| Menge | 10% | Quantity in base units |
| Einheit | 10% | Unit type (PIECE, KG, etc.) |
| Einzelpreis | 12% | Price per unit with currency |
| MwSt% | 8% | Tax rate percentage |
| Gesamtpreis | 15% | Gross total including tax |

#### Totals Section
- **Zwischensumme (netto)**: Net total before tax
- **Mehrwertsteuer**: Total tax amount
- **Rechnungsbetrag (brutto)**: Final gross total
- **Styling**: Right-aligned, blue color scheme

#### Payment Information
- **Section**: Blue background box with payment details
- **Content**: Payment deadline, amount, reference number, terms
- **Footer Text**: Thank you message, electronic signature note

#### Footer
- **Company**: "Depotix - Schweizer Lagerverwaltung"
- **Tagline**: Professional inventory management message
- **Generated**: Timestamp "Generiert am DD.MM.YYYY HH:mm Uhr mit Depotix"

### Delivery Note (Lieferschein)

#### Header Section
- **Same as Invoice** with document title "LIEFERSCHEIN"
- **Document Number**: Auto-generated `LS-YYYY-####`
- **Dates**: Lieferdatum, Bestelldatum, Status

#### Customer Section
- **Dual Address**: Billing and shipping addresses side-by-side
- **Conditional**: Only show shipping if different from billing

#### Delivery Information
- **Blue Box**: Delivery date, order number, order value
- **Styling**: Similar to invoice payment box

#### Items Table
| Column | Width | Content |
|--------|-------|---------|
| Pos. | 5% | Sequential numbering |
| Artikel | 50% | Name, SKU, description |
| Menge | 15% | Quantity (bold) |
| Einheit | 10% | Unit type |
| Lagerort | 20% | Storage location |

#### Important Notes
- **Yellow Box**: Delivery inspection instructions
- **Content**: 48-hour complaint deadline, damage reporting
- **Language**: German legal compliance text

#### Signature Section
- **Dual Signatures**: Supplier and recipient
- **Labels**: "Ware geliefert durch" / "Ware erhalten durch"
- **Lines**: 6cm signature lines with date fields

#### Footer
- **Legal Text**: Receipt confirmation with signature
- **Copy Note**: "Eine Kopie dieses Lieferscheins verbleibt bei Ihnen"

## Technical Implementation

### PDF Styling (CSS)

#### Page Setup
```css
@page {
    margin: 2cm;
    @top-center { content: "Document Header"; }
    @bottom-center { content: "Seite " counter(page) " von " counter(pages); }
}
```

#### Color Scheme
- **Primary Blue**: `#2563eb` (headers, borders, highlights)
- **Dark Blue**: `#1e40af` (totals, emphasis)
- **Light Blue**: `#f0f7ff` (backgrounds)
- **Gray**: `#666` (secondary text)
- **Success Green**: `#059669` (delivered status)

#### Typography
- **Primary Font**: Arial, sans-serif
- **Base Size**: 11pt
- **Headers**: 20pt-24pt
- **Tables**: 9pt-10pt
- **Footer**: 9pt

#### Layout Components
- **Header**: Flex layout with company info and document details
- **Customer Box**: Gray background with blue left border
- **Tables**: Striped rows, blue headers, right-aligned numbers
- **Totals**: Right-floating box with bordered grand total
- **Signature Lines**: 6cm width with labels

### Database Schema

#### DocumentSequence Model
```python
document_type = CharField(max_length=10)  # 'LS' or 'INV'
year = IntegerField()                     # Current year
last_number = IntegerField(default=0)     # Last used number

# Unique constraint on (document_type, year)
# Index on (document_type, year) for performance
```

#### Business Rules
- **Atomic Generation**: Uses `select_for_update()` and transactions
- **Year Reset**: New sequence starts each year
- **Format**: `{TYPE}-{YEAR}-{NUMBER:04d}`
- **Race Condition Safe**: Database-level locking

### Error Handling

#### Service Level
- **PDFGenerationError**: Custom exception for PDF issues
- **Validation**: Check WeasyPrint installation and templates
- **Graceful Fallback**: Clear error messages

#### API Level
```json
{
  "error": {
    "code": "PDF_GENERATION_ERROR",
    "message": "WeasyPrint is not installed"
  }
}
```

#### Frontend Level
- **Toast Notifications**: Success/error feedback
- **Loading States**: Button disabled during download
- **Retry Logic**: Allow users to retry failed downloads

### Security

#### Access Control
- **Authentication**: JWT tokens required
- **Authorization**: Owner-based access (users see only their documents)
- **Staff Override**: Staff users can access all documents
- **Object-Level**: Permissions checked per document

#### Data Protection
- **Customer Data**: Properly escaped in templates
- **Financial Data**: Precise decimal handling
- **File Downloads**: Direct streaming (no temporary files)

## API Documentation

### Invoice PDF Endpoint

```http
GET /api/v1/invoices/{id}/pdf/
Authorization: Bearer {jwt_token}
```

**Response**:
- **Success (200)**: `Content-Type: application/pdf`
- **Headers**: `Content-Disposition: attachment; filename="INV-YYYY-####.pdf"`
- **Error (404)**: Invoice not found
- **Error (500)**: PDF generation failed

### Delivery Note PDF Endpoint

```http
GET /api/v1/orders/{id}/delivery-note-pdf/
Authorization: Bearer {jwt_token}
```

**Response**:
- **Success (200)**: `Content-Type: application/pdf`
- **Headers**: `Content-Disposition: attachment; filename="LS-YYYY-####_Lieferschein.pdf"`
- **Error (404)**: Order not found
- **Error (500)**: PDF generation failed

## Data Model Mapping

### Invoice PDF Context

| PDF Field | Data Source | Type |
|-----------|-------------|------|
| Invoice Number | `invoice.invoice_number` | String |
| Issue Date | `invoice.issue_date` | Date |
| Due Date | `invoice.due_date` | Date |
| Customer Name | `order.customer.name` | String |
| Customer Address | `order.customer.address` | Text |
| Customer Tax ID | `order.customer.tax_id` | String |
| Payment Terms | `order.customer.payment_terms` | String |
| Order Number | `order.order_number` | String |
| Delivery Date | `order.delivery_date` | Date |
| Line Items | `order.items.all()` | QuerySet |
| Item Name | `item.item.name` | String |
| Item SKU | `item.item.sku` | String |
| Item Description | `item.item.description` | Text |
| Quantity | `item.qty_base` | Integer |
| Unit | `item.item.unit_base` | String |
| Unit Price | `item.unit_price` | Decimal |
| Tax Rate | `item.tax_rate` | Decimal |
| Line Total | `item.line_total_gross` | Decimal |
| Net Total | `invoice.total_net` | Decimal |
| Tax Total | `invoice.total_tax` | Decimal |
| Gross Total | `invoice.total_gross` | Decimal |
| Currency | `invoice.currency` | String |

### Delivery Note PDF Context

| PDF Field | Data Source | Type |
|-----------|-------------|------|
| Order Number | `order.order_number` | String |
| Order Date | `order.order_date` | Date |
| Delivery Date | `order.delivery_date` | Date |
| Status | `order.get_status_display()` | String |
| Customer Name | `order.customer.name` | String |
| Billing Address | `order.customer.address` | Text |
| Shipping Address | `order.customer.shipping_address` | Text |
| Contact Name | `order.customer.contact_name` | String |
| Email | `order.customer.email` | String |
| Phone | `order.customer.phone` | String |
| Order Value | `order.total_gross` | Decimal |
| Line Items | `order.items.all()` | QuerySet |
| Item Name | `item.item.name` | String |
| Item SKU | `item.item.sku` | String |
| Item Description | `item.item.description` | Text |
| Quantity | `item.qty_base` | Integer |
| Unit | `item.item.unit_base` | String |
| Storage Location | `item.item.location` | String |

### Company Information

| PDF Field | Value | Type |
|-----------|-------|------|
| Company Name | "Depotix" | String |
| Tagline | "Schweizer Lagerverwaltung" | String |
| Address | "Musterstraße 123\n8000 Zürich\nSchweiz" | Text |
| Phone | "+41 44 123 45 67" | String |
| Email | "info@depotix.ch" | String |
| Website | "www.depotix.ch" | String |

## Testing Strategy

### Unit Tests (`test_pdf.py`)

#### Service Tests
- `test_validate_pdf_requirements()` - Check system setup
- `test_document_sequence_generation()` - Atomic numbering
- `test_invoice_model_numbering()` - Auto-numbering integration
- `test_sales_order_numbering()` - Order number generation

#### API Tests
- `test_invoice_pdf_endpoint_authenticated()` - Successful PDF generation
- `test_delivery_note_pdf_endpoint()` - Delivery note generation
- `test_pdf_access_control()` - Owner-based permissions
- `test_staff_user_pdf_access()` - Staff override permissions
- `test_invoice_pdf_not_found()` - Error handling

#### Content Tests
- `test_invoice_context_data()` - Context completeness
- `test_delivery_note_context_data()` - Required fields
- `test_german_content_handling()` - Umlauts and special characters
- `test_currency_formatting()` - CHF formatting
- `test_line_item_calculations()` - Tax and total calculations

### Integration Tests
- **Full Workflow**: Order → Delivery → Invoice → PDF Generation
- **Error Scenarios**: Missing data, invalid permissions
- **Performance**: Large orders with many line items
- **Character Encoding**: German special characters

### Manual Testing
- **Visual Verification**: PDF layout and styling
- **Cross-Browser**: Download functionality across browsers
- **Mobile Responsive**: Button placement and usability
- **Print Quality**: Physical printing results

## Production Deployment

### Dependencies
```bash
pip install weasyprint==62.3
```

### System Requirements
- **Python 3.9+**: Core language requirement
- **Cairo**: Graphics library for WeasyPrint
- **Pango**: Text layout library
- **WeasyPrint**: HTML to PDF conversion

### Configuration

#### Django Settings
```python
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
    }
]
```

#### Environment Variables
```env
# PDF Generation
PDF_COMPANY_NAME="Depotix"
PDF_COMPANY_ADDRESS="Your Company Address"
PDF_COMPANY_PHONE="+41 44 123 45 67"
PDF_COMPANY_EMAIL="info@depotix.ch"
PDF_COMPANY_WEBSITE="www.depotix.ch"
```

### Performance Considerations
- **Memory Usage**: WeasyPrint requires ~50MB per PDF generation
- **CPU Usage**: PDF generation is CPU-intensive
- **Caching**: Consider Redis for template caching
- **Async Processing**: Use Celery for large documents

## Security Considerations

### Input Validation
- **Template Injection**: All user data escaped in templates
- **Path Traversal**: Template paths validated
- **File Size Limits**: PDF generation timeouts

### Access Control
- **Authentication**: JWT tokens verified
- **Authorization**: Owner-based document access
- **Audit Trail**: PDF downloads logged

### Data Protection
- **No Persistence**: PDFs generated on-demand, not stored
- **Encryption**: HTTPS for all PDF downloads
- **Compliance**: GDPR-compliant data handling

## Troubleshooting

### Common Issues

#### WeasyPrint Installation
**Problem**: `ModuleNotFoundError: No module named 'weasyprint'`
**Solution**: 
```bash
pip install weasyprint==62.3
# macOS may require: brew install cairo pango
```

#### Template Not Found
**Problem**: `TemplateDoesNotExist: pdf/invoice.html`
**Solution**: Verify `TEMPLATES['DIRS']` includes templates directory

#### Font Rendering
**Problem**: Special characters not displaying correctly
**Solution**: Ensure system fonts support German characters

#### Permission Denied
**Problem**: 404 error on PDF endpoints
**Solution**: Check user permissions and object ownership

#### PDF Generation Timeout
**Problem**: Large documents fail to generate
**Solution**: Increase request timeout or implement async generation

### Debug Mode
```python
# Enable WeasyPrint debug logging
import logging
logging.getLogger('weasyprint').setLevel(logging.DEBUG)
```

## Future Enhancements

### Phase 5 Considerations
- **Email Integration**: Automatic PDF delivery via email
- **Template Customization**: User-configurable templates
- **Digital Signatures**: Electronic signature integration
- **Batch Processing**: Multiple document generation
- **Archive System**: PDF storage and retrieval
- **Internationalization**: Multi-language support

### Performance Optimizations
- **Template Caching**: Redis-based template caching
- **Async Generation**: Celery task queue
- **CDN Integration**: Static asset delivery
- **PDF Compression**: Smaller file sizes

---

**Document Status**: ✅ Complete  
**Implementation Status**: ✅ Implemented  
**Test Coverage**: ✅ Comprehensive  
**Production Ready**: ✅ Yes
