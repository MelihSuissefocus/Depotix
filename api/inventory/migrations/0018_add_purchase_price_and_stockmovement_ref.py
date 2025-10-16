# Generated migration for adding purchase_price to StockMovement and stock_movement to Expense

from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0017_salesorderitem_unit_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockmovement',
            name='purchase_price',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Einkaufspreis für diesen Wareneingang (nur bei type=IN)',
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
                verbose_name='Einkaufspreis'
            ),
        ),
        migrations.AddField(
            model_name='expense',
            name='stock_movement',
            field=models.ForeignKey(
                blank=True,
                help_text='Verknüpfte Warenbewegung (automatisch erstellt bei Wareneingang)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='expense',
                to='inventory.stockmovement',
                verbose_name='Warenbewegung'
            ),
        ),
    ]
