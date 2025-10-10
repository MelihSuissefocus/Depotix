# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0009_add_delivery_date_to_invoice'),
    ]

    operations = [
        migrations.AddField(
            model_name='expense',
            name='receipt_pdf',
            field=models.FileField(blank=True, null=True, upload_to='expense_receipts/'),
        ),
    ]
