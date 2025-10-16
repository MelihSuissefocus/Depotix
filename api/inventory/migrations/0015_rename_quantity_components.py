# Generated manually for renaming quantity components
# Palette, Verpackung, Stück

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0014_invoicetemplate'),
    ]

    operations = [
        # First rename verpackung to temp name to avoid conflicts
        migrations.RenameField(
            model_name='inventoryitem',
            old_name='verpackung',
            new_name='temp_verpackung',
        ),
        # Rename plastik_stueck to verpackung
        migrations.RenameField(
            model_name='inventoryitem',
            old_name='plastik_stueck',
            new_name='verpackung',
        ),
        # Rename temp_verpackung to palette
        migrations.RenameField(
            model_name='inventoryitem',
            old_name='temp_verpackung',
            new_name='palette',
        ),
    ]
