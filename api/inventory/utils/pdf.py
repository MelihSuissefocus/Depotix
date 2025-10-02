"""PDF generation utilities for invoices with Swiss QR bill support"""
import base64
import re
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

    Raises:
        ValueError: If required data is missing or invalid
    """
    from qrbill import QRBill
    import logging
    import tempfile
    import os

    logger = logging.getLogger(__name__)

    # Validate required fields
    if not iban:
        raise ValueError("IBAN ist erforderlich für die QR-Code-Generierung")

    if not creditor.get('name'):
        raise ValueError("Kreditor-Name ist erforderlich")

    # Log the data being used
    logger.info(f"Generating QR code with IBAN: {iban[:10]}... for amount: {amount} {currency}")

    try:
        # Build creditor dict (qrbill expects a dict, not Address object)
        creditor_data = {
            'name': creditor['name'][:70],  # Max 70 chars
            'line1': creditor.get('street', '')[:70],
            'line2': f"{creditor.get('postal_code', '')} {creditor.get('city', '')}"[:70],
            'country': creditor.get('country', 'CH')[:2]  # ISO 2-letter code
        }

        # Build debtor dict if we have at least a name
        debtor_data = None
        if debtor and debtor.get('name'):
            debtor_data = {
                'name': debtor['name'][:70],
                'line1': debtor.get('street', '')[:70],
                'line2': f"{debtor.get('postal_code', '')} {debtor.get('city', '')}"[:70],
                'country': debtor.get('country', 'CH')[:2]
            }

        # Create QR bill instance
        # Amount must be string or Decimal, not float
        amount_str = str(amount) if amount else None

        qr_bill = QRBill(
            account=iban.replace(' ', ''),  # Remove spaces from IBAN
            creditor=creditor_data,
            amount=amount_str,
            currency=currency,
            debtor=debtor_data,
            additional_information=message[:140] if message else None  # Max 140 chars
        )

        # Generate SVG to temp file (qrbill requires a file path)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.svg', delete=False) as temp_file:
            temp_path = temp_file.name

        try:
            qr_bill.as_svg(temp_path)

            # Read the SVG content
            with open(temp_path, 'r', encoding='utf-8') as f:
                svg_content = f.read()
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)

        # Post-process SVG to convert CSS style attributes to SVG attributes
        # WeasyPrint doesn't parse CSS properties in style attributes correctly
        style_count_before = svg_content.count('style="')
        logger.info(f"SVG before processing: {style_count_before} style attributes")

        # Convert style="fill:#000000;..." to fill="#000000" ...
        def convert_style_to_attrs(match):
            style_content = match.group(1)
            attrs = []

            # Parse CSS properties
            for prop in style_content.split(';'):
                if ':' not in prop:
                    continue
                key, value = prop.split(':', 1)
                key = key.strip()
                value = value.strip()

                # Map CSS properties to SVG attributes
                if key == 'fill' and value != 'none':
                    attrs.append(f'fill="{value}"')
                elif key == 'fill-opacity':
                    attrs.append(f'fill-opacity="{value}"')
                elif key == 'fill-rule':
                    attrs.append(f'fill-rule="{value}"')
                elif key == 'stroke' and value != 'none':
                    attrs.append(f'stroke="{value}"')
                elif key == 'stroke-width':
                    attrs.append(f'stroke-width="{value}"')

            return ' '.join(attrs) if attrs else ''

        # Replace all style="..." with proper SVG attributes
        svg_content = re.sub(r'style="([^"]*)"', convert_style_to_attrs, svg_content)

        style_count_after = svg_content.count('style="')
        logger.info(f"SVG after processing: {style_count_after} style attributes remaining")
        logger.info(f"QR code generated successfully, SVG length: {len(svg_content)} chars")
        return svg_content

    except Exception as e:
        logger.error(f"QR code generation failed: {str(e)}", exc_info=True)
        raise ValueError(f"QR-Code-Generierung fehlgeschlagen: {str(e)}")