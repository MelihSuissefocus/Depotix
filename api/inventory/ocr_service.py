import re
import logging
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
import cv2
import numpy as np
from PIL import Image
import io
import base64

try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False
    logging.warning("PaddleOCR not available, falling back to Tesseract")

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logging.warning("Tesseract not available")

try:
    from pdf2image import convert_from_bytes
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    logging.warning("pdf2image not available")

logger = logging.getLogger(__name__)

class ReceiptOCRService:
    """OCR service for extracting data from receipts and delivery notes"""
    
    def __init__(self):
        self.paddle_ocr = None
        if PADDLE_AVAILABLE:
            try:
                self.paddle_ocr = PaddleOCR(use_angle_cls=True, lang='de')
            except Exception as e:
                logger.warning(f"Failed to initialize PaddleOCR: {e}")
                self.paddle_ocr = None
    
    def extract_text_from_image(self, image_data: bytes) -> str:
        """Extract text from image using available OCR engines"""
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Try PaddleOCR first (better for German text)
            if self.paddle_ocr:
                try:
                    result = self.paddle_ocr.ocr(np.array(image), cls=True)
                    if result and result[0]:
                        text_lines = []
                        for line in result[0]:
                            if line and len(line) >= 2:
                                text_lines.append(line[1][0])
                        return '\n'.join(text_lines)
                except Exception as e:
                    logger.warning(f"PaddleOCR failed: {e}")
            
            # Fallback to Tesseract
            if TESSERACT_AVAILABLE:
                try:
                    return pytesseract.image_to_string(image, lang='deu+eng')
                except Exception as e:
                    logger.warning(f"Tesseract failed: {e}")
            
            return ""
            
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return ""
    
    def extract_text_from_pdf(self, pdf_data: bytes) -> str:
        """Extract text from PDF using pdf2image + OCR"""
        if not PDF_AVAILABLE:
            return ""
        
        try:
            # Convert PDF to images
            images = convert_from_bytes(pdf_data)
            all_text = []
            
            for image in images:
                # Convert PIL to bytes for OCR
                img_bytes = io.BytesIO()
                image.save(img_bytes, format='PNG')
                img_bytes.seek(0)
                
                text = self.extract_text_from_image(img_bytes.getvalue())
                if text.strip():
                    all_text.append(text)
            
            return '\n'.join(all_text)
            
        except Exception as e:
            logger.error(f"PDF OCR extraction failed: {e}")
            return ""
    
    def preprocess_image(self, image_data: bytes) -> bytes:
        """Preprocess image to improve OCR accuracy"""
        try:
            # Convert to OpenCV format
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply denoising
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(
                denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Convert back to PIL Image
            pil_image = Image.fromarray(thresh)
            
            # Convert to bytes
            img_bytes = io.BytesIO()
            pil_image.save(img_bytes, format='PNG')
            return img_bytes.getvalue()
            
        except Exception as e:
            logger.warning(f"Image preprocessing failed: {e}")
            return image_data
    
    def parse_receipt_data(self, text: str) -> Dict[str, any]:
        """Parse extracted text to extract structured receipt data"""
        if not text.strip():
            return {}
        
        # Clean and normalize text
        text = re.sub(r'\s+', ' ', text.strip())
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        result = {
            'supplier': '',
            'article_name': '',
            'quantity': 0,
            'unit_price': Decimal('0.00'),
            'total_price': Decimal('0.00'),
            'currency': 'EUR',
            'confidence': 0.0,
            'raw_text': text
        }
        
        confidence_score = 0.0
        total_checks = 0
        
        # Extract supplier name (look for common patterns)
        supplier_patterns = [
            r'(?:Lieferant|Supplier|From|Von):\s*([^\n\r]+)',
            r'^([A-Z][a-z\s&]+(?:GmbH|AG|Ltd|Inc|Co\.?))',
            r'^([A-Z][a-z\s]+(?:Brewery|Brauerei|Bier))',
        ]
        
        for pattern in supplier_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                result['supplier'] = match.group(1).strip()
                confidence_score += 0.3
                break
        total_checks += 1
        
        # Extract article name (look for product descriptions)
        article_patterns = [
            r'(?:Artikel|Product|Item):\s*([^\n\r]+)',
            r'^([A-Z][a-z\s]+(?:Ice Tea|Bier|Beer|Softdrink))',
            r'^([A-Z][a-z\s]+(?:0\.\d+\s*L|0\.\d+\s*ml))',
        ]
        
        for pattern in article_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                result['article_name'] = match.group(1).strip()
                confidence_score += 0.2
                break
        total_checks += 1
        
        # Extract quantities (look for numbers with units)
        quantity_patterns = [
            r'(?:Menge|Quantity|Anzahl):\s*(\d+)',
            r'(\d+)\s*(?:Stück|Pieces|Packages|Verpackungen)',
            r'(\d+)\s*(?:Paletten|Pallets)',
        ]
        
        for pattern in quantity_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result['quantity'] = int(match.group(1))
                confidence_score += 0.2
                break
        total_checks += 1
        
        # Extract prices (look for currency amounts)
        price_patterns = [
            r'(?:Preis|Price|EUR|CHF):\s*([\d,\.]+)',
            r'([\d,\.]+)\s*(?:EUR|CHF|\€|\$)',
            r'Total[:\s]*([\d,\.]+)\s*(?:EUR|CHF|\€|\$)',
        ]
        
        for pattern in price_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                # Try to parse the price
                for price_str in matches:
                    try:
                        # Replace comma with dot for decimal parsing
                        price_str = price_str.replace(',', '.')
                        price = Decimal(price_str)
                        if price > 0:
                            result['unit_price'] = price
                            confidence_score += 0.2
                            break
                    except:
                        continue
                break
        total_checks += 1
        
        # Extract currency
        currency_match = re.search(r'(EUR|CHF|\€|\$)', text, re.IGNORECASE)
        if currency_match:
            currency = currency_match.group(1).upper()
            if currency in ['€', '$']:
                result['currency'] = 'EUR' if currency == '€' else 'USD'
            else:
                result['currency'] = currency
            confidence_score += 0.1
        total_checks += 1
        
        # Calculate total confidence
        if total_checks > 0:
            result['confidence'] = min(confidence_score / total_checks, 1.0)
        
        return result
    
    def process_receipt(self, file_data: bytes, file_type: str) -> Dict[str, any]:
        """Main method to process receipt and extract data"""
        try:
            # Determine file type and extract text
            if file_type.lower() == 'pdf':
                text = self.extract_text_from_pdf(file_data)
            else:
                # Preprocess image for better OCR
                processed_data = self.preprocess_image(file_data)
                text = self.extract_text_from_image(processed_data)
            
            # Parse the extracted text
            parsed_data = self.parse_receipt_data(text)
            
            # Add metadata
            parsed_data['file_type'] = file_type
            parsed_data['processing_success'] = bool(text.strip())
            
            return parsed_data
            
        except Exception as e:
            logger.error(f"Receipt processing failed: {e}")
            return {
                'error': str(e),
                'processing_success': False,
                'confidence': 0.0
            }

# Global instance
ocr_service = ReceiptOCRService()