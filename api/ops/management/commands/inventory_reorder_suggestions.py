"""
Management Command: inventory_reorder_suggestions
Identifies inventory items below minimum stock level (idempotent, dry-run default).
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F
from django.apps import apps


class Command(BaseCommand):
    help = "Identifies inventory items needing reorder (quantity < min_stock_level). Default: --dry-run"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=True,
            help='Preview mode (default: True). Use --no-dry-run to apply changes.'
        )
        parser.add_argument(
            '--no-dry-run',
            dest='dry_run',
            action='store_false',
            help='Actually apply changes (disable dry-run mode)'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=500,
            help='Maximum items to process (default: 500)'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        limit = options['limit']

        # Try to find InventoryItem model (heuristic approach)
        InventoryItem = None
        try:
            InventoryItem = apps.get_model('inventory', 'InventoryItem')
        except LookupError:
            pass

        if InventoryItem is None:
            self.stdout.write(self.style.WARNING(
                "[WARN] No InventoryItem model found → no-op"
            ))
            return

        found_count = 0
        flagged_count = 0

        with transaction.atomic():
            # Find items where current stock < minimum stock level
            # Using palette_quantity as current stock indicator
            queryset = (
                InventoryItem.objects
                .filter(is_active=True, min_stock_level__gt=0)
                .filter(palette_quantity__lt=F('min_stock_level'))
                .order_by('id')[:limit]
            )

            found_count = queryset.count()

            for item in queryset:
                current = getattr(item, 'palette_quantity', 0) or 0
                minimum = getattr(item, 'min_stock_level', 0) or 0
                deficit = minimum - current

                msg = (
                    f"[reorder] id={item.pk} sku={getattr(item, 'sku', 'N/A')} "
                    f"current={current} min={minimum} deficit={deficit}"
                )

                if dry_run:
                    self.stdout.write(self.style.WARNING(f"{msg} [DRY-RUN]"))
                else:
                    # Idempotent: only set flag if it exists and isn't already set
                    if hasattr(item, 'reorder_needed'):
                        if not getattr(item, 'reorder_needed'):
                            setattr(item, 'reorder_needed', True)
                            item.save(update_fields=['reorder_needed'])
                            flagged_count += 1
                            self.stdout.write(self.style.SUCCESS(f"{msg} [FLAGGED]"))
                        else:
                            self.stdout.write(f"{msg} [ALREADY FLAGGED]")
                    else:
                        self.stdout.write(self.style.WARNING(f"{msg} [NO FLAG FIELD]"))

            if dry_run:
                transaction.set_rollback(True)

        # Summary
        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f"\n✅ Dry-run complete: found {found_count} items needing reorder"
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"\n✅ Complete: found {found_count} items, flagged {flagged_count}"
            ))
