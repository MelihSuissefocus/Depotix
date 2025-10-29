import unittest
from unittest.mock import patch, MagicMock
from decimal import Decimal
from .ocr_service import ReceiptOCRService


class TestReceiptOCRService(unittest.TestCase):
    def setUp(self):
        self.ocr_service = ReceiptOCRService()
    
    def test_parse_receipt_data_empty_text(self):
        """Test parsing with empty text"""
        result = self.ocr_service.parse_receipt_data("")
        
        self.assertEqual(result['supplier'], '')
        self.assertEqual(result['article_name'], '')
        self.assertEqual(result['quantity'], 0)
        self.assertEqual(result['unit_price'], Decimal('0.00'))
        self.assertEqual(result['confidence'], 0.0)
    
    def test_parse_receipt_data_supplier_extraction(self):
        """Test supplier name extraction"""
        text = "Lieferant: Birra Peja\nArtikel: Sola Ice Tea\nMenge: 100"
        result = self.ocr_service.parse_receipt_data(text)
        
        self.assertEqual(result['supplier'], 'Birra Peja')
        self.assertGreater(result['confidence'], 0)
    
    def test_parse_receipt_data_article_extraction(self):
        """Test article name extraction"""
        text = "Artikel: Sola Ice Tea 0.33L\nMenge: 100\nPreis: 7.92"
        result = self.ocr_service.parse_receipt_data(text)
        
        self.assertEqual(result['article_name'], 'Sola Ice Tea 0.33L')
        self.assertGreater(result['confidence'], 0)
    
    def test_parse_receipt_data_quantity_extraction(self):
        """Test quantity extraction"""
        text = "Menge: 2610 Verpackungen\nPreis: 7.92 EUR"
        result = self.ocr_service.parse_receipt_data(text)
        
        self.assertEqual(result['quantity'], 2610)
        self.assertGreater(result['confidence'], 0)
    
    def test_parse_receipt_data_price_extraction(self):
        """Test price extraction"""
        text = "Preis: 7.92 EUR\nTotal: 20671.20 EUR"
        result = self.ocr_service.parse_receipt_data(text)
        
        self.assertEqual(result['unit_price'], Decimal('7.92'))
        self.assertEqual(result['currency'], 'EUR')
        self.assertGreater(result['confidence'], 0)
    
    def test_parse_receipt_data_currency_detection(self):
        """Test currency detection"""
        text_chf = "Preis: 7.92 CHF"
        result_chf = self.ocr_service.parse_receipt_data(text_chf)
        self.assertEqual(result_chf['currency'], 'CHF')
        
        text_eur = "Preis: 7.92 EUR"
        result_eur = self.ocr_service.parse_receipt_data(text_eur)
        self.assertEqual(result_eur['currency'], 'EUR')
    
    def test_parse_receipt_data_confidence_calculation(self):
        """Test confidence score calculation"""
        # High confidence text with all fields
        text = """
        Lieferant: Birra Peja
        Artikel: Sola Ice Tea 0.33L
        Menge: 2610 Verpackungen
        Preis: 7.92 EUR
        """
        result = self.ocr_service.parse_receipt_data(text)
        
        self.assertGreater(result['confidence'], 0.5)
        self.assertLessEqual(result['confidence'], 1.0)
    
    def test_parse_receipt_data_complex_receipt(self):
        """Test parsing complex receipt format"""
        text = """
        BIRRA PEJA
        Lieferschein Nr. 12345
        
        Artikelbezeichnung: Sola Ice Tea BP 0,33 L KAN JO_KTH 1/24
        Unit (Verpackungen je Palette): 90
        Packages (Gesamtanzahl der Verpackungen): 2610
        Quantity (Stück gesamt): 62640
        Anzahl Stück pro Verpackung: 24
        Package Weight (kg): 2499.34
        Price per Unit (EUR): 7.92
        Einkaufspreis Einstellung (EUR): 7.92
        
        Total: 20671.20 EUR
        """
        
        result = self.ocr_service.parse_receipt_data(text)
        
        self.assertIn('Birra Peja', result['supplier'])
        self.assertIn('Sola Ice Tea', result['article_name'])
        self.assertEqual(result['quantity'], 2610)
        self.assertEqual(result['unit_price'], Decimal('7.92'))
        self.assertEqual(result['currency'], 'EUR')
        self.assertGreater(result['confidence'], 0.3)
    
    @patch('inventory.ocr_service.PaddleOCR')
    def test_extract_text_from_image_paddle_success(self, mock_paddle):
        """Test text extraction with PaddleOCR success"""
        # Mock PaddleOCR
        mock_ocr_instance = MagicMock()
        mock_ocr_instance.ocr.return_value = [[
            [None, ('Test text', 0.9)],
            [None, ('More text', 0.8)]
        ]]
        mock_paddle.return_value = mock_ocr_instance
        
        # Create test image data
        image_data = b'fake_image_data'
        
        result = self.ocr_service.extract_text_from_image(image_data)
        
        self.assertEqual(result, 'Test text\nMore text')
        mock_ocr_instance.ocr.assert_called_once()
    
    @patch('inventory.ocr_service.pytesseract')
    def test_extract_text_from_image_tesseract_fallback(self, mock_tesseract):
        """Test text extraction with Tesseract fallback"""
        # Mock PaddleOCR to fail
        with patch('inventory.ocr_service.PADDLE_AVAILABLE', False):
            # Mock Tesseract
            mock_tesseract.image_to_string.return_value = 'Tesseract text'
            
            # Create test image data
            image_data = b'fake_image_data'
            
            result = self.ocr_service.extract_text_from_image(image_data)
            
            self.assertEqual(result, 'Tesseract text')
            mock_tesseract.image_to_string.assert_called_once()
    
    def test_preprocess_image(self):
        """Test image preprocessing"""
        # Create a simple test image data
        image_data = b'fake_image_data'
        
        # This should not raise an exception
        result = self.ocr_service.preprocess_image(image_data)
        
        # Should return bytes (either processed or original)
        self.assertIsInstance(result, bytes)
    
    def test_process_receipt_image(self):
        """Test complete receipt processing for image"""
        with patch.object(self.ocr_service, 'extract_text_from_image') as mock_extract:
            mock_extract.return_value = """
            Lieferant: Test Supplier
            Artikel: Test Article
            Menge: 100
            Preis: 5.50 EUR
            """
            
            file_data = b'fake_image_data'
            result = self.ocr_service.process_receipt(file_data, 'image')
            
            self.assertTrue(result['processing_success'])
            self.assertEqual(result['supplier'], 'Test Supplier')
            self.assertEqual(result['article_name'], 'Test Article')
            self.assertEqual(result['quantity'], 100)
            self.assertEqual(result['unit_price'], Decimal('5.50'))
            self.assertEqual(result['file_type'], 'image')
    
    def test_process_receipt_pdf(self):
        """Test complete receipt processing for PDF"""
        with patch.object(self.ocr_service, 'extract_text_from_pdf') as mock_extract:
            mock_extract.return_value = """
            Lieferant: PDF Supplier
            Artikel: PDF Article
            Menge: 200
            Preis: 10.00 EUR
            """
            
            file_data = b'fake_pdf_data'
            result = self.ocr_service.process_receipt(file_data, 'pdf')
            
            self.assertTrue(result['processing_success'])
            self.assertEqual(result['supplier'], 'PDF Supplier')
            self.assertEqual(result['article_name'], 'PDF Article')
            self.assertEqual(result['quantity'], 200)
            self.assertEqual(result['unit_price'], Decimal('10.00'))
            self.assertEqual(result['file_type'], 'pdf')
    
    def test_process_receipt_error_handling(self):
        """Test error handling in receipt processing"""
        with patch.object(self.ocr_service, 'extract_text_from_image', side_effect=Exception('OCR Error')):
            file_data = b'fake_image_data'
            result = self.ocr_service.process_receipt(file_data, 'image')
            
            self.assertFalse(result['processing_success'])
            self.assertIn('error', result)
            self.assertEqual(result['confidence'], 0.0)


if __name__ == '__main__':
    unittest.main()