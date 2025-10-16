"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Plus, Trash2, PackageOpen, Package } from "lucide-react"
import { stockMovementAPI, inventoryAPI, supplierAPI } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { toast } from "react-hot-toast"

interface MovementItem {
  id: string
  item: string
  paletten: string
  verpackungen: string
  purchase_price: string
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
    { id: '1', item: '', paletten: '', verpackungen: '', purchase_price: '' }
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
    setMovementItems([{ id: '1', item: '', paletten: '', verpackungen: '', purchase_price: '' }])
    setSupplier("")
    setNote("")
    setMovementDate("")
    setMovementTime("")
    setUseCurrentDateTime(true)
    setGlobalError("")
  }

  const addItem = () => {
    const newId = (Math.max(...movementItems.map(item => parseInt(item.id) || 0)) + 1).toString()
    setMovementItems([...movementItems, { id: newId, item: '', paletten: '', verpackungen: '', purchase_price: '' }])
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

      // Check if at least one quantity is provided
      const paletten = parseInt(movItem.paletten) || 0
      const verpackungen = parseInt(movItem.verpackungen) || 0

      if (paletten === 0 && verpackungen === 0) {
        isValid = false
        return { ...movItem, error: 'Mindestens Paletten oder Verpackungen angeben' }
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

        const paletten = parseInt(movItem.paletten) || 0
        const verpackungen = parseInt(movItem.verpackungen) || 0
        const purchasePrice = movItem.purchase_price ? parseFloat(movItem.purchase_price) : null

        // Create movements for paletten if > 0
        if (paletten > 0) {
          const palettenPayload: any = {
            item: parseInt(movItem.item),
            type: 'IN',
            unit: 'palette',
            quantity: paletten,
            note: note || `Wareneingang: ${itemDetails.name}`,
            supplier: supplier ? parseInt(supplier) : null,
            idempotency_key: `${Date.now()}-${movItem.id}-palette`
          }

          // Add purchase price only to palette movement (to avoid double-counting)
          if (purchasePrice && purchasePrice > 0) {
            palettenPayload.purchase_price = purchasePrice
          }

          if (!useCurrentDateTime && movementDate && movementTime) {
            palettenPayload.movement_timestamp = `${movementDate}T${movementTime}:00`
          }

          await stockMovementAPI.createMovement(palettenPayload)
        }

        // Create movement for additional verpackungen (not in paletten) if > 0
        if (verpackungen > 0) {
          const verpackungenPayload: any = {
            item: parseInt(movItem.item),
            type: 'IN',
            unit: 'verpackung',
            quantity: verpackungen,
            note: note || `Wareneingang: ${itemDetails.name}`,
            supplier: supplier ? parseInt(supplier) : null,
            idempotency_key: `${Date.now()}-${movItem.id}-verpackung`
          }

          // Only add purchase price if paletten was 0 (avoid double expense creation)
          if (paletten === 0 && purchasePrice && purchasePrice > 0) {
            verpackungenPayload.purchase_price = purchasePrice
          }

          if (!useCurrentDateTime && movementDate && movementTime) {
            verpackungenPayload.movement_timestamp = `${movementDate}T${movementTime}:00`
          }

          await stockMovementAPI.createMovement(verpackungenPayload)
        }
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
    return movementItems.reduce((sum, item) => {
      const price = parseFloat(item.purchase_price) || 0
      return sum + price
    }, 0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto"
        aria-describedby="multi-movement-modal-description"
      >
        <DialogHeader>
          <DialogTitle>Wareneingang (Mehrere Artikel)</DialogTitle>
          <p id="multi-movement-modal-description" className="text-sm text-muted-foreground">
            Mehrere Artikel gleichzeitig einbuchen. Pro Artikel können Paletten UND Verpackungen angegeben werden.
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
                        <div className="flex gap-4">
                          <span>Aktuell: {itemDetails.palette_quantity || 0} Paletten</span>
                          <span>•</span>
                          <span>{itemDetails.verpackung_quantity || 0} Verpackungen</span>
                          {itemDetails.verpackungen_pro_palette && (
                            <>
                              <span>•</span>
                              <span>{itemDetails.verpackungen_pro_palette} V/Palette</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quantities */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`paletten-${movItem.id}`} className="flex items-center gap-2">
                          <PackageOpen className="h-4 w-4" />
                          Paletten
                        </Label>
                        <Input
                          id={`paletten-${movItem.id}`}
                          type="number"
                          min="0"
                          value={movItem.paletten}
                          onChange={(e) => updateItem(movItem.id, 'paletten', e.target.value)}
                          disabled={isSubmitting}
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`verpackungen-${movItem.id}`} className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Verpackungen (einzeln)
                        </Label>
                        <Input
                          id={`verpackungen-${movItem.id}`}
                          type="number"
                          min="0"
                          value={movItem.verpackungen}
                          onChange={(e) => updateItem(movItem.id, 'verpackungen', e.target.value)}
                          disabled={isSubmitting}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Purchase Price */}
                    <div className="space-y-2">
                      <Label htmlFor={`price-${movItem.id}`}>Einkaufspreis (CHF)</Label>
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
                      <p className="text-xs text-muted-foreground">
                        Optional: Wird automatisch als Ausgabe erfasst
                      </p>
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
            {calculateTotalPrice() > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Gesamteinkaufspreis:</span>
                  <span className="text-lg font-bold text-green-700 dark:text-green-400">
                    CHF {calculateTotalPrice().toFixed(2)}
                  </span>
                </div>
              </div>
            )}

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
