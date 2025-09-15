from django.db import transaction
from django.core.exceptions import ValidationError
from decimal import Decimal
from typing import Dict, Any, Optional
import logging

from .models import InventoryItem, StockMovement
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

class StockOperationError(Exception):
    """Custom exception for stock operation errors with German messages"""
    pass

def book_stock_change(
    item_id: int,
    delta: Decimal,
    movement_type: str,
    note: str = "",
    actor_id: int = None,
    supplier_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    qty_pallets: Optional[int] = None,
    qty_packages: Optional[int] = None,
    qty_singles: Optional[int] = None
) -> Dict[str, Any]:
    """
    Atomically updates item stock and creates movement log with row-level locking.

    Args:
        item_id: ID of the inventory item
        delta: Change in quantity (positive for IN/RETURN, negative for OUT)
        movement_type: Type of movement ('IN', 'OUT', 'RETURN')
        note: Optional note for the movement
        actor_id: ID of the user performing the action
        supplier_id: Optional supplier ID for IN movements
        customer_id: Optional customer ID for OUT/RETURN movements
        qty_pallets: Optional pallet quantity for UoM tracking
        qty_packages: Optional package quantity for UoM tracking
        qty_singles: Optional singles quantity for UoM tracking

    Returns:
        Dict with movement details and new quantity

    Raises:
        StockOperationError: If operation would result in negative stock or validation fails
        ValidationError: If item not found or invalid parameters
    """

    with transaction.atomic():
        try:
            # Row-level lock on the item to prevent concurrent modifications
            item = InventoryItem.objects.select_for_update().get(id=item_id)

            # Calculate new quantity
            previous_qty = item.quantity or Decimal('0')
            new_qty = previous_qty + delta

            # Validate that quantity doesn't go negative
            if new_qty < 0:
                raise StockOperationError(
                    "Buchung abgelehnt: Bestand würde negativ werden. "
                    f"Verfügbar: {previous_qty}, Angefordert: {abs(delta)}"
                )

            # Validate movement type
            if movement_type not in ['IN', 'OUT', 'RETURN']:
                raise StockOperationError(
                    f"Ungültiger Bewegungstyp: {movement_type}. "
                    "Erlaubt: IN, OUT, RETURN"
                )

            # Update item quantity atomically
            item.quantity = new_qty
            item.save(update_fields=['quantity', 'last_updated'])

            # Get actor user if provided
            actor = None
            if actor_id:
                try:
                    actor = User.objects.get(id=actor_id)
                except User.DoesNotExist:
                    logger.warning(f"User {actor_id} not found for stock movement")

            # Create movement log entry
            movement_data = {
                'item': item,
                'type': movement_type,
                'qty_base': abs(delta),  # Store absolute value, type indicates direction
                'note': note or '',
                'created_by': actor,
            }

            # Add optional fields
            if supplier_id:
                try:
                    from .models import Supplier
                    movement_data['supplier'] = Supplier.objects.get(id=supplier_id)
                except Supplier.DoesNotExist:
                    pass
            if customer_id:
                try:
                    from .models import Customer
                    movement_data['customer'] = Customer.objects.get(id=customer_id)
                except Customer.DoesNotExist:
                    pass
            if qty_pallets is not None:
                movement_data['qty_pallets'] = qty_pallets
            if qty_packages is not None:
                movement_data['qty_packages'] = qty_packages
            if qty_singles is not None:
                movement_data['qty_singles'] = qty_singles

            movement = StockMovement.objects.create(**movement_data)

            logger.info(
                f"Stock movement completed: Item {item_id}, "
                f"Type {movement_type}, Delta {delta}, "
                f"Previous {previous_qty} -> New {new_qty}, "
                f"Movement ID {movement.id}"
            )

            return {
                'success': True,
                'movement_id': movement.id,
                'item_id': item_id,
                'previous_qty': float(previous_qty),
                'new_qty': float(new_qty),
                'delta': float(delta),
                'movement_type': movement_type,
                'note': note,
                'timestamp': movement.created_at.isoformat(),
            }

        except InventoryItem.DoesNotExist:
            raise ValidationError(f"Artikel mit ID {item_id} wurde nicht gefunden.")

        except StockOperationError:
            # Re-raise our custom errors as-is
            raise

        except Exception as e:
            logger.error(f"Unexpected error in stock operation: {str(e)}")
            raise StockOperationError(
                "Unerwarteter Fehler beim Buchen der Lagerbewegung. "
                "Bitte versuchen Sie es erneut oder kontaktieren Sie den Support."
            )


def validate_stock_movement_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates and prepares stock movement data for processing.

    Args:
        data: Raw movement data from API request

    Returns:
        Validated and normalized data

    Raises:
        ValidationError: If validation fails
    """

    # Required fields
    if 'item' not in data:
        raise ValidationError("Artikel-ID ist erforderlich.")

    if 'type' not in data:
        raise ValidationError("Bewegungstyp ist erforderlich.")

    if 'qty_base' not in data:
        raise ValidationError("Menge ist erforderlich.")

    # Validate movement type
    movement_type = data['type'].upper()
    if movement_type not in ['IN', 'OUT', 'RETURN']:
        raise ValidationError(f"Ungültiger Bewegungstyp: {movement_type}")

    # Validate and convert quantity
    try:
        qty_base = Decimal(str(data['qty_base']))
        if qty_base <= 0:
            raise ValidationError("Menge muss größer als 0 sein.")
    except (ValueError, TypeError):
        raise ValidationError("Ungültige Menge.")

    # Calculate delta based on movement type
    if movement_type in ['IN', 'RETURN']:
        delta = qty_base  # Positive for incoming stock
    else:  # OUT
        delta = -qty_base  # Negative for outgoing stock

    # Validate item exists and get item_id
    if isinstance(data['item'], InventoryItem):
        # Item is already an object (from serializer)
        item = data['item']
        item_id = item.id
    else:
        # Item is an ID (from raw data)
        try:
            item = InventoryItem.objects.get(id=data['item'])
            item_id = item.id
        except InventoryItem.DoesNotExist:
            raise ValidationError(f"Artikel mit ID {data['item']} wurde nicht gefunden.")

    # Validate customer requirement for RETURN
    if movement_type == 'RETURN' and not data.get('customer'):
        raise ValidationError("Kunde ist für Retouren erforderlich.")

    # Handle supplier field (could be object or ID)
    supplier_id = None
    supplier = data.get('supplier')
    if supplier:
        if hasattr(supplier, 'id'):  # It's a supplier object
            supplier_id = supplier.id
        else:  # It's an ID
            supplier_id = supplier

    # Handle customer field (could be object or ID)
    customer_id = None
    customer = data.get('customer')
    if customer:
        if hasattr(customer, 'id'):  # It's a customer object
            customer_id = customer.id
        else:  # It's an ID
            customer_id = customer

    return {
        'item_id': item_id,
        'delta': delta,
        'movement_type': movement_type,
        'note': data.get('note', ''),
        'supplier_id': supplier_id,
        'customer_id': customer_id,
        'qty_pallets': data.get('qty_pallets'),
        'qty_packages': data.get('qty_packages'),
        'qty_singles': data.get('qty_singles'),
    }