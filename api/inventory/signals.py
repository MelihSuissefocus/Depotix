"""
Django signals for automatic stock adjustment on deletion
"""
from django.db.models.signals import pre_delete, post_delete
from django.dispatch import receiver
from .models import StockMovement, SalesOrder, Invoice
import logging

logger = logging.getLogger(__name__)


@receiver(pre_delete, sender=StockMovement)
def reverse_stock_movement_on_delete(sender, instance, **kwargs):
    """
    Reverse stock changes when a StockMovement is deleted.
    This ensures inventory accuracy when movements are removed.
    """
    try:
        # Get the item and refresh from DB to get latest quantities
        item = instance.item
        item.refresh_from_db()

        # Get conversion factor
        vpk = item.verpackungen_pro_palette

        # Helper function to normalize inventory
        def normalize_inventory(palette_qty, verpackung_qty, verpackungen_pro_palette):
            """Consolidate loose packages into full palettes"""
            total_verpackungen = (palette_qty * verpackungen_pro_palette) + verpackung_qty
            new_palette_qty = total_verpackungen // verpackungen_pro_palette
            new_verpackung_qty = total_verpackungen % verpackungen_pro_palette
            return new_palette_qty, new_verpackung_qty

        logger.info(
            f"Reversing stock movement: {instance.type} - {instance.quantity} {instance.unit} "
            f"for item {item.name} (ID: {item.id})"
        )

        # Store previous quantities for logging
        previous_palette_qty = item.palette_quantity
        previous_verpackung_qty = item.verpackung_quantity

        # Reverse the stock movement by doing the opposite operation
        if instance.type == 'IN':
            # Movement was IN, so we need to remove stock
            if instance.unit == 'palette':
                item.palette_quantity = max(0, item.palette_quantity - instance.quantity)
            elif instance.unit == 'verpackung':
                total_verpackungen = (item.palette_quantity * vpk) + item.verpackung_quantity
                remaining_verpackungen = max(0, total_verpackungen - instance.quantity)
                item.palette_quantity = remaining_verpackungen // vpk
                item.verpackung_quantity = remaining_verpackungen % vpk

        elif instance.type == 'OUT':
            # Movement was OUT, so we need to add stock back
            if instance.unit == 'palette':
                item.palette_quantity += instance.quantity
            elif instance.unit == 'verpackung':
                item.verpackung_quantity += instance.quantity
                item.palette_quantity, item.verpackung_quantity = normalize_inventory(
                    item.palette_quantity,
                    item.verpackung_quantity,
                    vpk
                )

        elif instance.type == 'RETURN':
            # Movement was RETURN, so we need to remove returned stock
            if instance.unit == 'palette':
                item.palette_quantity = max(0, item.palette_quantity - instance.quantity)
            elif instance.unit == 'verpackung':
                total_verpackungen = (item.palette_quantity * vpk) + item.verpackung_quantity
                remaining_verpackungen = max(0, total_verpackungen - instance.quantity)
                item.palette_quantity = remaining_verpackungen // vpk
                item.verpackung_quantity = remaining_verpackungen % vpk

        elif instance.type == 'DEFECT':
            # Movement was DEFECT, so we need to restore from defective
            if instance.unit == 'palette':
                transfer_qty = min(instance.quantity * vpk, item.defective_qty)
                item.defective_qty = max(0, item.defective_qty - transfer_qty)
                # Convert back to verpackungen and normalize
                item.verpackung_quantity += transfer_qty
                item.palette_quantity, item.verpackung_quantity = normalize_inventory(
                    item.palette_quantity,
                    item.verpackung_quantity,
                    vpk
                )
            elif instance.unit == 'verpackung':
                transfer_qty = min(instance.quantity, item.defective_qty)
                item.defective_qty = max(0, item.defective_qty - transfer_qty)
                item.verpackung_quantity += transfer_qty
                item.palette_quantity, item.verpackung_quantity = normalize_inventory(
                    item.palette_quantity,
                    item.verpackung_quantity,
                    vpk
                )

        elif instance.type == 'ADJUST':
            # For ADJUST, we can't reliably reverse it as we don't know the previous value
            # Log a warning instead
            logger.warning(
                f"Cannot automatically reverse ADJUST movement for item {item.name}. "
                f"Manual inventory check recommended."
            )
            return

        # Save the item with updated quantities
        item.save()

        logger.info(
            f"Stock reversed for item {item.name}: "
            f"Paletten: {previous_palette_qty} -> {item.palette_quantity}, "
            f"Verpackungen: {previous_verpackung_qty} -> {item.verpackung_quantity}"
        )

    except Exception as e:
        logger.error(f"Error reversing stock movement on delete: {str(e)}")
        # Re-raise to prevent deletion if stock reversal fails
        raise


@receiver(pre_delete, sender=SalesOrder)
def reverse_sales_order_stock_on_delete(sender, instance, **kwargs):
    """
    Reverse stock changes when a SalesOrder is deleted.
    This restores inventory for all items in the order.
    """
    try:
        # Only reverse stock if order was delivered or invoiced
        # Draft and confirmed orders don't affect stock
        if instance.status not in ['DELIVERED', 'INVOICED']:
            logger.info(
                f"Skipping stock reversal for SalesOrder {instance.order_number} "
                f"(status: {instance.status})"
            )
            return

        logger.info(
            f"Reversing stock for SalesOrder {instance.order_number} "
            f"(status: {instance.status})"
        )

        # Restore stock for each order item
        for order_item in instance.items.all():
            item = order_item.item
            item.refresh_from_db()

            vpk = item.verpackungen_pro_palette

            # Helper function to normalize inventory
            def normalize_inventory(palette_qty, verpackung_qty, verpackungen_pro_palette):
                total_verpackungen = (palette_qty * verpackungen_pro_palette) + verpackung_qty
                new_palette_qty = total_verpackungen // verpackungen_pro_palette
                new_verpackung_qty = total_verpackungen % verpackungen_pro_palette
                return new_palette_qty, new_verpackung_qty

            # Add back the quantity that was removed (qty_base is in Verpackungen)
            quantity_to_restore = order_item.qty_base

            logger.info(
                f"Restoring {quantity_to_restore} Verpackungen for item {item.name}"
            )

            # Add back as verpackungen
            item.verpackung_quantity += quantity_to_restore
            item.palette_quantity, item.verpackung_quantity = normalize_inventory(
                item.palette_quantity,
                item.verpackung_quantity,
                vpk
            )

            item.save()

            logger.info(
                f"Stock restored for item {item.name}: "
                f"Paletten: {item.palette_quantity}, Verpackungen: {item.verpackung_quantity}"
            )

    except Exception as e:
        logger.error(f"Error reversing sales order stock on delete: {str(e)}")
        # Re-raise to prevent deletion if stock reversal fails
        raise


@receiver(pre_delete, sender=Invoice)
def warn_on_invoice_delete(sender, instance, **kwargs):
    """
    Log warning when an invoice is deleted.
    Note: Invoice deletion will cascade to delete the SalesOrder,
    which will trigger the SalesOrder delete signal.
    """
    logger.warning(
        f"Invoice {instance.invoice_number} is being deleted. "
        f"Associated SalesOrder {instance.order.order_number} will also be deleted. "
        f"Stock will be restored automatically."
    )
