"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, FileText, Image, X, CheckCircle2, AlertCircle } from "lucide-react"
import { ocrAPI } from "@/lib/api"
import { toast } from "react-hot-toast"

interface OCRUploadProps {
  onDataExtracted: (data: {
    supplier: string
    article_name: string
    quantity: number
    unit_price: number
    total_price: number
    currency: string
    confidence: number
    raw_text: string
  }) => void
  onClose: () => void
}

export function OCRUpload({ onDataExtracted, onClose }: OCRUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      setError(null)
      setExtractedData(null)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) {
      setUploadedFile(file)
      setError(null)
      setExtractedData(null)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const processFile = async () => {
    if (!uploadedFile) return

    setIsProcessing(true)
    setError(null)

    try {
      const result = await ocrAPI.processReceipt(uploadedFile)
      
      if (result.success && result.data.processing_success) {
        setExtractedData(result.data)
        toast.success("Lieferschein erfolgreich verarbeitet!")
      } else {
        setError("Keine Daten aus dem Dokument extrahiert. Bitte versuchen Sie es mit einem anderen Bild.")
      }
    } catch (err: any) {
      setError(err.message || "Fehler bei der Verarbeitung des Dokuments")
      toast.error("OCR-Verarbeitung fehlgeschlagen")
    } finally {
      setIsProcessing(false)
    }
  }

  const applyData = () => {
    if (extractedData) {
      onDataExtracted(extractedData)
      onClose()
    }
  }

  const resetUpload = () => {
    setUploadedFile(null)
    setExtractedData(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />
    }
    return <Image className="h-8 w-8 text-blue-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Lieferschein scannen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              uploadedFile
                ? "border-green-500 bg-green-50 dark:bg-green-950"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {uploadedFile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  {getFileIcon(uploadedFile)}
                  <div className="text-left">
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(uploadedFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetUpload}
                  className="mt-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Entfernen
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-gray-400" />
                <div>
                  <p className="text-lg font-medium">Datei hier ablegen</p>
                  <p className="text-sm text-gray-500">
                    oder klicken Sie zum Auswählen
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Datei auswählen
                </Button>
              </div>
            )}
          </div>

          {/* Process Button */}
          {uploadedFile && !extractedData && (
            <Button
              onClick={processFile}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verarbeitung läuft...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Dokument verarbeiten
                </>
              )}
            </Button>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Extracted Data Display */}
          {extractedData && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Daten erfolgreich extrahiert (Vertrauen: {Math.round(extractedData.confidence * 100)}%)
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-500">Lieferant</label>
                  <p className="text-sm">{extractedData.supplier || "Nicht erkannt"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Artikel</label>
                  <p className="text-sm">{extractedData.article_name || "Nicht erkannt"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Menge</label>
                  <p className="text-sm">{extractedData.quantity || "Nicht erkannt"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Preis</label>
                  <p className="text-sm">
                    {extractedData.unit_price ? `${extractedData.unit_price} ${extractedData.currency}` : "Nicht erkannt"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={applyData}
                  className="flex-1"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Daten übernehmen
                </Button>
                <Button
                  variant="outline"
                  onClick={resetUpload}
                >
                  <X className="mr-2 h-4 w-4" />
                  Neu scannen
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}