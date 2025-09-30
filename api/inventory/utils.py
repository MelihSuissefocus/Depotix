"""
Centralized conversion and validation utilities for inventory operations.

This module provides pure functions for PPU conversion and movement validation,
ensuring consistency between frontend and backend logic.
"""

from decimal import Decimal
from typing import Dict, Any, Optional
from django.core.exceptions import ValidationError


def calculate_qty_base(
    qty_pallets: int,
    qty_packages: int,
    qty_singles: int,
    unit_pallet_factor: int,
    unit_package_factor: int
) -> int:
    """
    Calculate base quantity from Pallet/Package/Unit inputs.

    This is a pure function that MUST match the frontend calculation exactly.
    Formula: pallets * pallet_factor * package_factor
             + packages * package_factor
             + singles

    Args:
        qty_pallets: Number of pallets
        qty_packages: Number of packages
        qty_singles: Number of single units
        unit_pallet_factor: How many packages per pallet
        unit_package_factor: How many units per package

    Returns:
        Total quantity in base units

    Raises:
        ValidationError: If factors are invalid or result is <= 0

    Examples:
        >>> calculate_qty_base(1, 0, 0, 10, 6)
        60  # 1 pallet × 10 packages/pallet × 6 units/package

        >>> calculate_qty_base(0, 2, 3, 10, 6)
        15  # 2 packages × 6 units/package + 3 singles
    """
    if unit_pallet_factor < 1 or unit_package_factor < 1:
        raise ValidationError(
            f"Einheitenfaktoren müssen >= 1 sein. "
            f"Palette-Faktor: {unit_pallet_factor}, Paket-Faktor: {unit_package_factor}"
        )

    if qty_pallets < 0 or qty_packages < 0 or qty_singles < 0:
        raise ValidationError(
            f"Mengen können nicht negativ sein. "
            f"Paletten: {qty_pallets}, Pakete: {qty_packages}, Einzeln: {qty_singles}"
        )

    base_qty = (
        qty_pallets * unit_pallet_factor * unit_package_factor +
        qty_packages * unit_package_factor +
        qty_singles
    )

    if base_qty <= 0:
        raise ValidationError(
            f"Gesamtmenge muss > 0 sein. Berechnet: {base_qty}"
        )

    return base_qty


def validate_movement_data(
    movement_type: str,
    qty_base: int,
    current_quantity: int,
    item_name: Optional[str] = None
) -> None:
    """
    Validate movement constraints before transaction.

    This function enforces business rules for stock movements:
    - All movements must have positive quantity
    - OUT/DEFECT movements cannot exceed available stock

    Args:
        movement_type: Type of movement (IN, OUT, RETURN, DEFECT, ADJUST)
        qty_base: Quantity to move (in base units)
        current_quantity: Current item quantity in inventory
        item_name: Optional item name for better error messages

    Raises:
        ValidationError: If movement would violate business rules

    Examples:
        >>> validate_movement_data('OUT', 50, 100, 'Cola 1L')
        None  # Valid: sufficient stock

        >>> validate_movement_data('OUT', 150, 100, 'Cola 1L')
        ValidationError: Nicht genügend Lagerbestand...
    """
    item_display = f" für {item_name}" if item_name else ""

    # Validate positive quantity
    if qty_base <= 0:
        raise ValidationError(
            f"Menge muss > 0 sein{item_display}. Erhalten: {qty_base}"
        )

    # Validate sufficient stock for outgoing movements
    if movement_type in ['OUT', 'DEFECT']:
        if qty_base > current_quantity:
            raise ValidationError(
                f"Nicht genügend Lagerbestand{item_display}. "
                f"Verfügbar: {current_quantity}, Angefordert: {qty_base}"
            )

    # Validate movement type
    valid_types = ['IN', 'OUT', 'RETURN', 'DEFECT', 'ADJUST']
    if movement_type not in valid_types:
        raise ValidationError(
            f"Ungültiger Bewegungstyp: {movement_type}. "
            f"Erlaubt: {', '.join(valid_types)}"
        )


def calculate_delta(movement_type: str, qty_base: int, current_quantity: int) -> int:
    """
    Calculate quantity delta based on movement type.

    Args:
        movement_type: Type of movement (IN, OUT, RETURN, DEFECT, ADJUST)
        qty_base: Quantity to move (in base units)
        current_quantity: Current item quantity (for ADJUST only)

    Returns:
        Delta to apply to current quantity

    Examples:
        >>> calculate_delta('IN', 50, 100)
        50  # Add 50 units

        >>> calculate_delta('OUT', 30, 100)
        -30  # Remove 30 units

        >>> calculate_delta('ADJUST', 75, 100)
        -25  # Adjust from 100 to 75
    """
    if movement_type in ['IN', 'RETURN']:
        return qty_base
    elif movement_type in ['OUT', 'DEFECT']:
        return -qty_base
    elif movement_type == 'ADJUST':
        # ADJUST sets absolute quantity
        return qty_base - current_quantity
    else:
        raise ValidationError(f"Unbekannter Bewegungstyp: {movement_type}")


def verify_ppu_conversion(
    qty_pallets: int,
    qty_packages: int,
    qty_singles: int,
    unit_pallet_factor: int,
    unit_package_factor: int,
    received_qty_base: int,
    strict: bool = True
) -> bool:
    """
    Verify that client-calculated qty_base matches server calculation.

    This provides defense-in-depth against frontend bugs or malicious clients.

    Args:
        qty_pallets: Pallets from client
        qty_packages: Packages from client
        qty_singles: Singles from client
        unit_pallet_factor: Item's pallet factor
        unit_package_factor: Item's package factor
        received_qty_base: qty_base sent by client
        strict: If True, raise ValidationError on mismatch. If False, return bool.

    Returns:
        True if conversion matches, False otherwise (if strict=False)

    Raises:
        ValidationError: If mismatch and strict=True
    """
    calculated = calculate_qty_base(
        qty_pallets,
        qty_packages,
        qty_singles,
        unit_pallet_factor,
        unit_package_factor
    )

    if calculated != received_qty_base:
        error_msg = (
            f"PPU-Konvertierung stimmt nicht überein. "
            f"Berechnet: {calculated}, Erhalten: {received_qty_base} "
            f"(Paletten: {qty_pallets}, Pakete: {qty_packages}, Einzeln: {qty_singles})"
        )
        if strict:
            raise ValidationError(error_msg)
        return False

    return True
