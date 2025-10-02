"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { stockMovementAPI, inventoryAPI, supplierAPI, customerAPI } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import {
  calculateQtyBase,
  validatePPUInput,
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
    qty_base: "",
    qty_pallets: "",
    qty_packages: "",
    qty_singles: "",
    supplier: "",
    customer: "",
    note: ""
  })

  // UI state
  const [quantityInputMode, setQuantityInputMode] = useState<"total" | "uom">("total")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState<string>("")
  const [idempotencyKey, setIdempotencyKey] = useState<string>("")

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

  const calculatedQtyBase = useMemo(() => {
    if (quantityInputMode === "total") {
      return parseQuantity(formData.qty_base)
    }

    if (!selectedItem) return 0

    try {
      return calculateQtyBase(
        {
          qty_pallets: parseQuantity(formData.qty_pallets),
          qty_packages: parseQuantity(formData.qty_packages),
          qty_singles: parseQuantity(formData.qty_singles)
        },
        {
          unit_pallet_factor: selectedItem.unit_pallet_factor || 1,
          unit_package_factor: selectedItem.unit_package_factor || 1
        }
      )
    } catch (err) {
      return 0
    }
  }, [quantityInputMode, formData, selectedItem])

  const availableQty = useMemo(() => {
    return selectedItem?.available_qty || 0
  }, [selectedItem])

  const previewNewQty = useMemo(() => {
    if (mode === "IN" || mode === "RETURN") {
      return availableQty + calculatedQtyBase
    } else {
      return Math.max(0, availableQty - calculatedQtyBase)
    }
  }, [mode, availableQty, calculatedQtyBase])

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
    if (quantityInputMode === "total") {
      const qty = parseQuantity(formData.qty_base)
      if (qty <= 0) {
        errors.push({ field: 'qty_base', message: 'Menge muss größer als 0 sein' })
      }
    } else {
      // Validate PPU inputs
      if (selectedItem) {
        const ppuErrors = validatePPUInput(
          {
            qty_pallets: parseQuantity(formData.qty_pallets),
            qty_packages: parseQuantity(formData.qty_packages),
            qty_singles: parseQuantity(formData.qty_singles)
          },
          {
            unit_pallet_factor: selectedItem.unit_pallet_factor || 1,
            unit_package_factor: selectedItem.unit_package_factor || 1
          }
        )
        errors.push(...ppuErrors)
      }
    }

    // Movement type specific validation
    if (selectedItem && calculatedQtyBase > 0) {
      const movementError = validateMovementType(mode, calculatedQtyBase, availableQty)
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
  }, [formData, quantityInputMode, selectedItem, mode, calculatedQtyBase, availableQty])

  const isFormValid = validationErrors.length === 0 && formData.item !== ""

  // ========================================================================
  // FORM HANDLERS
  // ========================================================================
  const resetForm = () => {
    setFormData({
      item: "",
      qty_base: "",
      qty_pallets: "",
      qty_packages: "",
      qty_singles: "",
      supplier: "",
      customer: "",
      note: ""
    })
    setQuantityInputMode("total")
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

  const handleQuantityModeChange = (newMode: "total" | "uom") => {
    setQuantityInputMode(newMode)
    // Reset quantity fields
    setFormData(prev => ({
      ...prev,
      qty_base: "",
      qty_pallets: "",
      qty_packages: "",
      qty_singles: ""
    }))
    setFieldErrors({})
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
      const payload = {
        item: parseInt(formData.item),
        type: mode,
        qty_base: calculatedQtyBase,
        qty_pallets: quantityInputMode === "uom" ? parseQuantity(formData.qty_pallets) : 0,
        qty_packages: quantityInputMode === "uom" ? parseQuantity(formData.qty_packages) : 0,
        qty_singles: quantityInputMode === "uom" ? parseQuantity(formData.qty_singles) : 0,
        note: formData.note,
        supplier: formData.supplier ? parseInt(formData.supplier) : null,
        customer: formData.customer ? parseInt(formData.customer) : null,
        idempotency_key: idempotencyKey
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
                      {item.name} ({formatQuantity(item.available_qty || 0)} verfügbar)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {renderFieldError('item')}
            </div>

            {/* Quantity Input Mode Tabs */}
            <Tabs value={quantityInputMode} onValueChange={(v) => handleQuantityModeChange(v as "total" | "uom")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="total" disabled={isSubmitting}>
                  {t('movement.totalQuantity')}
                </TabsTrigger>
                <TabsTrigger value="uom" disabled={isSubmitting}>
                  {t('movement.byUnit')}
                </TabsTrigger>
              </TabsList>

              {/* Total Quantity Mode */}
              <TabsContent value="total" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qty_base" className="required">
                    {t('movement.quantity')} (Basiseinheiten)
                  </Label>
                  <Input
                    id="qty_base"
                    type="number"
                    min="1"
                    value={formData.qty_base}
                    onChange={(e) => handleFieldChange('qty_base', e.target.value)}
                    disabled={isSubmitting}
                    className={fieldErrors.qty_base ? "border-red-500" : ""}
                    aria-invalid={!!fieldErrors.qty_base}
                    aria-describedby={fieldErrors.qty_base ? "qty_base-error" : undefined}
                    placeholder="z.B. 100"
                  />
                  {renderFieldError('qty_base')}
                </div>
              </TabsContent>

              {/* UoM Mode */}
              <TabsContent value="uom" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="qty_pallets">{t('movement.pallets')}</Label>
                    <Input
                      id="qty_pallets"
                      type="number"
                      min="0"
                      value={formData.qty_pallets}
                      onChange={(e) => handleFieldChange('qty_pallets', e.target.value)}
                      disabled={isSubmitting}
                      className={fieldErrors.qty_pallets ? "border-red-500" : ""}
                      placeholder="0"
                    />
                    {renderFieldError('qty_pallets')}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qty_packages">{t('movement.packages')}</Label>
                    <Input
                      id="qty_packages"
                      type="number"
                      min="0"
                      value={formData.qty_packages}
                      onChange={(e) => handleFieldChange('qty_packages', e.target.value)}
                      disabled={isSubmitting}
                      className={fieldErrors.qty_packages ? "border-red-500" : ""}
                      placeholder="0"
                    />
                    {renderFieldError('qty_packages')}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qty_singles">{t('movement.singles')}</Label>
                    <Input
                      id="qty_singles"
                      type="number"
                      min="0"
                      value={formData.qty_singles}
                      onChange={(e) => handleFieldChange('qty_singles', e.target.value)}
                      disabled={isSubmitting}
                      className={fieldErrors.qty_singles ? "border-red-500" : ""}
                      placeholder="0"
                    />
                    {renderFieldError('qty_singles')}
                  </div>
                </div>

                {/* PPU Preview */}
                {selectedItem && calculatedQtyBase > 0 && (
                  <div className="p-3 bg-muted rounded-md text-sm">
                    <p className="font-medium">
                      Gesamtmenge: <span className="text-primary">{formatQuantity(calculatedQtyBase)}</span> Basiseinheiten
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {formData.qty_pallets && `${formData.qty_pallets}×${selectedItem.unit_pallet_factor}×${selectedItem.unit_package_factor}`}
                      {formData.qty_packages && ` + ${formData.qty_packages}×${selectedItem.unit_package_factor}`}
                      {formData.qty_singles && ` + ${formData.qty_singles}`}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Stock Preview */}
            {selectedItem && calculatedQtyBase > 0 && (
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
                      {mode === "OUT" ? "-" : "+"}{formatQuantity(calculatedQtyBase)}
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
