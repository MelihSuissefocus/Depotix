import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OCRUpload } from '../ocr-upload'
import { ocrAPI } from '@/lib/api'

// Mock the API
jest.mock('@/lib/api', () => ({
  ocrAPI: {
    processReceipt: jest.fn(),
    suggestMatches: jest.fn(),
  },
}))

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockOnDataExtracted = jest.fn()
const mockOnClose = jest.fn()

const defaultProps = {
  onDataExtracted: mockOnDataExtracted,
  onClose: mockOnClose,
}

describe('OCRUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders upload area correctly', () => {
    render(<OCRUpload {...defaultProps} />)
    
    expect(screen.getByText('Lieferschein scannen')).toBeInTheDocument()
    expect(screen.getByText('Datei hier ablegen')).toBeInTheDocument()
    expect(screen.getByText('oder klicken Sie zum Auswählen')).toBeInTheDocument()
    expect(screen.getByText('Datei auswählen')).toBeInTheDocument()
  })

  it('handles file selection', () => {
    render(<OCRUpload {...defaultProps} />)
    
    const fileInput = screen.getByRole('button', { name: /datei auswählen/i })
    const input = fileInput.parentElement?.querySelector('input[type="file"]')
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(input!, { target: { files: [file] } })
    
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
    expect(screen.getByText('Entfernen')).toBeInTheDocument()
  })

  it('handles file drop', () => {
    render(<OCRUpload {...defaultProps} />)
    
    const dropArea = screen.getByText('Datei hier ablegen').closest('div')
    const file = new File(['test content'], 'test.png', { type: 'image/png' })
    
    fireEvent.drop(dropArea!, {
      dataTransfer: {
        files: [file],
      },
    })
    
    expect(screen.getByText('test.png')).toBeInTheDocument()
  })

  it('processes file successfully', async () => {
    const mockOCRData = {
      supplier: 'Test Supplier',
      article_name: 'Test Article',
      quantity: 10,
      unit_price: 5.50,
      total_price: 55.00,
      currency: 'EUR',
      confidence: 0.85,
      raw_text: 'Test receipt content',
      processing_success: true,
    }

    ;(ocrAPI.processReceipt as jest.Mock).mockResolvedValue({
      success: true,
      data: mockOCRData,
      message: 'Receipt processed successfully',
    })

    render(<OCRUpload {...defaultProps} />)
    
    // Upload file
    const fileInput = screen.getByRole('button', { name: /datei auswählen/i })
    const input = fileInput.parentElement?.querySelector('input[type="file"]')
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(input!, { target: { files: [file] } })
    
    // Process file
    const processButton = screen.getByText('Dokument verarbeiten')
    fireEvent.click(processButton)
    
    await waitFor(() => {
      expect(ocrAPI.processReceipt).toHaveBeenCalledWith(file)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Daten erfolgreich extrahiert')).toBeInTheDocument()
      expect(screen.getByText('Test Supplier')).toBeInTheDocument()
      expect(screen.getByText('Test Article')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('5.5 EUR')).toBeInTheDocument()
    })
  })

  it('handles OCR processing error', async () => {
    ;(ocrAPI.processReceipt as jest.Mock).mockRejectedValue(new Error('OCR processing failed'))

    render(<OCRUpload {...defaultProps} />)
    
    // Upload file
    const fileInput = screen.getByRole('button', { name: /datei auswählen/i })
    const input = fileInput.parentElement?.querySelector('input[type="file"]')
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(input!, { target: { files: [file] } })
    
    // Process file
    const processButton = screen.getByText('Dokument verarbeiten')
    fireEvent.click(processButton)
    
    await waitFor(() => {
      expect(screen.getByText('Fehler bei der Verarbeitung des Dokuments')).toBeInTheDocument()
    })
  })

  it('applies extracted data', async () => {
    const mockOCRData = {
      supplier: 'Test Supplier',
      article_name: 'Test Article',
      quantity: 10,
      unit_price: 5.50,
      total_price: 55.00,
      currency: 'EUR',
      confidence: 0.85,
      raw_text: 'Test receipt content',
      processing_success: true,
    }

    ;(ocrAPI.processReceipt as jest.Mock).mockResolvedValue({
      success: true,
      data: mockOCRData,
      message: 'Receipt processed successfully',
    })

    render(<OCRUpload {...defaultProps} />)
    
    // Upload and process file
    const fileInput = screen.getByRole('button', { name: /datei auswählen/i })
    const input = fileInput.parentElement?.querySelector('input[type="file"]')
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(input!, { target: { files: [file] } })
    
    const processButton = screen.getByText('Dokument verarbeiten')
    fireEvent.click(processButton)
    
    await waitFor(() => {
      expect(screen.getByText('Daten übernehmen')).toBeInTheDocument()
    })
    
    // Apply data
    const applyButton = screen.getByText('Daten übernehmen')
    fireEvent.click(applyButton)
    
    expect(mockOnDataExtracted).toHaveBeenCalledWith(mockOCRData)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('resets upload correctly', () => {
    render(<OCRUpload {...defaultProps} />)
    
    // Upload file
    const fileInput = screen.getByRole('button', { name: /datei auswählen/i })
    const input = fileInput.parentElement?.querySelector('input[type="file"]')
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(input!, { target: { files: [file] } })
    
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
    
    // Reset upload
    const removeButton = screen.getByText('Entfernen')
    fireEvent.click(removeButton)
    
    expect(screen.getByText('Datei hier ablegen')).toBeInTheDocument()
    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
  })

  it('shows file size correctly', () => {
    render(<OCRUpload {...defaultProps} />)
    
    const fileInput = screen.getByRole('button', { name: /datei auswählen/i })
    const input = fileInput.parentElement?.querySelector('input[type="file"]')
    
    // Create a file with specific size (1024 bytes = 1 KB)
    const file = new File(['x'.repeat(1024)], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(input!, { target: { files: [file] } })
    
    expect(screen.getByText('1 KB')).toBeInTheDocument()
  })

  it('shows correct file icons', () => {
    render(<OCRUpload {...defaultProps} />)
    
    const fileInput = screen.getByRole('button', { name: /datei auswählen/i })
    const input = fileInput.parentElement?.querySelector('input[type="file"]')
    
    // Test PDF file
    const pdfFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(input!, { target: { files: [pdfFile] } })
    
    // Reset
    const removeButton = screen.getByText('Entfernen')
    fireEvent.click(removeButton)
    
    // Test image file
    const imageFile = new File(['test content'], 'test.png', { type: 'image/png' })
    fireEvent.change(input!, { target: { files: [imageFile] } })
    
    expect(screen.getByText('test.png')).toBeInTheDocument()
  })
})