"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, Upload, FileText } from "lucide-react"
import { stockMovementAPI, inventoryAPI, supplierAPI, customerAPI, ocrAPI } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { OCRUpload } from "@/components/ocr-upload"
import {
  parseQuantity,
  formatQuantity,
  validateMovementType,
  generateIdempotencyKey,
  parseAPIError,
  type ValidationError
} from "@/lib/inventory-utils"

interface MovementModalProps {
  isOpen: boolean
  onClose: () => void
  mode: "IN" | "OUT" | "RETURN"
  onSuccess: () => void
}

export function MovementModal({ isOpen, onClose, mode, onSuccess }: MovementModalProps) {
  const { t } = useTranslation()

  // Data state
  const [items, setItems] = useState<InventoryItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // Form state
  const [formData, setFormData] = useState({
    item: "",
    unit: "verpackung",
    quantity: "",
    purchase_price: "",
    supplier: "",
    customer: "",
    note: "",
    movement_date: "",
    movement_time: ""
  })

  const [useCurrentDateTime, setUseCurrentDateTime] = useState(true)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState<string>("")
  const [idempotencyKey, setIdempotencyKey] = useState<string>("")
  
  // OCR state
  const [showOCRUpload, setShowOCRUpload] = useState(false)
  const [isProcessingOCR, setIsProcessingOCR] = useState(false)

  // ========================================================================
  // LOAD DATA ON MODAL OPEN
  // ========================================================================
  useEffect(() => {
    let isMounted = true

    if (isOpen) {
      // Generate new idempotency key for this operation
      setIdempotencyKey(generateIdempotencyKey())
      setIsLoadingData(true)

      const loadData = async () => {
        try {
          const [itemsData, suppliersData, customersData] = await Promise.all([
            inventoryAPI.getItems(),
            supplierAPI.getSuppliers(),
            customerAPI.getCustomers()
          ])

          if (!isMounted) return

          const itemsArray = Array.isArray(itemsData) ? itemsData : itemsData.results || []
          const suppliersArray = Array.isArray(suppliersData) ? suppliersData : suppliersData.results || []
          const customersArray = Array.isArray(customersData) ? customersData : customersData.results || []

          setItems(itemsArray)
          setSuppliers(suppliersArray)
          setCustomers(customersArray)
        } catch (err) {
          if (!isMounted) return
          console.error("Failed to load form data:", err)
          setGlobalError("Fehler beim Laden der Formulardaten")
        } finally {
          if (isMounted) {
            setIsLoadingData(false)
          }
        }
      }

      loadData()
    } else {
      // Reset on close
      resetForm()
      setIdempotencyKey("")
    }

    return () => {
      isMounted = false
    }
  }, [isOpen])

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================
  const selectedItem = useMemo(() => {
    return items.find(item => item.id === parseInt(formData.item))
  }, [items, formData.item])

  const inputQuantity = useMemo(() => {
    return parseQuantity(formData.quantity)
  }, [formData.quantity])

  const availableQty = useMemo(() => {
    if (formData.unit === 'palette') {
      return selectedItem?.palette_quantity || 0
    } else {
      return selectedItem?.total_quantity_in_verpackungen || 0
    }
  }, [selectedItem, formData.unit])

  const previewNewQty = useMemo(() => {
    if (mode === "IN" || mode === "RETURN") {
      return availableQty + inputQuantity
    } else {
      return Math.max(0, availableQty - inputQuantity)
    }
  }, [mode, availableQty, inputQuantity])

  // ========================================================================
  // VALIDATION
  // ========================================================================
  const validationErrors = useMemo((): ValidationError[] => {
    const errors: ValidationError[] = []

    // Item required
    if (!formData.item) {
      errors.push({ field: 'item', message: 'Artikel ist erforderlich' })
    }

    // Quantity validation
    const qty = parseQuantity(formData.quantity)
    if (qty <= 0) {
      errors.push({ field: 'quantity', message: 'Menge muss größer als 0 sein' })
    }

    // Movement type specific validation
    if (selectedItem && inputQuantity > 0) {
      const movementError = validateMovementType(mode, inputQuantity, availableQty)
      if (movementError) {
        errors.push(movementError)
      }
    }

    // Supplier required for IN
    if (mode === "IN" && !formData.supplier && !formData.note) {
      errors.push({ field: 'supplier', message: 'Lieferant oder Notiz erforderlich für Wareneingang' })
    }

    // Customer required for RETURN
    if (mode === "RETURN" && !formData.customer) {
      errors.push({ field: 'customer', message: 'Kunde erforderlich für Retoure' })
    }

    return errors
  }, [formData, selectedItem, mode, inputQuantity, availableQty])

  const isFormValid = validationErrors.length === 0 && formData.item !== ""

  // ========================================================================
  // OCR HANDLERS
  // ========================================================================
  const handleOCRDataExtracted = async (ocrData: any) => {
    try {
      setIsProcessingOCR(true)
      
      // Update form with OCR data
      const updates: Partial<typeof formData> = {}
      
      if (ocrData.quantity) {
        updates.quantity = String(ocrData.quantity)
      }
      
      if (ocrData.unit_price) {
        updates.purchase_price = String(ocrData.unit_price)
      }
      
      if (ocrData.supplier) {
        // Try to find matching supplier
        const suggestions = await ocrAPI.suggestMatches({ supplier: ocrData.supplier })
        if (suggestions.suggestions.suppliers.length > 0) {
          updates.supplier = String(suggestions.suggestions.suppliers[0].id)
        } else {
          // Add supplier name to note if no match found
          updates.note = `Lieferant: ${ocrData.supplier}${ocrData.note ? `\n${ocrData.note}` : ''}`
        }
      }
      
      if (ocrData.article_name) {
        // Try to find matching item
        const suggestions = await ocrAPI.suggestMatches({ article_name: ocrData.article_name })
        if (suggestions.suggestions.items.length > 0) {
          updates.item = String(suggestions.suggestions.items[0].id)
        } else {
          // Add article name to note if no match found
          updates.note = `Artikel: ${ocrData.article_name}${ocrData.note ? `\n${ocrData.note}` : ''}`
        }
      }
      
      // Apply updates
      setFormData(prev => ({ ...prev, ...updates }))
      
      // Close OCR upload
      setShowOCRUpload(false)
      
    } catch (err) {
      console.error('OCR data processing failed:', err)
      setGlobalError('Fehler beim Verarbeiten der OCR-Daten')
    } finally {
      setIsProcessingOCR(false)
    }
  }

  // ========================================================================
  // FORM HANDLERS
  // ========================================================================
  const resetForm = () => {
    setFormData({
      item: "",
      unit: "verpackung",
      quantity: "",
      purchase_price: "",
      supplier: "",
      customer: "",
      note: "",
      movement_date: "",
      movement_time: ""
    })
    setUseCurrentDateTime(true)
    setFieldErrors({})
    setGlobalError("")
  }

  const handleClose = (open: boolean) => {
    if (!open && !isSubmitting) {
      onClose()
    }
  }

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }

    // Clear global error on any input
    if (globalError) {
      setGlobalError("")
    }
  }


  // ========================================================================
  // SUBMIT HANDLER
  // ========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Early validation check
    if (!isFormValid) {
      // Convert validation errors to field errors
      const errors: Record<string, string> = {}
      validationErrors.forEach(err => {
        errors[err.field] = err.message
      })
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    setGlobalError("")

    try {
      // Prepare payload
      const payload: any = {
        item: parseInt(formData.item),
        type: mode,
        unit: formData.unit,
        quantity: parseInt(formData.quantity),
        note: formData.note,
        supplier: formData.supplier ? parseInt(formData.supplier) : null,
        customer: formData.customer ? parseInt(formData.customer) : null,
        idempotency_key: idempotencyKey
      }

      // Add purchase_price for IN movements
      if (mode === "IN" && formData.purchase_price) {
        payload.purchase_price = parseFloat(formData.purchase_price)
      }

      // Add custom timestamp if not using current date/time
      if (!useCurrentDateTime && formData.movement_date && formData.movement_time) {
        payload.movement_timestamp = `${formData.movement_date}T${formData.movement_time}:00`
      }

      // Submit movement
      await stockMovementAPI.createMovement(payload)

      // Success: Close modal and trigger refetch
      resetForm()
      onClose()

      // Defer onSuccess to next tick to ensure modal is fully closed
      setTimeout(() => {
        onSuccess()
      }, 0)

    } catch (err: any) {
      console.error("Movement submission error:", err)

      // Parse error response
      let errorMessage = parseAPIError(err)

      // Handle specific error codes
      if (err?.error?.code === 'INSUFFICIENT_STOCK') {
        setFieldErrors({ qty_base: errorMessage })
      } else if (err?.error?.code === 'PPU_CONVERSION_ERROR') {
        setGlobalError(errorMessage)
      } else if (err?.error?.code === 'VALIDATION_ERROR' && err?.error?.fields) {
        // Map backend field errors
        const backendErrors: Record<string, string> = {}
        Object.entries(err.error.fields).forEach(([field, messages]) => {
          backendErrors[field] = Array.isArray(messages) ? messages[0] : String(messages)
        })
        setFieldErrors(backendErrors)
      } else {
        // Generic error
        setGlobalError(errorMessage)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ========================================================================
  // RENDER ERROR MESSAGE
  // ========================================================================
  const renderFieldError = (field: string) => {
    const error = fieldErrors[field] || validationErrors.find(e => e.field === field)?.message
    if (!error) return null

    return (
      <p className="text-sm text-red-500 mt-1" role="alert">
        {error}
      </p>
    )
  }

  // ========================================================================
  // RENDER MODAL
  // ========================================================================
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        aria-describedby="movement-modal-description"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>
                {mode === "IN" && t('movement.stockIn')}
                {mode === "OUT" && t('movement.stockOut')}
                {mode === "RETURN" && t('movement.return')}
              </DialogTitle>
              <p id="movement-modal-description" className="text-sm text-muted-foreground">
                {mode === "IN" && "Waren einbuchen und Lagerbestand erhöhen"}
                {mode === "OUT" && "Waren ausbuchen und Lagerbestand verringern"}
                {mode === "RETURN" && "Retoure von Kunde zurückbuchen"}
              </p>
            </div>
            {mode === "IN" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowOCRUpload(true)}
                disabled={isSubmitting || isProcessingOCR}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Lieferschein scannen
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Global Error Alert */}
        {globalError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : showOCRUpload ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowOCRUpload(false)}
                disabled={isProcessingOCR}
              >
                ← Zurück zur manuellen Eingabe
              </Button>
            </div>
            <OCRUpload
              onDataExtracted={handleOCRDataExtracted}
              onClose={() => setShowOCRUpload(false)}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Item Selection */}
            <div className="space-y-2">
              <Label htmlFor="item" className="required">
                {t('movement.item')}
              </Label>
              <Select
                value={formData.item}
                onValueChange={(value) => handleFieldChange('item', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id="item"
                  className={fieldErrors.item ? "border-red-500" : ""}
                  aria-invalid={!!fieldErrors.item}
                  aria-describedby={fieldErrors.item ? "item-error" : undefined}
                >
                  <SelectValue placeholder={t('movement.selectItem')} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name} (Lager: {item.palette_quantity || 0} Paletten, {item.verpackung_quantity || 0} Verpackungen)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {renderFieldError('item')}
            </div>

            {/* Unit Selection */}
            <div className="space-y-2">
              <Label htmlFor="unit" className="required">
                Einheit
              </Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => handleFieldChange('unit', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="palette">Palette</SelectItem>
                  <SelectItem value="verpackung">Verpackung</SelectItem>
                </SelectContent>
              </Select>
              {renderFieldError('unit')}
            </div>

            {/* Quantity Input */}
            <div className="space-y-2">
              <Label htmlFor="quantity" className="required">
                {t('movement.quantity')}
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => handleFieldChange('quantity', e.target.value)}
                disabled={isSubmitting}
                className={fieldErrors.quantity ? "border-red-500" : ""}
                aria-invalid={!!fieldErrors.quantity}
                aria-describedby={fieldErrors.quantity ? "quantity-error" : undefined}
                placeholder="z.B. 10"
              />
              {renderFieldError('quantity')}
            </div>

            {/* Stock Preview */}
            {selectedItem && inputQuantity > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Bestandsvorschau
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Aktuell</p>
                    <p className="font-medium">{formatQuantity(availableQty)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {mode === "OUT" ? "Abgang" : "Zugang"}
                    </p>
                    <p className="font-medium text-blue-600 dark:text-blue-400">
                      {mode === "OUT" ? "-" : "+"}{formatQuantity(inputQuantity)} {formData.unit === 'palette' ? 'P' : 'V'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Neu</p>
                    <p className="font-medium">{formatQuantity(previewNewQty)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Supplier (for IN) */}
            {mode === "IN" && (
              <div className="space-y-2">
                <Label htmlFor="supplier">{t('movement.supplier')}</Label>
                <Select
                  value={formData.supplier}
                  onValueChange={(value) => handleFieldChange('supplier', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="supplier"
                    className={fieldErrors.supplier ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder={t('movement.selectSupplier')} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderFieldError('supplier')}
              </div>
            )}

            {/* Purchase Price (for IN) */}
            {mode === "IN" && (
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Einkaufspreis (CHF)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchase_price}
                  onChange={(e) => handleFieldChange('purchase_price', e.target.value)}
                  disabled={isSubmitting}
                  placeholder="0.00"
                  className={fieldErrors.purchase_price ? "border-red-500" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Einkaufspreis für diese Warenbewegung. Wird automatisch als Ausgabe erfasst.
                </p>
                {renderFieldError('purchase_price')}
              </div>
            )}

            {/* Customer (for RETURN) */}
            {mode === "RETURN" && (
              <div className="space-y-2">
                <Label htmlFor="customer" className="required">
                  {t('movement.customer')}
                </Label>
                <Select
                  value={formData.customer}
                  onValueChange={(value) => handleFieldChange('customer', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="customer"
                    className={fieldErrors.customer ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder={t('movement.selectCustomer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={String(customer.id)}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderFieldError('customer')}
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">{t('movement.note')}</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => handleFieldChange('note', e.target.value)}
                disabled={isSubmitting}
                placeholder={t('movement.notePlaceholder')}
                rows={3}
              />
            </div>

            {/* Date/Time Section */}
            <div className="space-y-4 p-4 bg-muted rounded-md">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useCurrentDateTime"
                  checked={useCurrentDateTime}
                  onChange={(e) => setUseCurrentDateTime(e.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="useCurrentDateTime" className="cursor-pointer">
                  Aktuelles Datum & Uhrzeit automatisch verwenden
                </Label>
              </div>

              {!useCurrentDateTime && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="movement_date">Datum</Label>
                    <Input
                      id="movement_date"
                      type="date"
                      value={formData.movement_date}
                      onChange={(e) => handleFieldChange('movement_date', e.target.value)}
                      disabled={isSubmitting}
                      className={fieldErrors.movement_date ? "border-red-500" : ""}
                    />
                    {renderFieldError('movement_date')}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="movement_time">Uhrzeit</Label>
                    <Input
                      id="movement_time"
                      type="time"
                      value={formData.movement_time}
                      onChange={(e) => handleFieldChange('movement_time', e.target.value)}
                      disabled={isSubmitting}
                      className={fieldErrors.movement_time ? "border-red-500" : ""}
                    />
                    {renderFieldError('movement_time')}
                  </div>
                </div>
              )}
            </div>

            {/* Dialog Footer */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.submitting')}
                  </>
                ) : (
                  t('common.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
