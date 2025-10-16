# Generated migration for InvoiceTemplate model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('inventory', '0013_inventoryitem_quantity_components'),
    ]

    operations = [
        migrations.CreateModel(
            name='InvoiceTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('html_content', models.TextField(help_text='HTML template für Rechnung')),
                ('css_content', models.TextField(help_text='CSS Styles für Rechnung')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='invoice_template', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name='invoicetemplate',
            index=models.Index(fields=['user'], name='inventory_i_user_id_idx'),
        ),
    ]
