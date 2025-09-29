"""Template tags for invoice formatting"""
from django import template
from decimal import Decimal, InvalidOperation
import locale

register = template.Library()

@register.filter
def swiss_currency(value):
    """
    Format currency in Swiss format: 7'688,60
    Uses apostrophe as thousands separator and comma as decimal separator
    """
    if value is None:
        return "0,00"

    try:
        # Convert to Decimal for precision
        if isinstance(value, str):
            decimal_value = Decimal(value)
        else:
            decimal_value = Decimal(str(value))

        # Format with 2 decimal places
        formatted = f"{decimal_value:.2f}"

        # Split into integer and decimal parts
        integer_part, decimal_part = formatted.split('.')

        # Add thousands separators (apostrophes)
        if len(integer_part) > 3:
            # Reverse, add apostrophes every 3 digits, then reverse back
            reversed_int = integer_part[::-1]
            grouped = []
            for i in range(0, len(reversed_int), 3):
                grouped.append(reversed_int[i:i+3])
            integer_part = "'".join(grouped)[::-1]

        # Return with comma as decimal separator
        return f"{integer_part},{decimal_part}"

    except (ValueError, TypeError, InvalidOperation):
        return "0,00"

@register.filter
def swiss_date_format(value):
    """
    Format date in Swiss format: 05. Sept. 2025
    """
    if not value:
        return ""

    month_names = {
        1: 'Jan.', 2: 'Feb.', 3: 'März', 4: 'Apr.', 5: 'Mai', 6: 'Juni',
        7: 'Juli', 8: 'Aug.', 9: 'Sept.', 10: 'Okt.', 11: 'Nov.', 12: 'Dez.'
    }

    try:
        day = value.day
        month = month_names.get(value.month, str(value.month))
        year = value.year
        return f"{day:02d}. {month} {year}"
    except (AttributeError, TypeError):
        return str(value)