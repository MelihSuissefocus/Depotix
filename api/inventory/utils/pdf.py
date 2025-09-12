"""PDF generation utilities for invoices with Swiss QR bill support"""
import base64
from io import BytesIO
from decimal import Decimal
from django.template.loader import render_to_string
from weasyprint import HTML


def render_invoice_pdf(context):
    """
    Render invoice PDF from template using WeasyPrint
    
    Args:
        context (dict): Template context with invoice data
        
    Returns:
        bytes: PDF content
    """
    html_string = render_to_string('pdf/invoice.html', context)
    html = HTML(string=html_string)
    pdf_bytes = html.write_pdf()
    return pdf_bytes


def _qr_svg_data_uri(iban, creditor, debtor, amount, currency, reference, message):
    """
    Generate Swiss QR bill SVG as data URI using qrbill
    
    Args:
        iban (str): Creditor IBAN
        creditor (dict): Creditor info (name, street, postal_code, city, country)
        debtor (dict): Debtor info (name, street, postal_code, city, country)
        amount (Decimal): Payment amount
        currency (str): Currency code (e.g., 'CHF')
        reference (str): Payment reference
        message (str): Additional message
        
    Returns:
        str: SVG data URI for embedding in HTML
    """
    from qrbill import QRBill
    from qrbill.bill import Address
    
    # Create address objects
    creditor_address = Address(
        name=creditor['name'],
        line1=creditor['street'],
        line2=f"{creditor['postal_code']} {creditor['city']}",
        country=creditor['country']
    )
    
    debtor_address = Address(
        name=debtor['name'],
        line1=debtor.get('street', ''),
        line2=f"{debtor.get('postal_code', '')} {debtor.get('city', '')}",
        country=debtor.get('country', 'CH')
    ) if any(debtor.values()) else None
    
    # Create QR bill instance
    qr_bill = QRBill(
        account=iban,
        creditor=creditor_address,
        final_creditor=debtor_address,
        amount=float(amount),
        currency=currency,
        due_date=None,
        debtor=debtor_address,
        ref=reference,
        extra_infos=message
    )
    
    # Generate SVG
    svg_content = qr_bill.as_svg()
    
    # Convert to data URI
    svg_bytes = svg_content.encode('utf-8')
    svg_base64 = base64.b64encode(svg_bytes).decode('utf-8')
    data_uri = f"data:image/svg+xml;base64,{svg_base64}"
    
    return data_uri