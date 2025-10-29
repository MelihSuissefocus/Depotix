"""
Custom authentication views and utilities for session management
"""
import uuid
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import UserSession
import logging

logger = logging.getLogger(__name__)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom serializer to add session_key to JWT token"""

    def validate(self, attrs):
        data = super().validate(attrs)

        # Generate unique session key
        session_key = str(uuid.uuid4())

        # Add session_key to token payload (jti claim)
        refresh = self.get_token(self.user)
        refresh['session_key'] = session_key

        # Update response data
        data['refresh'] = str(refresh)
        data['access'] = str(refresh.access_token)
        data['session_key'] = session_key

        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims if needed
        token['username'] = user.username
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom token view that enforces single concurrent session per user.
    When a user logs in, any existing session is invalidated.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            # Get user from validated credentials
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = serializer.user
            session_key = response.data.get('session_key')

            # Get IP address and user agent
            ip_address = self.get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]

            try:
                # Check if user has existing session
                existing_session = UserSession.objects.filter(user=user).first()

                if existing_session:
                    logger.info(
                        f"User {user.username} logged in from new location. "
                        f"Invalidating previous session: {existing_session.session_key[:8]}..."
                    )
                    # Delete old session (this will force logout on other devices)
                    existing_session.delete()

                # Create new session
                UserSession.objects.create(
                    user=user,
                    session_key=session_key,
                    ip_address=ip_address,
                    user_agent=user_agent
                )

                logger.info(f"New session created for user {user.username}: {session_key[:8]}...")

            except Exception as e:
                logger.error(f"Error managing session for user {user.username}: {str(e)}")
                # Don't fail login if session management fails
                pass

        return response

    def get_client_ip(self, request):
        """Extract client IP from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
