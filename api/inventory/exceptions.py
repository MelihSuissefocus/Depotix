from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError as DjangoValidationError


class InsufficientStockError(Exception):
    """Custom exception for insufficient stock scenarios"""
    pass


def custom_exception_handler(exc, context):
    """
    Custom exception handler for consistent error responses
    """
    # Handle custom InsufficientStockError first
    if isinstance(exc, InsufficientStockError):
        custom_response_data = {
            'error': {
                'code': 'INSUFFICIENT_STOCK',
                'message': str(exc)
            }
        }
        return Response(custom_response_data, status=422)
    
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # Handle DRF ValidationError with insufficient_stock code as 422
        if (hasattr(exc, 'detail') and 
            hasattr(exc, 'get_codes') and 
            exc.get_codes() and 
            'insufficient_stock' in str(exc.get_codes())):
            
            custom_response_data = {
                'error': {
                    'code': 'INSUFFICIENT_STOCK',
                    'message': str(exc.detail.get('detail', exc.detail))
                }
            }
            return Response(custom_response_data, status=422)
        
        # Handle other validation errors as 400
        elif response.status_code == 400:
            custom_response_data = {
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Validation failed',
                    'fields': response.data
                }
            }
            response.data = custom_response_data
    
    # Handle Django ValidationError (from model clean() methods)
    elif isinstance(exc, DjangoValidationError):
        error_message = str(exc)
        
        # Check if it's a stock availability error for 422 response
        if "Only" in error_message and "units available" in error_message:
            custom_response_data = {
                'error': {
                    'code': 'INSUFFICIENT_STOCK', 
                    'message': error_message
                }
            }
            return Response(custom_response_data, status=422)
        else:
            # Other validation errors as 400
            custom_response_data = {
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': error_message
                }
            }
            return Response(custom_response_data, status=400)
    
    return response