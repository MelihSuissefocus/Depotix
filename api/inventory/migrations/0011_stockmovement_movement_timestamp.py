# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0010_add_receipt_pdf_to_expense'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockmovement',
            name='movement_timestamp',
            field=models.DateTimeField(blank=True, help_text='Optional custom timestamp for when the movement occurred. If not set, created_at is used.', null=True),
        ),
    ]
