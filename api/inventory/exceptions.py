from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler
from django.utils.translation import gettext_lazy as _

# German error message translations
GERMAN_ERROR_MESSAGES = {
    # Validation errors
    'required': 'Dieses Feld ist erforderlich.',
    'blank': 'Dieses Feld darf nicht leer sein.',
    'null': 'Dieses Feld darf nicht null sein.',
    'invalid': 'Ungültiger Wert.',
    'max_length': 'Stellen Sie sicher, dass dieser Wert höchstens {max_length} Zeichen hat.',
    'min_length': 'Stellen Sie sicher, dass dieser Wert mindestens {min_length} Zeichen hat.',
    'max_value': 'Stellen Sie sicher, dass dieser Wert kleiner oder gleich {max_value} ist.',
    'min_value': 'Stellen Sie sicher, dass dieser Wert größer oder gleich {min_value} ist.',
    'invalid_choice': 'Wählen Sie eine gültige Option aus. {value} ist keine der verfügbaren Optionen.',
    'unique': 'Dieser Wert existiert bereits.',
    'email': 'Geben Sie eine gültige E-Mail-Adresse ein.',
    'url': 'Geben Sie eine gültige URL ein.',
    'date': 'Geben Sie ein gültiges Datum ein.',
    'datetime': 'Geben Sie ein gültiges Datum und eine gültige Uhrzeit ein.',
    'time': 'Geben Sie eine gültige Uhrzeit ein.',
    'does_not_exist': 'Objekt existiert nicht.',
    'invalid_pk_value': 'Ungültiger Primärschlüssel-Wert.',
    
    # Authentication errors
    'authentication_failed': 'Authentifizierung fehlgeschlagen.',
    'not_authenticated': 'Authentifizierungsdaten wurden nicht bereitgestellt.',
    'permission_denied': 'Sie haben nicht die Berechtigung, diese Aktion auszuführen.',
    'token_not_valid': 'Token ist nicht gültig.',
    'invalid_token': 'Ungültiger Token.',
    'no_active_account': 'Kein aktives Konto mit den angegebenen Daten gefunden.',
    
    # Business logic errors
    'insufficient_stock': 'Unzureichender Lagerbestand verfügbar.',
    'invalid_quantity': 'Ungültige Menge angegeben.',
    'item_not_found': 'Artikel nicht gefunden.',
    'customer_not_found': 'Kunde nicht gefunden.',
    'supplier_not_found': 'Lieferant nicht gefunden.',
    'order_not_found': 'Bestellung nicht gefunden.',
    'invalid_order_status': 'Ungültiger Bestellstatus.',
    'cannot_modify_delivered_order': 'Ausgelieferte Bestellungen können nicht geändert werden.',
    'invoice_already_exists': 'Rechnung existiert bereits für diese Bestellung.',
    'order_not_delivered': 'Bestellung wurde noch nicht ausgeliefert.',
    'invalid_movement_type': 'Ungültiger Bewegungstyp.',
    'defective_quantity_exceeds_total': 'Defekte Menge übersteigt die Gesamtmenge.',
    
    # HTTP status messages
    'method_not_allowed': 'Methode nicht erlaubt.',
    'not_found': 'Nicht gefunden.',
    'bad_request': 'Ungültige Anfrage.',
    'internal_server_error': 'Interner Serverfehler.',
    'service_unavailable': 'Service nicht verfügbar.',
}

def translate_error_message(message, code=None):
    """
    Translate error messages to German
    """
    if code and code in GERMAN_ERROR_MESSAGES:
        return GERMAN_ERROR_MESSAGES[code]
    
    # Try to match common error patterns
    message_lower = str(message).lower()
    
    for key, german_msg in GERMAN_ERROR_MESSAGES.items():
        if key in message_lower:
            return german_msg
    
    # Fallback translations for common patterns
    if 'required' in message_lower:
        return GERMAN_ERROR_MESSAGES['required']
    elif 'invalid' in message_lower:
        return GERMAN_ERROR_MESSAGES['invalid']
    elif 'not found' in message_lower:
        return GERMAN_ERROR_MESSAGES['not_found']
    elif 'permission' in message_lower or 'denied' in message_lower:
        return GERMAN_ERROR_MESSAGES['permission_denied']
    elif 'authentication' in message_lower:
        return GERMAN_ERROR_MESSAGES['authentication_failed']
    
    # Return original message if no translation found
    return str(message)

def custom_exception_handler(exc, context):
    """
    Custom exception handler that translates error messages to German
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        custom_response_data = {
            'error': {
                'code': get_error_code(response.status_code),
                'message': translate_error_message(
                    get_main_error_message(response.data),
                    getattr(exc, 'default_code', None)
                )
            }
        }
        
        # Add field-specific errors if they exist
        if isinstance(response.data, dict):
            field_errors = {}
            for field, errors in response.data.items():
                if field not in ['detail', 'non_field_errors']:
                    if isinstance(errors, list):
                        field_errors[field] = [
                            translate_error_message(error) for error in errors
                        ]
                    else:
                        field_errors[field] = [translate_error_message(errors)]
            
            if field_errors:
                custom_response_data['error']['fields'] = field_errors
        
        response.data = custom_response_data
    
    return response

def get_error_code(status_code):
    """
    Map HTTP status codes to error codes
    """
    error_codes = {
        400: 'VALIDATION_ERROR',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        405: 'METHOD_NOT_ALLOWED',
        409: 'CONFLICT',
        422: 'BUSINESS_RULE_VIOLATION',
        500: 'INTERNAL_SERVER_ERROR',
        503: 'SERVICE_UNAVAILABLE',
    }
    return error_codes.get(status_code, 'UNKNOWN_ERROR')

def get_main_error_message(data):
    """
    Extract the main error message from response data
    """
    if isinstance(data, dict):
        if 'detail' in data:
            return data['detail']
        elif 'non_field_errors' in data:
            errors = data['non_field_errors']
            return errors[0] if isinstance(errors, list) and errors else str(errors)
        else:
            # Get the first field error
            for field, errors in data.items():
                if isinstance(errors, list) and errors:
                    return errors[0]
                elif errors:
                    return str(errors)
    elif isinstance(data, list) and data:
        return data[0]
    
    return str(data) if data else 'Ein Fehler ist aufgetreten'
