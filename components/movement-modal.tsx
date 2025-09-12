"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import { stockMovementAPI, inventoryAPI, supplierAPI, customerAPI } from "@/lib/api"

interface MovementModalProps {
  isOpen: boolean
  onClose: () => void
  mode: "IN" | "OUT" | "RETURN"
  onSuccess: () => void
}

export function MovementModal({ isOpen, onClose, mode, onSuccess }: MovementModalProps) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quantityInputMode, setQuantityInputMode] = useState<"total" | "uom">("total")
  
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

  useEffect(() => {
    if (isOpen) {
      loadFormData()
    }
  }, [isOpen])

  const loadFormData = async () => {
    try {
      const [itemsData, suppliersData, customersData] = await Promise.all([
        inventoryAPI.getItems(),
        supplierAPI.getSuppliers(),
        customerAPI.getCustomers()
      ])
      
      const itemsArray = Array.isArray(itemsData) ? itemsData : itemsData.results || []
      const suppliersArray = Array.isArray(suppliersData) ? suppliersData : suppliersData.results || []
      const customersArray = Array.isArray(customersData) ? customersData : customersData.results || []
      
      setItems(itemsArray)
      setSuppliers(suppliersArray)
      setCustomers(customersArray)
    } catch (err) {
      console.error("Failed to load form data:", err)
      toast.error("Fehler beim Laden der Formulardaten")
    }
  }

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
  }

  const calculateBaseUnits = () => {
    const selectedItem = items.find(item => item.id === parseInt(formData.item))
    if (!selectedItem) return 0

    const pallets = parseInt(formData.qty_pallets) || 0
    const packages = parseInt(formData.qty_packages) || 0
    const singles = parseInt(formData.qty_singles) || 0

    return (
      pallets * (selectedItem.unit_pallet_factor || 1) * (selectedItem.unit_package_factor || 1) +
      packages * (selectedItem.unit_package_factor || 1) +
      singles
    )
  }

  const getUoMPreview = () => {
    const selectedItem = items.find(item => item.id === parseInt(formData.item))
    if (!selectedItem || quantityInputMode === "total") return null

    const totalBase = calculateBaseUnits()
    if (totalBase === 0) return null

    const currentQty = selectedItem.available_qty || 0
    const newQty = mode === "IN" || mode === "RETURN"
      ? currentQty + totalBase 
      : currentQty - totalBase

    const operation = mode === "IN" || mode === "RETURN" ? "+" : "-"
    
    return {
      totalBase,
      currentQty,
      newQty,
      operation
    }
  }

  const handleSubmit = async () => {
    // Validate inputs
    if (!formData.item) {
      toast.error("Bitte wählen Sie einen Artikel aus")
      return
    }

    let qty_base = 0
    let qty_pallets = 0
    let qty_packages = 0
    let qty_singles = 0

    if (quantityInputMode === "total") {
      if (!formData.qty_base) {
        toast.error("Bitte geben Sie eine Gesamtmenge ein")
        return
      }
      qty_base = parseInt(formData.qty_base)
      if (isNaN(qty_base) || qty_base <= 0) {
        toast.error("Bitte geben Sie eine gültige Gesamtmenge größer als 0 ein")
        return
      }
    } else {
      qty_pallets = parseInt(formData.qty_pallets) || 0
      qty_packages = parseInt(formData.qty_packages) || 0
      qty_singles = parseInt(formData.qty_singles) || 0

      if (qty_pallets < 0 || qty_packages < 0 || qty_singles < 0) {
        toast.error("Mengen dürfen nicht negativ sein")
        return
      }

      if (qty_pallets === 0 && qty_packages === 0 && qty_singles === 0) {
        toast.error("Mindestens eine Menge muss größer als 0 sein")
        return
      }

      qty_base = calculateBaseUnits()
    }

    // Validate customer for RETURN movements
    if (mode === "RETURN" && !formData.customer) {
      toast.error("Bitte wählen Sie einen Kunden für die Retoure aus")
      return
    }

    try {
      setIsSubmitting(true)
      
      const movementData: any = {
        type: mode,
        item: parseInt(formData.item),
        qty_base: qty_base
      }

      // Add UoM fields only in UoM mode
      if (quantityInputMode === "uom") {
        movementData.qty_pallets = qty_pallets
        movementData.qty_packages = qty_packages
        movementData.qty_singles = qty_singles
      }

      if (mode === "IN" && formData.supplier) {
        movementData.supplier = parseInt(formData.supplier)
      }
      if ((mode === "OUT" || mode === "RETURN") && formData.customer) {
        movementData.customer = parseInt(formData.customer)
      }
      if (formData.note) {
        movementData.note = formData.note
      }

      console.log("Sending movement data:", movementData)
      await stockMovementAPI.createMovement(movementData)

      const movementType = mode === "IN" ? "Wareneingang" : mode === "OUT" ? "Warenausgang" : "Retoure"
      toast.success(`${movementType} erfolgreich gebucht`)
      
      resetForm()
      onClose()
      onSuccess()
    } catch (err: any) {
      console.error("Movement submission failed:", err)
      
      if (err.message.includes("422")) {
        toast.error("Buchung abgelehnt: Bestand würde negativ werden.")
      } else if (err.message.includes("400")) {
        toast.error("Ungültige Eingaben. Bitte überprüfen Sie Ihre Angaben.")
      } else {
        toast.error("Fehler beim Buchen der Bewegung. Bitte versuchen Sie es erneut.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm()
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "IN" ? "Wareneingang buchen" : mode === "OUT" ? "Warenausgang buchen" : "Retoure buchen"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Item Selection */}
          <div>
            <Label htmlFor="item">Artikel *</Label>
            <Select
              value={formData.item}
              onValueChange={(value) => setFormData(prev => ({ ...prev, item: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Artikel auswählen" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name} (Verfügbar: {item.available_qty})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity Input Mode Selection */}
          <div>
            <Label>Menge eingeben als:</Label>
            <Tabs value={quantityInputMode} onValueChange={(value) => setQuantityInputMode(value as "total" | "uom")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="total">Gesamtmenge</TabsTrigger>
                <TabsTrigger value="uom">Pal/Pack/Einzel</TabsTrigger>
              </TabsList>
              
              <TabsContent value="total" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="qty_base">Gesamtmenge *</Label>
                  <Input
                    id="qty_base"
                    type="number"
                    min="1"
                    placeholder="Anzahl eingeben"
                    value={formData.qty_base}
                    onChange={(e) => setFormData(prev => ({ ...prev, qty_base: e.target.value }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="uom" className="space-y-4 mt-4">
                {formData.item && (() => {
                  const selectedItem = items.find(item => item.id === parseInt(formData.item))
                  return selectedItem && (
                    <div className="space-y-4">
                      {/* UoM Factors Info */}
                      <div className="bg-gray-50 p-3 rounded-md text-sm">
                        <div className="font-medium mb-1">Umrechnungsfaktoren:</div>
                        <div>• 1 Palette = {selectedItem.unit_pallet_factor || 1} Packungen</div>
                        <div>• 1 Packung = {selectedItem.unit_package_factor || 1} Einzelteile</div>
                        <div>• Basis-Einheit: {selectedItem.unit_base || "Stück"}</div>
                      </div>

                      {/* UoM Input Fields */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="qty_pallets">Paletten</Label>
                          <Input
                            id="qty_pallets"
                            type="number"
                            min="0"
                            placeholder="0"
                            value={formData.qty_pallets}
                            onChange={(e) => setFormData(prev => ({ ...prev, qty_pallets: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="qty_packages">Packungen</Label>
                          <Input
                            id="qty_packages"
                            type="number"
                            min="0"
                            placeholder="0"
                            value={formData.qty_packages}
                            onChange={(e) => setFormData(prev => ({ ...prev, qty_packages: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="qty_singles">Einzelteile</Label>
                          <Input
                            id="qty_singles"
                            type="number"
                            min="0"
                            placeholder="0"
                            value={formData.qty_singles}
                            onChange={(e) => setFormData(prev => ({ ...prev, qty_singles: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Live Preview */}
                      {(() => {
                        const preview = getUoMPreview()
                        return preview && (
                          <div className="bg-blue-50 p-3 rounded-md text-sm">
                            <div className="font-medium text-blue-800">Vorschau:</div>
                            <div className="text-blue-700">
                              Entspricht {preview.totalBase} Basis-Einheiten
                            </div>
                            <div className="text-blue-700">
                              Neuer Bestand: {preview.currentQty} {preview.operation} {preview.totalBase} = {preview.newQty}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}
              </TabsContent>
            </Tabs>
          </div>

          {/* Supplier (for IN) or Customer (for OUT/RETURN) */}
          {mode === "IN" && (
            <div>
              <Label htmlFor="supplier">Lieferant (optional)</Label>
              <Select
                value={formData.supplier}
                onValueChange={(value) => setFormData(prev => ({ ...prev, supplier: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Lieferant auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={String(supplier.id)}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(mode === "OUT" || mode === "RETURN") && (
            <div>
              <Label htmlFor="customer">
                Kunde {mode === "RETURN" ? "*" : "(optional)"}
              </Label>
              <Select
                value={formData.customer}
                onValueChange={(value) => setFormData(prev => ({ ...prev, customer: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kunde auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={String(customer.id)}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="note">Notiz (optional)</Label>
            <Textarea
              id="note"
              placeholder="Zusätzliche Bemerkungen"
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={
              mode === "IN" 
                ? "bg-green-600 hover:bg-green-700" 
                : mode === "OUT"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-orange-600 hover:bg-orange-700"
            }
          >
            {isSubmitting ? "Wird gebucht..." : (mode === "IN" ? "Wareneingang buchen" : mode === "OUT" ? "Warenausgang buchen" : "Retoure buchen")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
