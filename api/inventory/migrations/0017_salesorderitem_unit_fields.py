# Generated migration for SalesOrderItem unit fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0016_refactor_quantity_system'),
    ]

    operations = [
        migrations.AddField(
            model_name='salesorderitem',
            name='qty_display',
            field=models.PositiveIntegerField(default=1, help_text='Display quantity (in selected unit)'),
        ),
        migrations.AddField(
            model_name='salesorderitem',
            name='selected_unit',
            field=models.CharField(
                choices=[('palette', 'Palette'), ('verpackung', 'Verpackung')],
                default='verpackung',
                help_text='Unit selected for display on invoice',
                max_length=20
            ),
        ),
        migrations.AlterField(
            model_name='salesorderitem',
            name='qty_base',
            field=models.PositiveIntegerField(help_text='Quantity in base units (Verpackungen)'),
        ),
    ]
