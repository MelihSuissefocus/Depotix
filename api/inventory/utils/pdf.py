"""PDF generation utilities for invoices with Swiss QR bill support"""
import base64
import re
import os
from io import BytesIO
from decimal import Decimal
from django.template.loader import render_to_string
from weasyprint import HTML
from django.conf import settings


def _get_logo_data_uri(logo_field):
    """
    Convert logo ImageField to base64 data URI

    Args:
        logo_field: Django ImageField instance

    Returns:
        str: Base64 data URI or None if no logo
    """
    if not logo_field:
        return None

    try:
        # Get the logo file path
        logo_path = logo_field.path

        if not os.path.exists(logo_path):
            return None

        # Determine MIME type from file extension
        ext = os.path.splitext(logo_path)[1].lower()
        mime_types = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
        }
        mime_type = mime_types.get(ext, 'image/png')

        # Read and encode the file
        with open(logo_path, 'rb') as f:
            logo_data = base64.b64encode(f.read()).decode('utf-8')

        return f"data:{mime_type};base64,{logo_data}"
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to load logo: {str(e)}")
        return None


def render_invoice_pdf(context):
    """
    Render invoice PDF from template using WeasyPrint

    Args:
        context (dict): Template context with invoice data

    Returns:
        bytes: PDF content
    """
    # Convert logo to data URI if present
    if 'supplier' in context and hasattr(context['supplier'], 'logo'):
        logo_data_uri = _get_logo_data_uri(context['supplier'].logo)
        context['logo_data_uri'] = logo_data_uri

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
    logger.info(f"Creditor data: {creditor}")
    logger.info(f"Debtor data: {debtor}")

    try:
        # Clean IBAN - remove spaces and ensure proper format
        clean_iban = iban.replace(' ', '').upper()
        logger.info(f"Cleaned IBAN: {clean_iban}")
        
        # Validate IBAN format (basic check)
        if not clean_iban.startswith('CH') or len(clean_iban) != 21:
            raise ValueError(f"Invalid IBAN format: {clean_iban}. Expected CH followed by 19 digits.")
        
        # Build creditor dict (qrbill expects a dict, not Address object)
        creditor_data = {
            'name': creditor['name'][:70],  # Max 70 chars
            'line1': creditor.get('street', '')[:70],
            'line2': f"{creditor.get('postal_code', '')} {creditor.get('city', '')}"[:70],
            'country': creditor.get('country', 'CH')[:2]  # ISO 2-letter code
        }
        logger.info(f"Creditor data for QR: {creditor_data}")

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
        # Format amount to 2 decimal places for QR code
        if amount:
            amount_str = f"{float(amount):.2f}"
        else:
            amount_str = None

        qr_bill = QRBill(
            account=clean_iban,  # Use cleaned IBAN
            creditor=creditor_data,
            amount=amount_str,
            currency=currency,
            debtor=debtor_data,
            additional_information=message[:140] if message else None,  # Max 140 chars
            language='de'  # Set language to German
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

        # Use the full QR bill SVG from qrbill library
        # It already contains the complete Swiss QR payment slip layout
        logger.info(f"Using full QR bill SVG, length: {len(svg_content)} chars")

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