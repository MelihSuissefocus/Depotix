from rest_framework import permissions


class IsOwnerOrStaffReadWrite(permissions.BasePermission):
    """
    Permission to allow staff full access and users access to their own objects only.
    Staff users can read/write all objects.
    Regular users can only read/write objects they own.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Staff can access everything
        if request.user.is_staff:
            return True
        
        # Check if object has owner field
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        
        # Check if object has created_by field
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        # For objects without ownership (like Category), staff only
        return request.user.is_staff


class IsStaffOrReadOnly(permissions.BasePermission):
    """
    Permission to allow read access to any user, but write access only to staff.
    Used for categories and other shared resources.
    """
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        return request.user and request.user.is_staff


class IsOwnerOrStaffReadOnly(permissions.BasePermission):
    """
    Permission to allow staff read-only access and users access to their own objects only.
    Staff users can read all objects but not modify them.
    Regular users can read/write objects they own.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Staff can read everything but not modify
        if request.user.is_staff:
            return request.method in permissions.SAFE_METHODS
        
        # Check if object has owner field
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        
        # Check if object has created_by field
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False


class StockMovementPermission(permissions.BasePermission):
    """
    Special permission for stock movements.
    Staff can see all movements, users can only see movements for their items.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Staff can access everything
        if request.user.is_staff:
            return True
        
        # Users can only see movements for their own items
        if hasattr(obj, 'item') and hasattr(obj.item, 'owner'):
            return obj.item.owner == request.user
        
        # Users can see movements they created
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False


class SalesOrderPermission(permissions.BasePermission):
    """
    Permission for sales orders.
    Staff can see all orders, users can only see orders they created.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Staff can access everything
        if request.user.is_staff:
            return True
        
        # Users can only access orders they created
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False
