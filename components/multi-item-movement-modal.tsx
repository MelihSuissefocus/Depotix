"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Plus, Trash2, PackageOpen, Package, Upload } from "lucide-react"
import { stockMovementAPI, inventoryAPI, supplierAPI, ocrAPI } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { toast } from "react-hot-toast"
import { OCRUpload } from "@/components/ocr-upload"

interface MovementItem {
  id: string
  item: string
  unit_type: 'palette' | 'verpackung'  // Einheit: Palette ODER Verpackung
  quantity: string  // Anzahl der gewählten Einheit
  purchase_price: string
  price_type: 'palette' | 'verpackung' | 'none'  // Welcher Preis wird angegeben
  currency: 'CHF' | 'EUR'  // Währung des Preises
  error?: string
}

interface MultiItemMovementModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function MultiItemMovementModal({ isOpen, onClose, onSuccess }: MultiItemMovementModalProps) {
  const { t } = useTranslation()

  // Data state
  const [items, setItems] = useState<InventoryItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Form state
  const [movementItems, setMovementItems] = useState<MovementItem[]>([
    { id: '1', item: '', unit_type: 'palette', quantity: '', purchase_price: '', price_type: 'none', currency: 'CHF' }
  ])
  const [supplier, setSupplier] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [movementDate, setMovementDate] = useState<string>("")
  const [movementTime, setMovementTime] = useState<string>("")
  const [useCurrentDateTime, setUseCurrentDateTime] = useState(true)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [globalError, setGlobalError] = useState<string>("")
  const [showOCRUpload, setShowOCRUpload] = useState(false)
  const [isProcessingOCR, setIsProcessingOCR] = useState(false)

  // Load data on modal open
  useEffect(() => {
    let isMounted = true

    if (isOpen) {
      setIsLoadingData(true)

      const loadData = async () => {
        try {
          const [itemsData, suppliersData] = await Promise.all([
            inventoryAPI.getItems(),
            supplierAPI.getSuppliers()
          ])

          if (!isMounted) return

          const itemsArray = Array.isArray(itemsData) ? itemsData : itemsData.results || []
          const suppliersArray = Array.isArray(suppliersData) ? suppliersData : suppliersData.results || []

          setItems(itemsArray)
          setSuppliers(suppliersArray)
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
    }

    return () => {
      isMounted = false
    }
  }, [isOpen])

  const resetForm = () => {
    setMovementItems([{ id: '1', item: '', unit_type: 'palette', quantity: '', purchase_price: '', price_type: 'none', currency: 'CHF' }])
    setSupplier("")
    setNote("")
    setMovementDate("")
    setMovementTime("")
    setUseCurrentDateTime(true)
    setGlobalError("")
    setShowOCRUpload(false)
  }

  const handleOCRDataExtracted = async (ocrData: any) => {
    try {
      setIsProcessingOCR(true)
      setGlobalError("")

      // Find matching supplier
      if (ocrData.supplier) {
        const matchingSupplier = suppliers.find(s => 
          s.name.toLowerCase().includes(ocrData.supplier.toLowerCase()) ||
          ocrData.supplier.toLowerCase().includes(s.name.toLowerCase())
        )
        if (matchingSupplier) {
          setSupplier(String(matchingSupplier.id))
        }
      }

      // Find matching item
      if (ocrData.article_name) {
        const matchingItem = items.find(i => 
          i.name.toLowerCase().includes(ocrData.article_name.toLowerCase()) ||
          ocrData.article_name.toLowerCase().includes(i.name.toLowerCase())
        )
        if (matchingItem) {
          const firstItem = movementItems[0]
          const updatedItem = {
            ...firstItem,
            item: String(matchingItem.id),
            quantity: ocrData.quantity ? String(ocrData.quantity) : firstItem.quantity,
            purchase_price: ocrData.unit_price ? String(ocrData.unit_price) : firstItem.purchase_price,
            currency: ocrData.currency === 'EUR' ? 'EUR' : 'CHF',
            price_type: ocrData.unit_price ? 'verpackung' as const : 'none' as const
          }
          setMovementItems([updatedItem])
        }
      }

      // Set note with OCR info
      setNote(`OCR Import (${Math.round(ocrData.confidence * 100)}% Genauigkeit)${ocrData.raw_text ? '\n\nRohtext:\n' + ocrData.raw_text.substring(0, 200) : ''}`)

      toast.success("OCR-Daten erfolgreich importiert")
      setShowOCRUpload(false)
      
    } catch (err) {
      console.error('OCR data processing failed:', err)
      setGlobalError('Fehler beim Verarbeiten der OCR-Daten')
    } finally {
      setIsProcessingOCR(false)
    }
  }

  const addItem = () => {
    const newId = (Math.max(...movementItems.map(item => parseInt(item.id) || 0)) + 1).toString()
    setMovementItems([...movementItems, { id: newId, item: '', unit_type: 'palette', quantity: '', purchase_price: '', price_type: 'none', currency: 'CHF' }])
  }

  const removeItem = (id: string) => {
    if (movementItems.length === 1) {
      toast.error("Mindestens ein Artikel erforderlich")
      return
    }
    setMovementItems(movementItems.filter(item => item.id !== id))
  }

  const updateItem = (id: string, field: keyof MovementItem, value: string) => {
    setMovementItems(movementItems.map(item =>
      item.id === id ? { ...item, [field]: value, error: undefined } : item
    ))
  }

  const getItemDetails = (itemId: string): InventoryItem | undefined => {
    return items.find(item => item.id === parseInt(itemId))
  }

  const validateForm = (): boolean => {
    let isValid = true
    const updatedItems = movementItems.map(movItem => {
      const itemDetails = getItemDetails(movItem.item)

      // Check if item is selected
      if (!movItem.item) {
        isValid = false
        return { ...movItem, error: 'Artikel erforderlich' }
      }

      // Check if quantity is provided
      const quantity = parseInt(movItem.quantity) || 0

      if (quantity === 0) {
        isValid = false
        return { ...movItem, error: 'Anzahl muss größer als 0 sein' }
      }

      // Validate purchase price if provided
      if (movItem.purchase_price && parseFloat(movItem.purchase_price) < 0) {
        isValid = false
        return { ...movItem, error: 'Einkaufspreis darf nicht negativ sein' }
      }

      return { ...movItem, error: undefined }
    })

    setMovementItems(updatedItems)
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      setGlobalError("Bitte alle Felder korrekt ausfüllen")
      return
    }

    setIsSubmitting(true)
    setGlobalError("")

    try {
      // Process each item sequentially
      for (const movItem of movementItems) {
        const itemDetails = getItemDetails(movItem.item)
        if (!itemDetails) continue

        const quantity = parseInt(movItem.quantity) || 0
        const unitType = movItem.unit_type
        const purchasePrice = movItem.purchase_price ? parseFloat(movItem.purchase_price) : null
        const priceType = movItem.price_type || 'none'

        // Calculate total purchase price with proper conversion
        let totalPurchasePrice = null
        if (priceType !== 'none' && purchasePrice && purchasePrice > 0) {
          let effectiveQty = quantity

          // Convert quantity if unit_type and price_type don't match
          if (unitType === 'palette' && priceType === 'verpackung') {
            // Einbuchen als Paletten, aber Preis pro Verpackung
            effectiveQty = quantity * (itemDetails.verpackungen_pro_palette || 1)
          } else if (unitType === 'verpackung' && priceType === 'palette') {
            // Einbuchen als Verpackungen, aber Preis pro Palette
            effectiveQty = quantity / (itemDetails.verpackungen_pro_palette || 1)
          }

          totalPurchasePrice = purchasePrice * effectiveQty
        }

        // Create movement
        const payload: any = {
          item: parseInt(movItem.item),
          type: 'IN',
          unit: unitType,
          quantity: quantity,
          note: note || `Wareneingang: ${itemDetails.name}`,
          supplier: supplier ? parseInt(supplier) : null,
          idempotency_key: `${Date.now()}-${movItem.id}-${unitType}`,
          currency: movItem.currency || 'CHF'
        }

        // Add total purchase price if calculated
        if (totalPurchasePrice !== null) {
          payload.purchase_price = totalPurchasePrice
        }

        if (!useCurrentDateTime && movementDate && movementTime) {
          payload.movement_timestamp = `${movementDate}T${movementTime}:00`
        }

        await stockMovementAPI.createMovement(payload)
      }

      toast.success(`${movementItems.length} Artikel erfolgreich verbucht`)
      resetForm()
      onClose()
      setTimeout(() => {
        onSuccess()
      }, 0)

    } catch (err: any) {
      console.error("Movement submission error:", err)
      setGlobalError(err?.message || "Fehler beim Verbuchen der Wareneingänge")
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateTotalPrice = (): number => {
    return movementItems.reduce((sum, movItem) => {
      const price = parseFloat(movItem.purchase_price) || 0
      if (price === 0 || movItem.price_type === 'none') return sum

      const quantity = parseInt(movItem.quantity) || 0
      if (quantity === 0) return sum

      const itemDetails = getItemDetails(movItem.item)
      if (!itemDetails) return sum

      // Calculate effective quantity with conversion
      let effectiveQty = quantity

      // Convert quantity if unit_type and price_type don't match
      if (movItem.unit_type === 'palette' && movItem.price_type === 'verpackung') {
        effectiveQty = quantity * (itemDetails.verpackungen_pro_palette || 1)
      } else if (movItem.unit_type === 'verpackung' && movItem.price_type === 'palette') {
        effectiveQty = quantity / (itemDetails.verpackungen_pro_palette || 1)
      }

      return sum + (price * effectiveQty)
    }, 0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto"
        aria-describedby="multi-movement-modal-description"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Wareneingang (Mehrere Artikel)</DialogTitle>
              <p id="multi-movement-modal-description" className="text-sm text-muted-foreground">
                Mehrere Artikel gleichzeitig einbuchen. Pro Artikel können Paletten UND Verpackungen angegeben werden.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowOCRUpload(true)}
              disabled={isSubmitting || isProcessingOCR || showOCRUpload}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Lieferschein scannen
            </Button>
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
            {/* Items List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Artikel</Label>
                <Button type="button" onClick={addItem} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Artikel hinzufügen
                </Button>
              </div>

              {movementItems.map((movItem, index) => {
                const itemDetails = getItemDetails(movItem.item)

                return (
                  <div key={movItem.id} className="p-4 border rounded-lg space-y-3 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Artikel {index + 1}</span>
                      {movementItems.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => removeItem(movItem.id)}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Item Selection */}
                    <div className="space-y-2">
                      <Label htmlFor={`item-${movItem.id}`}>Artikel *</Label>
                      <Select
                        value={movItem.item}
                        onValueChange={(value) => updateItem(movItem.id, 'item', value)}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger id={`item-${movItem.id}`}>
                          <SelectValue placeholder="Artikel auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={String(item.id)}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Current Stock Info */}
                    {itemDetails && (
                      <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded">
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-4">
                            <span>Aktuell: {itemDetails.palette_quantity || 0} Paletten</span>
                            <span>•</span>
                            <span>{itemDetails.verpackung_quantity || 0} Verpackungen</span>
                          </div>
                          {itemDetails.verpackungen_pro_palette && (
                            <div className="flex gap-4">
                              <span>Umrechnung: {itemDetails.verpackungen_pro_palette} Verpackungen/Palette</span>
                              {itemDetails.stueck_pro_verpackung && (
                                <>
                                  <span>•</span>
                                  <span>{itemDetails.stueck_pro_verpackung} Stück/Verpackung</span>
                                </>
                              )}
                            </div>
                          )}
                          {(itemDetails.price_per_palette || itemDetails.price_per_verpackung) && (
                            <div className="flex gap-4 font-medium text-green-700 dark:text-green-400">
                              {itemDetails.price_per_palette && (
                                <span>EK/Palette: CHF {parseFloat(itemDetails.price_per_palette).toFixed(2)}</span>
                              )}
                              {itemDetails.price_per_verpackung && (
                                <>
                                  {itemDetails.price_per_palette && <span>•</span>}
                                  <span>EK/Verpackung: CHF {parseFloat(itemDetails.price_per_verpackung).toFixed(2)}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Unit Type Selection */}
                    <div className="space-y-2">
                      <Label>Einheit wählen</Label>
                      <Select
                        value={movItem.unit_type}
                        onValueChange={(value: 'palette' | 'verpackung') => updateItem(movItem.id, 'unit_type', value)}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="palette">Paletten</SelectItem>
                          <SelectItem value="verpackung">Verpackungen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantity Input */}
                    <div className="space-y-2">
                      <Label htmlFor={`quantity-${movItem.id}`} className="flex items-center gap-2">
                        {movItem.unit_type === 'palette' ? (
                          <><PackageOpen className="h-4 w-4" /> Anzahl Paletten</>
                        ) : (
                          <><Package className="h-4 w-4" /> Anzahl Verpackungen</>
                        )}
                      </Label>
                      <Input
                        id={`quantity-${movItem.id}`}
                        type="number"
                        min="1"
                        value={movItem.quantity}
                        onChange={(e) => updateItem(movItem.id, 'quantity', e.target.value)}
                        disabled={isSubmitting}
                        placeholder="0"
                      />
                    </div>

                    {/* Total Quantity Calculation */}
                    {itemDetails && parseInt(movItem.quantity) > 0 && (
                      <div className="text-sm bg-amber-50 dark:bg-amber-950 p-3 rounded border border-amber-200 dark:border-amber-800">
                        <div className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                          Einbuchung gesamt:
                        </div>
                        <div className="flex flex-col gap-1 text-amber-800 dark:text-amber-200">
                          {movItem.unit_type === 'palette' ? (
                            <>
                              <span>
                                {movItem.quantity} Palette(n) = {parseInt(movItem.quantity) * (itemDetails.verpackungen_pro_palette || 1)} Verpackungen
                              </span>
                              {itemDetails.stueck_pro_verpackung && (
                                <div className="font-bold mt-1 pt-1 border-t border-amber-300 dark:border-amber-700">
                                  Gesamt: {parseInt(movItem.quantity) * (itemDetails.verpackungen_pro_palette || 1) * itemDetails.stueck_pro_verpackung} Stück
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <span>{movItem.quantity} Verpackung(en)</span>
                              {itemDetails.stueck_pro_verpackung && (
                                <div className="font-bold mt-1 pt-1 border-t border-amber-300 dark:border-amber-700">
                                  Gesamt: {parseInt(movItem.quantity) * itemDetails.stueck_pro_verpackung} Stück
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Purchase Price with Type Selection */}
                    <div className="space-y-3 border-t pt-3">
                      <Label>Einkaufspreis (optional)</Label>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Preistyp</Label>
                          <Select
                            value={movItem.price_type}
                            onValueChange={(value: 'palette' | 'verpackung' | 'none') => updateItem(movItem.id, 'price_type', value)}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Preistyp wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Kein Preis erfassen</SelectItem>
                              <SelectItem value="palette">Pro Palette</SelectItem>
                              <SelectItem value="verpackung">Pro Verpackung</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Währung</Label>
                          <Select
                            value={movItem.currency}
                            onValueChange={(value: 'CHF' | 'EUR') => updateItem(movItem.id, 'currency', value)}
                            disabled={isSubmitting || movItem.price_type === 'none'}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CHF">CHF</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {movItem.price_type !== 'none' && (
                        <div className="space-y-2">
                          <Label htmlFor={`price-${movItem.id}`}>
                            {movItem.price_type === 'palette' ? `Preis pro Palette (${movItem.currency})` : `Preis pro Verpackung (${movItem.currency})`}
                          </Label>
                          <Input
                            id={`price-${movItem.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={movItem.purchase_price}
                            onChange={(e) => updateItem(movItem.id, 'purchase_price', e.target.value)}
                            disabled={isSubmitting}
                            placeholder="0.00"
                          />
                          {movItem.purchase_price && parseFloat(movItem.purchase_price) > 0 && parseInt(movItem.quantity) > 0 && itemDetails && (() => {
                            const price = parseFloat(movItem.purchase_price)
                            const qty = parseInt(movItem.quantity)

                            // Calculate the effective quantity based on price_type
                            let effectiveQty = qty
                            let unitLabel = movItem.price_type === 'palette' ? 'Paletten' : 'Verpackungen'

                            // If unit_type and price_type don't match, convert
                            if (movItem.unit_type === 'palette' && movItem.price_type === 'verpackung') {
                              // Einbuchen als Paletten, aber Preis pro Verpackung
                              effectiveQty = qty * (itemDetails.verpackungen_pro_palette || 1)
                              unitLabel = 'Verpackungen'
                            } else if (movItem.unit_type === 'verpackung' && movItem.price_type === 'palette') {
                              // Einbuchen als Verpackungen, aber Preis pro Palette (selten, aber möglich)
                              effectiveQty = qty / (itemDetails.verpackungen_pro_palette || 1)
                              unitLabel = 'Paletten'
                            }

                            const totalCost = price * effectiveQty

                            return (
                              <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                                Gesamtkosten: {movItem.currency} {totalCost.toFixed(2)} ({effectiveQty} {unitLabel} × {movItem.currency} {price.toFixed(2)})
                              </p>
                            )
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Error Message */}
                    {movItem.error && (
                      <p className="text-sm text-red-500">{movItem.error}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Total Price Summary */}
            {(() => {
              const totals = { CHF: 0, EUR: 0 }
              movementItems.forEach(movItem => {
                const price = parseFloat(movItem.purchase_price) || 0
                if (price === 0 || movItem.price_type === 'none') return
                const quantity = parseInt(movItem.quantity) || 0
                if (quantity === 0) return
                const itemDetails = getItemDetails(movItem.item)
                if (!itemDetails) return

                let effectiveQty = quantity
                if (movItem.unit_type === 'palette' && movItem.price_type === 'verpackung') {
                  effectiveQty = quantity * (itemDetails.verpackungen_pro_palette || 1)
                } else if (movItem.unit_type === 'verpackung' && movItem.price_type === 'palette') {
                  effectiveQty = quantity / (itemDetails.verpackungen_pro_palette || 1)
                }

                totals[movItem.currency] += price * effectiveQty
              })

              const hasAnyTotal = totals.CHF > 0 || totals.EUR > 0

              return hasAnyTotal && (
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Gesamteinkaufspreis:</span>
                    <div className="text-right">
                      {totals.CHF > 0 && (
                        <div className="text-lg font-bold text-green-700 dark:text-green-400">
                          CHF {totals.CHF.toFixed(2)}
                        </div>
                      )}
                      {totals.EUR > 0 && (
                        <div className="text-lg font-bold text-green-700 dark:text-green-400">
                          EUR {totals.EUR.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Supplier */}
            <div className="space-y-2">
              <Label htmlFor="supplier">Lieferant</Label>
              <Select
                value={supplier}
                onValueChange={setSupplier}
                disabled={isSubmitting}
              >
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Lieferant auswählen (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={String(sup.id)}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Notiz</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isSubmitting}
                placeholder="Optional: Zusätzliche Informationen zum Wareneingang"
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
                      value={movementDate}
                      onChange={(e) => setMovementDate(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="movement_time">Uhrzeit</Label>
                    <Input
                      id="movement_time"
                      type="time"
                      value={movementTime}
                      onChange={(e) => setMovementTime(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dialog Footer */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onClose()}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verbuche...
                  </>
                ) : (
                  <>Alle verbuchen ({movementItems.length})</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
