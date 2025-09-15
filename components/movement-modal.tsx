"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { stockMovementAPI, inventoryAPI, supplierAPI, customerAPI } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { notify } from "@/lib/notify"

interface MovementModalProps {
  isOpen: boolean
  onClose: () => void
  mode: "IN" | "OUT" | "RETURN"
  onSuccess: () => void
}

export function MovementModal({ isOpen, onClose, mode, onSuccess }: MovementModalProps) {
  const { t } = useTranslation()
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
      notify.error(t('movement.loadFormDataError'))
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
      notify.error(t('movement.itemRequired'))
      return
    }

    let qty_base = 0
    let qty_pallets = 0
    let qty_packages = 0
    let qty_singles = 0

    if (quantityInputMode === "total") {
      if (!formData.qty_base) {
        notify.error(t('movement.totalQuantityRequired'))
        return
      }
      qty_base = parseInt(formData.qty_base)
      if (isNaN(qty_base) || qty_base <= 0) {
        notify.error(t('movement.invalidTotalQuantity'))
        return
      }
    } else {
      qty_pallets = parseInt(formData.qty_pallets) || 0
      qty_packages = parseInt(formData.qty_packages) || 0
      qty_singles = parseInt(formData.qty_singles) || 0

      if (qty_pallets < 0 || qty_packages < 0 || qty_singles < 0) {
        notify.error(t('movement.negativeQuantities'))
        return
      }

      if (qty_pallets === 0 && qty_packages === 0 && qty_singles === 0) {
        notify.error(t('movement.minOneQuantity'))
        return
      }

      qty_base = calculateBaseUnits()
    }

    // Validate customer for RETURN movements
    if (mode === "RETURN" && !formData.customer) {
      notify.error(t('movement.customerRequiredForReturn'))
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

      const successKey = mode === "IN" ? 'movement.stockInSuccess' : mode === "OUT" ? 'movement.stockOutSuccess' : 'movement.returnSuccess'
      notify.success(t(successKey))
      
      resetForm()
      onClose()
      onSuccess()
    } catch (err: any) {
      console.error("Movement submission failed:", err)
      
      if (err.message.includes("422")) {
        notify.error(t('movement.insufficientStock'))
      } else if (err.message.includes("400")) {
        notify.error(t('movement.invalidInputs'))
      } else {
        notify.error(t('movement.submitError'))
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
            {t(mode === "IN" ? 'movement.stockIn' : mode === "OUT" ? 'movement.stockOut' : 'movement.return')}
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
                <SelectValue placeholder={t('placeholders.selectItem')} />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name} ({t('movement.available')}: {item.available_qty})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity Input Mode Selection */}
          <div>
            <Label>{t('movement.quantityLabel')}</Label>
            <Tabs value={quantityInputMode} onValueChange={(value) => setQuantityInputMode(value as "total" | "uom")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="total">{t('movement.totalQuantityTab')}</TabsTrigger>
                <TabsTrigger value="uom">{t('movement.uomTab')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="total" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="qty_base">{t('movement.totalQuantityLabel')} *</Label>
                  <Input
                    id="qty_base"
                    type="number"
                    min="1"
                    placeholder={t('movement.totalQuantityPlaceholder')}
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
                        <div className="font-medium mb-1">{t('movement.conversionFactors')}</div>
                        <div>• 1 Palette = {selectedItem.unit_pallet_factor || 1} Packungen</div>
                        <div>• 1 Packung = {selectedItem.unit_package_factor || 1} Einzelteile</div>
                        <div>• {t('movement.baseUnitLabel')}: {selectedItem.unit_base || "Stück"}</div>
                      </div>

                      {/* UoM Input Fields */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="qty_pallets">{t('movement.palletsLabel')}</Label>
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
                          <Label htmlFor="qty_packages">{t('movement.packagesLabel')}</Label>
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
                          <Label htmlFor="qty_singles">{t('movement.singlesLabel')}</Label>
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
              <Label htmlFor="supplier">{t('movement.supplierOptional')}</Label>
              <Select
                value={formData.supplier}
                onValueChange={(value) => setFormData(prev => ({ ...prev, supplier: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('placeholders.selectSupplier')} />
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
                {mode === "RETURN" ? t('movement.customerRequired') + ' *' : t('movement.customerOptional')}
              </Label>
              <Select
                value={formData.customer}
                onValueChange={(value) => setFormData(prev => ({ ...prev, customer: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('placeholders.selectCustomer')} />
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
            <Label htmlFor="note">{t('movement.noteOptional')}</Label>
            <Textarea
              id="note"
              placeholder={t('movement.additionalRemarks')}
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
            {t('common.cancel')}
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
            {isSubmitting ? t('movement.submitting') : t(mode === "IN" ? 'movement.submitStockIn' : mode === "OUT" ? 'movement.submitStockOut' : 'movement.submitReturn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
