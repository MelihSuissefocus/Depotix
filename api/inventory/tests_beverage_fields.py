"""
Tests für die neuen Getränke-spezifischen Felder im InventoryItem Modell
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from rest_framework.test import APITestCase
from rest_framework import status
from .models import InventoryItem, Category
from .serializers import InventoryItemSerializer


class BeverageFieldsModelTest(TestCase):
    """Test der neuen Getränke-Felder im Model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.category = Category.objects.create(
            name='Test Category',
            description='Test description'
        )
    
    def test_create_basic_item_with_defaults(self):
        """Test: Erstelle Item mit nur Pflichtfeldern - neue Felder haben korrekte Defaults"""
        item = InventoryItem.objects.create(
            name='Test Bier',
            price=Decimal('3.50'),
            owner=self.user,
            category=self.category
        )
        
        # Prüfe Defaults
        self.assertEqual(float(item.vat_rate), 8.1)  # Django speichert als 8.1
        self.assertEqual(item.deposit_chf, Decimal('0'))
        self.assertFalse(item.is_returnable)
        self.assertFalse(item.is_alcoholic)
        self.assertIsNone(item.brand)
        self.assertIsNone(item.beverage_type)
    
    def test_create_complete_beverage_item(self):
        """Test: Erstelle vollständiges Getränke-Item"""
        item = InventoryItem.objects.create(
            name='Augustiner Lagerbier Hell',
            description='Bayerisches Bier aus München',
            price=Decimal('2.85'),
            owner=self.user,
            category=self.category,
            brand='Augustiner Bräu',
            beverage_type='beer',
            container_type='glass',
            volume_ml=500,
            deposit_chf=Decimal('0.15'),
            is_returnable=True,
            is_alcoholic=True,
            abv_percent=Decimal('5.2'),
            country_of_origin='DE',
            ean_unit='4001071001234',
            ean_pack='4001071005678',
            vat_rate=Decimal('7.7')
        )
        
        # Prüfe alle Felder
        self.assertEqual(item.brand, 'Augustiner Bräu')
        self.assertEqual(item.beverage_type, 'beer')
        self.assertEqual(item.container_type, 'glass')
        self.assertEqual(item.volume_ml, 500)
        self.assertEqual(item.deposit_chf, Decimal('0.15'))
        self.assertTrue(item.is_returnable)
        self.assertTrue(item.is_alcoholic)
        self.assertEqual(item.abv_percent, Decimal('5.2'))
        self.assertEqual(item.country_of_origin, 'DE')
        self.assertEqual(item.ean_unit, '4001071001234')
        self.assertEqual(item.vat_rate, Decimal('7.7'))


class BeverageFieldsSerializerTest(TestCase):
    """Test der Serializer-Validierung für Getränke-Felder"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.category = Category.objects.create(
            name='Test Category'
        )
    
    def test_alcoholic_item_without_abv_sets_default(self):
        """Test: Alkoholisches Getränk ohne abv_percent bekommt Default 0"""
        data = {
            'name': 'Test Beer',
            'price': '3.50',
            'category': self.category.id,
            'is_alcoholic': True,
            # abv_percent fehlt
        }
        
        serializer = InventoryItemSerializer(data=data, context={'request': type('obj', (object,), {'user': self.user})()})
        self.assertTrue(serializer.is_valid())
        
        # abv_percent sollte auf 0 gesetzt werden
        validated_data = serializer.validated_data
        self.assertEqual(validated_data['abv_percent'], Decimal('0'))
    
    def test_vat_rate_validation(self):
        """Test: MwSt.-Rate Validierung"""
        # Zu hohe Rate
        data = {
            'name': 'Test Item',
            'price': '3.50',
            'category': self.category.id,
            'vat_rate': '30.0'  # Über 25%
        }
        
        serializer = InventoryItemSerializer(data=data, context={'request': type('obj', (object,), {'user': self.user})()})
        self.assertFalse(serializer.is_valid())
        self.assertIn('MwSt.-Rate muss zwischen 0% und 25% liegen', str(serializer.errors))
        
        # Negative Rate
        data['vat_rate'] = '-5.0'
        serializer = InventoryItemSerializer(data=data, context={'request': type('obj', (object,), {'user': self.user})()})
        self.assertFalse(serializer.is_valid())
        self.assertIn('MwSt.-Rate muss zwischen 0% und 25% liegen', str(serializer.errors))


class BeverageFieldsAPITest(APITestCase):
    """Test der API-Endpunkte mit Getränke-Feldern"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.category = Category.objects.create(
            name='Getränke',
            description='Verschiedene Getränke'
        )
        
        # Authentifizierung
        self.client.force_authenticate(user=self.user)
    
    def test_create_item_with_beverage_fields(self):
        """Test: Item mit Getränke-Feldern über API erstellen"""
        data = {
            'name': 'Coca Cola',
            'description': 'Klassische Cola',
            'price': '2.50',
            'quantity': 100,
            'category': self.category.id,
            'brand': 'Coca-Cola',
            'beverage_type': 'softdrink',
            'container_type': 'can',
            'volume_ml': 330,
            'deposit_chf': '0.25',
            'is_returnable': True,
            'is_alcoholic': False,
            'country_of_origin': 'US',
            'ean_unit': '5449000054227',
            'vat_rate': '7.7'
        }
        
        response = self.client.post('/api/items/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Prüfe Response-Daten
        response_data = response.json()
        self.assertEqual(response_data['brand'], 'Coca-Cola')
        self.assertEqual(response_data['beverage_type'], 'softdrink')
        self.assertEqual(response_data['container_type'], 'can')
        self.assertEqual(response_data['volume_ml'], 330)
        self.assertEqual(response_data['deposit_chf'], '0.25')
        self.assertTrue(response_data['is_returnable'])
        self.assertFalse(response_data['is_alcoholic'])
        
    def test_get_item_includes_beverage_fields(self):
        """Test: GET Item enthält alle Getränke-Felder"""
        # Erstelle Item mit Getränke-Feldern
        item = InventoryItem.objects.create(
            name='Warsteiner Pilsener',
            price=Decimal('1.99'),
            owner=self.user,
            category=self.category,
            brand='Warsteiner',
            beverage_type='beer',
            container_type='can',
            volume_ml=500,
            is_alcoholic=True,
            abv_percent=Decimal('4.8')
        )
        
        response = self.client.get(f'/api/items/{item.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        data = response.json()
        self.assertEqual(data['brand'], 'Warsteiner')
        self.assertEqual(data['beverage_type'], 'beer')
        self.assertEqual(data['abv_percent'], '4.80')
        self.assertTrue(data['is_alcoholic'])
