"""
PDF generation services for Depotix
"""

import io
import os
from typing import Dict, Any, Optional
from django.http import HttpResponse, Http404
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone

try:
    import weasyprint
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False


class PDFGenerationError(Exception):
    """Custom exception for PDF generation errors"""
    pass


def render_to_pdf(template_name: str, context: Dict[str, Any], 
                  filename: Optional[str] = None) -> HttpResponse:
    """
    Render HTML template to PDF using WeasyPrint
    
    Args:
        template_name: Path to HTML template
        context: Template context variables
        filename: Optional filename for download
        
    Returns:
        HttpResponse with PDF content
        
    Raises:
        PDFGenerationError: If PDF generation fails
    """
    if not WEASYPRINT_AVAILABLE:
        raise PDFGenerationError("WeasyPrint is not installed")
    
    try:
        # Render HTML template
        html_string = render_to_string(template_name, context)
        
        # Generate PDF
        html = weasyprint.HTML(string=html_string)
        pdf_buffer = io.BytesIO()
        html.write_pdf(target=pdf_buffer)
        pdf_buffer.seek(0)
        
        # Create HTTP response
        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        
        if filename:
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        raise PDFGenerationError(f"PDF generation failed: {str(e)}")


def generate_invoice_pdf(invoice) -> HttpResponse:
    """
    Generate PDF for an invoice
    
    Args:
        invoice: Invoice model instance
        
    Returns:
        HttpResponse with PDF content
    """
    context = {
        'invoice': invoice,
        'order': invoice.order,
        'customer': invoice.order.customer,
        'items': invoice.order.items.all(),
        'company': {
            'name': 'Depotix',
            'address': 'Schweizer Lagerverwaltung\nMusterstraße 123\n8000 Zürich\nSchweiz',
            'phone': '+41 44 123 45 67',
            'email': 'info@depotix.ch',
            'website': 'www.depotix.ch',
        },
        'generated_at': timezone.now(),
    }
    
    filename = f"{invoice.invoice_number}.pdf"
    return render_to_pdf('pdf/invoice.html', context, filename)


def generate_delivery_note_pdf(order) -> HttpResponse:
    """
    Generate PDF for a delivery note (Lieferschein)
    
    Args:
        order: SalesOrder model instance
        
    Returns:
        HttpResponse with PDF content
    """
    context = {
        'order': order,
        'customer': order.customer,
        'items': order.items.all(),
        'company': {
            'name': 'Depotix',
            'address': 'Schweizer Lagerverwaltung\nMusterstraße 123\n8000 Zürich\nSchweiz',
            'phone': '+41 44 123 45 67',
            'email': 'info@depotix.ch',
            'website': 'www.depotix.ch',
        },
        'generated_at': timezone.now(),
    }
    
    filename = f"{order.order_number}_Lieferschein.pdf"
    return render_to_pdf('pdf/delivery_note.html', context, filename)


def get_pdf_css_path() -> str:
    """
    Get the path to PDF-specific CSS file
    
    Returns:
        Absolute path to CSS file for PDF styling
    """
    static_root = getattr(settings, 'STATIC_ROOT', None)
    if static_root:
        css_path = os.path.join(static_root, 'css', 'pdf.css')
    else:
        # Fallback for development
        css_path = os.path.join(settings.BASE_DIR, 'static', 'css', 'pdf.css')
    
    return css_path


def validate_pdf_requirements():
    """
    Validate that all PDF generation requirements are met
    
    Raises:
        PDFGenerationError: If requirements are not met
    """
    if not WEASYPRINT_AVAILABLE:
        raise PDFGenerationError(
            "WeasyPrint is not installed. Please install with: pip install weasyprint"
        )
    
    # Check if templates exist
    template_dir = os.path.join(settings.BASE_DIR, 'templates', 'pdf')
    if not os.path.exists(template_dir):
        raise PDFGenerationError(
            f"PDF template directory not found: {template_dir}"
        )
    
    required_templates = ['invoice.html', 'delivery_note.html']
    for template in required_templates:
        template_path = os.path.join(template_dir, template)
        if not os.path.exists(template_path):
            raise PDFGenerationError(
                f"Required PDF template not found: {template}"
            )
