"""
Middleware for session validation and concurrent login prevention
"""
from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.http import JsonResponse
from .models import UserSession
import logging

logger = logging.getLogger(__name__)


class SessionValidationMiddleware(MiddlewareMixin):
    """
    Middleware to validate that the user's session is still active.
    If another user logged in with the same credentials, this session will be invalidated.
    """

    # Paths that don't require session validation
    EXCLUDED_PATHS = [
        '/api/token/',
        '/api/token/refresh/',
        '/api/inventory/users/',  # Registration
        '/admin/',
        '/healthz',
        '/static/',
        '/media/',
    ]

    def process_request(self, request):
        # Skip validation for excluded paths
        path = request.path
        if any(path.startswith(excluded) for excluded in self.EXCLUDED_PATHS):
            return None

        # Skip if no authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        try:
            # Extract and validate JWT token
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(auth_header.split(' ')[1])
            user = jwt_auth.get_user(validated_token)

            # Get session_key from token
            session_key = validated_token.get('session_key')

            if not session_key:
                # Token doesn't have session_key (old token format)
                # Allow it to pass but log warning
                logger.warning(f"Token for user {user.username} missing session_key")
                return None

            # Check if this session is still active in database
            try:
                active_session = UserSession.objects.get(user=user)

                if active_session.session_key != session_key:
                    # Session has been replaced by a new login
                    logger.info(
                        f"Session invalidated for user {user.username}. "
                        f"Current session: {active_session.session_key[:8]}..., "
                        f"Request session: {session_key[:8]}..."
                    )
                    return JsonResponse({
                        'detail': 'Your session has been terminated because another user logged in with your credentials.',
                        'code': 'session_terminated'
                    }, status=401)

                # Update last activity (optional - can be expensive on high traffic)
                # active_session.save(update_fields=['last_activity'])

            except UserSession.DoesNotExist:
                # No active session found - user was logged out or session expired
                logger.info(f"No active session found for user {user.username}")
                return JsonResponse({
                    'detail': 'Your session has expired. Please log in again.',
                    'code': 'session_expired'
                }, status=401)

        except (InvalidToken, TokenError) as e:
            # Invalid token - let the normal authentication handle it
            logger.debug(f"Token validation error in middleware: {str(e)}")
            pass
        except Exception as e:
            # Log unexpected errors but don't break the request
            logger.error(f"Unexpected error in SessionValidationMiddleware: {str(e)}")
            pass

        return None
