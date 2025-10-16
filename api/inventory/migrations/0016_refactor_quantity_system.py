# Generated migration for complete quantity system refactor
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0015_rename_quantity_components'),
    ]

    operations = [
        # ============================================================
        # STEP 1: Rename existing fields (Umrechnungsfaktoren)
        # ============================================================
        migrations.RenameField(
            model_name='inventoryitem',
            old_name='palette',
            new_name='verpackungen_pro_palette',
        ),
        migrations.RenameField(
            model_name='inventoryitem',
            old_name='verpackung',
            new_name='stueck_pro_verpackung',
        ),

        # ============================================================
        # STEP 2: Remove stueck field (not needed)
        # ============================================================
        migrations.RemoveField(
            model_name='inventoryitem',
            name='stueck',
        ),

        # ============================================================
        # STEP 3: Add new quantity fields for stock tracking
        # ============================================================
        migrations.AddField(
            model_name='inventoryitem',
            name='palette_quantity',
            field=models.IntegerField(
                default=0,
                validators=[django.core.validators.MinValueValidator(0)],
                help_text="Anzahl Paletten auf Lager"
            ),
        ),
        migrations.AddField(
            model_name='inventoryitem',
            name='verpackung_quantity',
            field=models.IntegerField(
                default=0,
                validators=[django.core.validators.MinValueValidator(0)],
                help_text="Anzahl Verpackungen auf Lager"
            ),
        ),

        # ============================================================
        # STEP 4: Update help texts for renamed fields
        # ============================================================
        migrations.AlterField(
            model_name='inventoryitem',
            name='verpackungen_pro_palette',
            field=models.IntegerField(
                default=1,
                validators=[django.core.validators.MinValueValidator(1)],
                help_text="Wie viele Verpackungen hat eine Palette"
            ),
        ),
        migrations.AlterField(
            model_name='inventoryitem',
            name='stueck_pro_verpackung',
            field=models.IntegerField(
                default=1,
                validators=[django.core.validators.MinValueValidator(1)],
                help_text="Wie viele Stück hat eine Verpackung (nur Info)"
            ),
        ),

        # ============================================================
        # STEP 5: Remove old quantity field
        # ============================================================
        migrations.RemoveField(
            model_name='inventoryitem',
            name='quantity',
        ),

        # ============================================================
        # STEP 6: Update StockMovement fields
        # ============================================================
        migrations.RemoveField(
            model_name='stockmovement',
            name='qty_base',
        ),
        migrations.RemoveField(
            model_name='stockmovement',
            name='qty_pallets',
        ),
        migrations.RemoveField(
            model_name='stockmovement',
            name='qty_packages',
        ),
        migrations.RemoveField(
            model_name='stockmovement',
            name='qty_singles',
        ),

        migrations.AddField(
            model_name='stockmovement',
            name='unit',
            field=models.CharField(
                max_length=20,
                choices=[('palette', 'Palette'), ('verpackung', 'Verpackung')],
                default='verpackung',
                help_text='Einheit der Bewegung'
            ),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='quantity',
            field=models.IntegerField(
                default=0,
                help_text='Menge in der gewählten Einheit'
            ),
        ),
    ]
