"""
Management Command: invoice_due_reminders
Identifies overdue and upcoming due invoices (idempotent, dry-run default).
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.apps import apps
from datetime import timedelta


class Command(BaseCommand):
    help = "Identifies overdue/upcoming invoices for reminders. Default: --dry-run"

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
            '--days-ahead',
            type=int,
            default=3,
            help='Days ahead to check for upcoming due invoices (default: 3)'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=200,
            help='Maximum invoices to process (default: 200)'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        days_ahead = options['days_ahead']
        limit = options['limit']

        # Try to find Invoice model
        Invoice = None
        try:
            Invoice = apps.get_model('inventory', 'Invoice')
        except LookupError:
            pass

        if Invoice is None:
            self.stdout.write(self.style.WARNING(
                "[WARN] No Invoice model found → no-op"
            ))
            return

        today = timezone.now().date()
        due_soon_date = today + timedelta(days=days_ahead)

        overdue_count = 0
        upcoming_count = 0
        updated_count = 0

        with transaction.atomic():
            # Find overdue invoices (due_date < today, not archived)
            try:
                overdue_qs = (
                    Invoice.objects
                    .filter(due_date__isnull=False, due_date__lt=today)
                    .filter(is_archived=False)
                    .order_by('due_date')[:limit]
                )

                for invoice in overdue_qs:
                    due_date = getattr(invoice, 'due_date', None)
                    if not due_date:
                        continue

                    overdue_days = (today - due_date).days
                    inv_num = getattr(invoice, 'invoice_number', f"ID:{invoice.pk}")

                    self.stdout.write(self.style.ERROR(
                        f"[OVERDUE] {inv_num} - Due: {due_date} ({overdue_days} days ago)"
                    ))
                    overdue_count += 1

                    # Idempotent: increment reminder level if field exists
                    if not dry_run:
                        if hasattr(invoice, 'reminder_level'):
                            current_level = getattr(invoice, 'reminder_level', 0) or 0
                            setattr(invoice, 'reminder_level', min(current_level + 1, 9))
                            invoice.save(update_fields=['reminder_level'])
                            updated_count += 1

            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[ERROR] Processing overdue: {e}"))

            # Find upcoming due invoices (today <= due_date <= days_ahead)
            try:
                upcoming_qs = (
                    Invoice.objects
                    .filter(due_date__gte=today, due_date__lte=due_soon_date)
                    .filter(is_archived=False)
                    .order_by('due_date')[:limit]
                )

                for invoice in upcoming_qs:
                    due_date = getattr(invoice, 'due_date', None)
                    if not due_date:
                        continue

                    days_until = (due_date - today).days
                    inv_num = getattr(invoice, 'invoice_number', f"ID:{invoice.pk}")

                    self.stdout.write(self.style.WARNING(
                        f"[DUE SOON] {inv_num} - Due: {due_date} (in {days_until} days)"
                    ))
                    upcoming_count += 1

            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[ERROR] Processing upcoming: {e}"))

            if dry_run:
                transaction.set_rollback(True)

        # Summary
        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f"\n✅ Dry-run complete: {overdue_count} overdue, {upcoming_count} upcoming"
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"\n✅ Complete: {overdue_count} overdue, {upcoming_count} upcoming, {updated_count} updated"
            ))
