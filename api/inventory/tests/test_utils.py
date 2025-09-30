"""
Unit tests for inventory utility functions.

These tests verify the correctness of PPU conversion and validation logic.
"""

from django.test import TestCase
from django.core.exceptions import ValidationError
from inventory.utils import (
    calculate_qty_base,
    validate_movement_data,
    calculate_delta,
    verify_ppu_conversion
)


class CalculateQtyBaseTests(TestCase):
    """Test PPU to base unit conversion"""

    def test_pallets_only(self):
        """Test conversion with only pallets"""
        result = calculate_qty_base(
            qty_pallets=2,
            qty_packages=0,
            qty_singles=0,
            unit_pallet_factor=10,
            unit_package_factor=6
        )
        # 2 pallets × 10 packages/pallet × 6 units/package = 120
        self.assertEqual(result, 120)

    def test_packages_only(self):
        """Test conversion with only packages"""
        result = calculate_qty_base(
            qty_pallets=0,
            qty_packages=3,
            qty_singles=0,
            unit_pallet_factor=10,
            unit_package_factor=6
        )
        # 3 packages × 6 units/package = 18
        self.assertEqual(result, 18)

    def test_singles_only(self):
        """Test conversion with only singles"""
        result = calculate_qty_base(
            qty_pallets=0,
            qty_packages=0,
            qty_singles=5,
            unit_pallet_factor=10,
            unit_package_factor=6
        )
        # 5 singles = 5
        self.assertEqual(result, 5)

    def test_mixed_units(self):
        """Test conversion with all unit types"""
        result = calculate_qty_base(
            qty_pallets=1,
            qty_packages=2,
            qty_singles=3,
            unit_pallet_factor=10,
            unit_package_factor=6
        )
        # 1×10×6 + 2×6 + 3 = 60 + 12 + 3 = 75
        self.assertEqual(result, 75)

    def test_zero_quantity_raises_error(self):
        """Test that zero total quantity raises ValidationError"""
        with self.assertRaises(ValidationError) as ctx:
            calculate_qty_base(0, 0, 0, 10, 6)
        self.assertIn("muss > 0 sein", str(ctx.exception))

    def test_negative_quantities_raise_error(self):
        """Test that negative quantities raise ValidationError"""
        with self.assertRaises(ValidationError):
            calculate_qty_base(-1, 0, 0, 10, 6)

        with self.assertRaises(ValidationError):
            calculate_qty_base(0, -2, 0, 10, 6)

        with self.assertRaises(ValidationError):
            calculate_qty_base(0, 0, -3, 10, 6)

    def test_invalid_factors_raise_error(self):
        """Test that invalid unit factors raise ValidationError"""
        with self.assertRaises(ValidationError):
            calculate_qty_base(1, 0, 0, 0, 6)  # pallet_factor = 0

        with self.assertRaises(ValidationError):
            calculate_qty_base(1, 0, 0, 10, 0)  # package_factor = 0


class ValidateMovementDataTests(TestCase):
    """Test movement validation logic"""

    def test_valid_in_movement(self):
        """Test valid IN movement"""
        # Should not raise
        validate_movement_data('IN', 50, 100, 'Test Item')

    def test_valid_out_movement(self):
        """Test valid OUT movement with sufficient stock"""
        # Should not raise
        validate_movement_data('OUT', 50, 100, 'Test Item')

    def test_invalid_out_insufficient_stock(self):
        """Test OUT movement with insufficient stock raises error"""
        with self.assertRaises(ValidationError) as ctx:
            validate_movement_data('OUT', 150, 100, 'Test Item')
        self.assertIn("Nicht genügend Lagerbestand", str(ctx.exception))
        self.assertIn("Verfügbar: 100", str(ctx.exception))
        self.assertIn("Angefordert: 150", str(ctx.exception))

    def test_invalid_defect_insufficient_stock(self):
        """Test DEFECT movement with insufficient stock raises error"""
        with self.assertRaises(ValidationError) as ctx:
            validate_movement_data('DEFECT', 150, 100)
        self.assertIn("Nicht genügend Lagerbestand", str(ctx.exception))

    def test_zero_quantity_raises_error(self):
        """Test that zero quantity raises ValidationError"""
        with self.assertRaises(ValidationError) as ctx:
            validate_movement_data('IN', 0, 100)
        self.assertIn("Menge muss > 0 sein", str(ctx.exception))

    def test_negative_quantity_raises_error(self):
        """Test that negative quantity raises ValidationError"""
        with self.assertRaises(ValidationError):
            validate_movement_data('IN', -10, 100)

    def test_invalid_movement_type_raises_error(self):
        """Test that invalid movement type raises ValidationError"""
        with self.assertRaises(ValidationError) as ctx:
            validate_movement_data('INVALID', 50, 100)
        self.assertIn("Ungültiger Bewegungstyp", str(ctx.exception))


class CalculateDeltaTests(TestCase):
    """Test delta calculation for different movement types"""

    def test_in_movement_positive_delta(self):
        """Test IN movement returns positive delta"""
        delta = calculate_delta('IN', 50, 100)
        self.assertEqual(delta, 50)

    def test_return_movement_positive_delta(self):
        """Test RETURN movement returns positive delta"""
        delta = calculate_delta('RETURN', 30, 100)
        self.assertEqual(delta, 30)

    def test_out_movement_negative_delta(self):
        """Test OUT movement returns negative delta"""
        delta = calculate_delta('OUT', 40, 100)
        self.assertEqual(delta, -40)

    def test_defect_movement_negative_delta(self):
        """Test DEFECT movement returns negative delta"""
        delta = calculate_delta('DEFECT', 20, 100)
        self.assertEqual(delta, -20)

    def test_adjust_movement_delta(self):
        """Test ADJUST movement calculates delta correctly"""
        # Adjust from 100 to 75 (decrease)
        delta = calculate_delta('ADJUST', 75, 100)
        self.assertEqual(delta, -25)

        # Adjust from 100 to 150 (increase)
        delta = calculate_delta('ADJUST', 150, 100)
        self.assertEqual(delta, 50)

    def test_invalid_movement_type(self):
        """Test invalid movement type raises error"""
        with self.assertRaises(ValidationError):
            calculate_delta('INVALID', 50, 100)


class VerifyPPUConversionTests(TestCase):
    """Test PPU conversion verification (defense-in-depth)"""

    def test_matching_conversion_returns_true(self):
        """Test that matching conversion returns True"""
        result = verify_ppu_conversion(
            qty_pallets=1,
            qty_packages=2,
            qty_singles=3,
            unit_pallet_factor=10,
            unit_package_factor=6,
            received_qty_base=75,  # 1×10×6 + 2×6 + 3 = 75
            strict=False
        )
        self.assertTrue(result)

    def test_mismatching_conversion_strict_raises(self):
        """Test that mismatch with strict=True raises ValidationError"""
        with self.assertRaises(ValidationError) as ctx:
            verify_ppu_conversion(
                qty_pallets=1,
                qty_packages=2,
                qty_singles=3,
                unit_pallet_factor=10,
                unit_package_factor=6,
                received_qty_base=100,  # Wrong! Should be 75
                strict=True
            )
        self.assertIn("PPU-Konvertierung stimmt nicht überein", str(ctx.exception))
        self.assertIn("Berechnet: 75", str(ctx.exception))
        self.assertIn("Erhalten: 100", str(ctx.exception))

    def test_mismatching_conversion_non_strict_returns_false(self):
        """Test that mismatch with strict=False returns False"""
        result = verify_ppu_conversion(
            qty_pallets=1,
            qty_packages=0,
            qty_singles=0,
            unit_pallet_factor=10,
            unit_package_factor=6,
            received_qty_base=50,  # Wrong! Should be 60
            strict=False
        )
        self.assertFalse(result)
