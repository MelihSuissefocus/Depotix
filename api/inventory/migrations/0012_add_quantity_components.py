# Generated manually
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0011_stockmovement_movement_timestamp'),
    ]

    operations = [
        migrations.AddField(
            model_name='inventoryitem',
            name='verpackung',
            field=models.IntegerField(default=1, help_text='Anzahl Verpackungen pro Einheit', validators=[django.core.validators.MinValueValidator(1)]),
        ),
        migrations.AddField(
            model_name='inventoryitem',
            name='plastik_stueck',
            field=models.IntegerField(default=1, help_text='Anzahl Plastikstücke pro Einheit', validators=[django.core.validators.MinValueValidator(1)]),
        ),
        migrations.AddField(
            model_name='inventoryitem',
            name='stueck',
            field=models.IntegerField(default=1, help_text='Anzahl Stücke pro Einheit', validators=[django.core.validators.MinValueValidator(1)]),
        ),
    ]
