"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Archive, ArchiveRestore, Download, FileText, Loader2, MoreVertical, Plus, Search, Settings, Trash2, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from 'react-hot-toast'
import { invoicesAPI, customerAPI, inventoryAPI, ordersAPI } from "@/lib/api"
import { useCustomerOptions } from "@/lib/hooks/useCustomerOptions"
import Link from "next/link"

interface InvoiceItem {
  item: number
  item_name?: string
  qty_base: number
  unit_price: string
  tax_rate: string
}

interface WizardData {
  customer: number
  customer_name?: string
  customer_address?: string
  items: InvoiceItem[]
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [isDownloading, setIsDownloading] = useState<number | null>(null)
  const [isArchiving, setIsArchiving] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<number | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardData>({
    customer: 0,
    items: []
  })
  const [isCreating, setIsCreating] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showProfileAlert, setShowProfileAlert] = useState(false)

  // Customer search for wizard
  const [customerSearch, setCustomerSearch] = useState("")
  const { customers } = useCustomerOptions(customerSearch)

  // Item search for wizard
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([])
  const [itemSearch, setItemSearch] = useState("")

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(num)
  }

  const loadInvoices = async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) {
        setIsLoading(true)
      }

      console.log(`[${new Date().toISOString()}] Loading invoices - page: ${currentPage}, search: "${searchTerm}"`)

      const response = await invoicesAPI.list({
        page: currentPage,
        search: searchTerm || undefined,
      })

      const loadedInvoices = response.results || []
      setInvoices(loadedInvoices)
      setTotalCount(response.count || 0)
      setHasNextPage(!!response.next)

      console.log(`[${new Date().toISOString()}] Successfully loaded ${loadedInvoices.length} invoices`)

    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Failed to load invoices:`, {
        error: err.message,
        page: currentPage,
        search: searchTerm,
        timestamp: new Date().toISOString()
      })

      // Don't show error toast if this is a background refresh
      if (showLoadingIndicator) {
        toast.error("Fehler beim Laden der Rechnungen")
      }
    } finally {
      if (showLoadingIndicator) {
        setIsLoading(false)
      }
    }
  }

  const loadItems = async (search: string = "") => {
    try {
      const response = await inventoryAPI.getItems({ search })
      setAvailableItems(Array.isArray(response.results) ? response.results : response || [])
    } catch (err) {
      console.error("Failed to load items:", err)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [currentPage, searchTerm])

  useEffect(() => {
    if (isWizardOpen && currentStep === 2) {
      loadItems(itemSearch)
    }
  }, [isWizardOpen, currentStep, itemSearch])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleDownloadPDF = async (invoiceId: number) => {
    try {
      setIsDownloading(invoiceId)
      await invoicesAPI.pdf(invoiceId)
      toast.success("PDF heruntergeladen")
    } catch (err: any) {
      console.error("Failed to download PDF:", err)
      if (err.message.includes('MISSING_COMPANY_PROFILE') || err.message.includes('INVALID_IBAN')) {
        toast.error("Bitte vervollständigen Sie Ihr Firmenprofil in den Einstellungen")
      } else {
        toast.error("Fehler beim Herunterladen des PDFs")
      }
    } finally {
      setIsDownloading(null)
    }
  }

  const handleArchiveInvoice = async (invoiceId: number, isCurrentlyArchived: boolean) => {
    // Pre-validate that the invoice exists
    const invoice = validateInvoiceExists(invoiceId)
    if (!invoice) return

    // Optimistic update: immediately update the UI
    const originalInvoices = [...invoices]
    const optimisticInvoices = invoices.map(invoice =>
      invoice.id === invoiceId
        ? { ...invoice, is_archived: !isCurrentlyArchived }
        : invoice
    )

    // Apply optimistic update
    setInvoices(optimisticInvoices)
    setIsArchiving(invoiceId)

    try {
      console.log(`[${new Date().toISOString()}] Attempting to ${isCurrentlyArchived ? 'unarchive' : 'archive'} invoice ${invoiceId}`)

      if (isCurrentlyArchived) {
        await invoicesAPI.unarchive(invoiceId)
        toast.success("Rechnung erfolgreich dearchiviert")
        console.log(`[${new Date().toISOString()}] Successfully unarchived invoice ${invoiceId}`)
      } else {
        await invoicesAPI.archive(invoiceId)
        toast.success("Rechnung erfolgreich archiviert")
        console.log(`[${new Date().toISOString()}] Successfully archived invoice ${invoiceId}`)
      }

      // Refresh the list to ensure consistency (this will overwrite our optimistic update with server truth)
      loadInvoices()
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Failed to archive/unarchive invoice ${invoiceId}:`, {
        error: err.message,
        invoiceId,
        isCurrentlyArchived,
        timestamp: new Date().toISOString()
      })

      // Rollback optimistic update on error
      setInvoices(originalInvoices)

      const action = isCurrentlyArchived ? "Dearchivieren" : "Archivieren"

      // Enhanced error messages
      if (err.message.includes('nicht gefunden') || err.message.includes('not found')) {
        toast.error(`Rechnung nicht gefunden. Sie wurde möglicherweise bereits gelöscht. Die Liste wird aktualisiert.`)
        // Force refresh to sync with server state
        loadInvoices()
      } else if (err.message.includes('bereits archiviert') || err.message.includes('nicht archiviert')) {
        toast.warning(err.message)
        // Refresh to get current state
        loadInvoices()
      } else {
        toast.error(`Fehler beim ${action} der Rechnung: ${err.message}`)
      }
    } finally {
      setIsArchiving(null)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!deleteInvoiceId) return

    // Store original state for potential rollback
    const originalInvoices = [...invoices]
    const invoiceToDelete = invoices.find(inv => inv.id === deleteInvoiceId)

    // Optimistic update: remove invoice from UI immediately
    const optimisticInvoices = invoices.filter(invoice => invoice.id !== deleteInvoiceId)
    setInvoices(optimisticInvoices)
    setIsDeleting(deleteInvoiceId)

    try {
      console.log(`[${new Date().toISOString()}] Attempting to delete invoice ${deleteInvoiceId} (${invoiceToDelete?.invoice_number || 'Unknown'})`)

      await invoicesAPI.delete(deleteInvoiceId)
      toast.success(`Rechnung ${invoiceToDelete?.invoice_number || deleteInvoiceId} erfolgreich gelöscht`)

      console.log(`[${new Date().toISOString()}] Successfully deleted invoice ${deleteInvoiceId}`)

      // Close dialog
      setShowDeleteDialog(false)
      setDeleteInvoiceId(null)

      // Refresh list to ensure consistency with server
      loadInvoices()

    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Failed to delete invoice ${deleteInvoiceId}:`, {
        error: err.message,
        invoiceId: deleteInvoiceId,
        invoiceNumber: invoiceToDelete?.invoice_number,
        timestamp: new Date().toISOString()
      })

      // Rollback optimistic update on error
      setInvoices(originalInvoices)

      // Enhanced error messages
      if (err.message.includes('nicht gefunden') || err.message.includes('not found')) {
        toast.error(`Rechnung nicht gefunden. Sie wurde möglicherweise bereits gelöscht. Die Liste wird aktualisiert.`)
        // Close dialog since the invoice doesn't exist anyway
        setShowDeleteDialog(false)
        setDeleteInvoiceId(null)
        // Force refresh to sync with server state
        loadInvoices()
      } else {
        toast.error(`Fehler beim Löschen der Rechnung: ${err.message}`)
      }
    } finally {
      setIsDeleting(null)
    }
  }

  const openDeleteDialog = (invoiceId: number) => {
    // Validate that the invoice still exists in our current list
    const invoiceExists = invoices.find(inv => inv.id === invoiceId)

    if (!invoiceExists) {
      console.warn(`[${new Date().toISOString()}] Attempted to delete non-existent invoice ${invoiceId}`)
      toast.error("Rechnung nicht gefunden. Die Liste wird aktualisiert.")
      loadInvoices()
      return
    }

    console.log(`[${new Date().toISOString()}] Opening delete dialog for invoice ${invoiceId} (${invoiceExists.invoice_number})`)
    setDeleteInvoiceId(invoiceId)
    setShowDeleteDialog(true)
  }

  // Add validation helper for archive operations
  const validateInvoiceExists = (invoiceId: number): Invoice | null => {
    const invoice = invoices.find(inv => inv.id === invoiceId)
    if (!invoice) {
      console.warn(`[${new Date().toISOString()}] Attempted operation on non-existent invoice ${invoiceId}`)
      toast.error("Rechnung nicht gefunden. Die Liste wird aktualisiert.")
      loadInvoices()
      return null
    }
    return invoice
  }

  const resetWizard = () => {
    setCurrentStep(1)
    setWizardData({ customer: 0, items: [] })
    setSelectedCustomer(null)
    setCustomerSearch("")
    setItemSearch("")
  }

  const handleWizardClose = () => {
    setIsWizardOpen(false)
    resetWizard()
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setWizardData(prev => ({
      ...prev,
      customer: customer.id!,
      customer_name: customer.name,
      customer_address: [customer.address, customer.shipping_address].filter(Boolean).join(', ') || ""
    }))
    setCustomerSearch("")
  }

  const addInvoiceItem = () => {
    setWizardData(prev => ({
      ...prev,
      items: [...prev.items, { item: 0, qty_base: 1, unit_price: "0.00", tax_rate: "8.10" }]
    }))
  }

  const removeInvoiceItem = (index: number) => {
    setWizardData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const updateInvoiceItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setWizardData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value }
          
          // Auto-fill item name when item is selected
          if (field === 'item' && value) {
            const selectedItem = availableItems.find(ai => ai.id === value)
            if (selectedItem) {
              updated.item_name = selectedItem.name
              updated.unit_price = selectedItem.price || "0.00"
              updated.tax_rate = selectedItem.vat_rate || "8.10"
            }
          }
          
          return updated
        }
        return item
      })
    }))
  }

  const calculateTotals = () => {
    let subtotal = 0
    let totalTax = 0

    wizardData.items.forEach(item => {
      const lineTotal = item.qty_base * parseFloat(item.unit_price || "0")
      const lineTax = lineTotal * (parseFloat(item.tax_rate || "0") / 100)
      
      subtotal += lineTotal
      totalTax += lineTax
    })

    return {
      subtotal,
      totalTax,
      total: subtotal + totalTax
    }
  }

  const createQuickInvoice = async (customerID: number, items: InvoiceItem[]) => {
    // Step 1: Create a draft order with items
    const orderPayload = {
      customer: customerID,
      status: 'DRAFT' as const,
      items: items.map(item => ({
        item: item.item,
        qty_base: item.qty_base,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate
      }))
    }
    
    console.log("Creating order with payload:", orderPayload)
    
    // First create order - but ordersAPI doesn't have a create method, we need to use a direct POST
    const orderResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/inventory/orders/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JSON.parse(localStorage.getItem("auth_tokens") || '{}').access}`
      },
      body: JSON.stringify({
        customer: customerID,
        status: 'DRAFT',
        notes: 'Quick Invoice'
      })
    })
    
    if (!orderResponse.ok) {
      throw new Error(`Order creation failed: ${orderResponse.status}`)
    }
    
    const order = await orderResponse.json()
    console.log("Order created:", order)
    
    // Step 2: Add items to the order
    for (const item of items) {
      const itemPayload = {
        order: order.id,
        item: item.item,
        qty_base: item.qty_base,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate
      }
      
      const itemResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/inventory/order-items/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem("auth_tokens") || '{}').access}`
        },
        body: JSON.stringify(itemPayload)
      })
      
      if (!itemResponse.ok) {
        throw new Error(`Item creation failed: ${itemResponse.status}`)
      }
    }
    
    // Step 3: Confirm the order
    await ordersAPI.confirm(order.id)
    console.log("Order confirmed")
    
    // Step 4: Deliver the order
    await ordersAPI.deliver(order.id)
    console.log("Order delivered")
    
    // Step 5: Create invoice from order
    const invoice = await ordersAPI.invoice(order.id)
    console.log("Invoice created:", invoice)
    
    return invoice
  }

  const handleCreateInvoice = async () => {
    try {
      setIsCreating(true)

      // Validation
      if (!wizardData.customer) {
        toast.error("Bitte wählen Sie einen Kunden aus")
        return
      }

      if (wizardData.items.length === 0) {
        toast.error("Bitte fügen Sie mindestens einen Artikel hinzu")
        return
      }

      const invalidItems = wizardData.items.filter(item => 
        !item.item || item.qty_base <= 0 || !item.unit_price || parseFloat(item.unit_price) <= 0
      )

      if (invalidItems.length > 0) {
        toast.error("Bitte überprüfen Sie alle Artikel-Angaben")
        return
      }

      console.log("Creating quick invoice with data:", wizardData)
      const invoice = await createQuickInvoice(wizardData.customer, wizardData.items)

      toast.success("Rechnung erfolgreich erstellt")
      
      // Auto-download PDF
      try {
        await invoicesAPI.pdf(invoice.id!)
        toast.success("PDF heruntergeladen")
      } catch (pdfErr) {
        console.error("PDF download failed:", pdfErr)
        toast.error("Rechnung erstellt, aber PDF-Download fehlgeschlagen")
      }

      // Close wizard and refresh list
      handleWizardClose()
      loadInvoices()

    } catch (err: any) {
      console.error("Failed to create invoice:", err)
      console.error("Error details:", {
        message: err.message,
        status: err.status,
        response: err.response,
        stack: err.stack
      })
      
      if (err.message.includes('MISSING_COMPANY_PROFILE') || err.message.includes('INVALID_IBAN')) {
        setShowProfileAlert(true)
        toast.error("Firmenprofil unvollständig")
      } else if (err.message.includes('INSUFFICIENT_STOCK') || err.message.includes('422')) {
        toast.error("Unzureichender Bestand bei einem oder mehreren Artikeln")
      } else if (err.message.includes('Status 404')) {
        toast.error("API-Endpunkt nicht gefunden. Ist der Server gestartet?")
      } else if (err.message.includes('Status 500')) {
        toast.error("Serverfehler. Bitte versuchen Sie es später erneut.")
      } else if (err.message.includes('fetch')) {
        toast.error("Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.")
      } else {
        toast.error(`Fehler beim Erstellen der Rechnung: ${err.message || 'Unbekannter Fehler'}`)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const renderWizardStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-search">Kunde suchen</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="customer-search"
                  placeholder="Kundenname eingeben..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {customerSearch && customers.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    <div className="font-medium">{customer.name}</div>
                    {customer.contact_name && (
                      <div className="text-sm text-gray-500">{customer.contact_name}</div>
                    )}
                    {customer.email && (
                      <div className="text-sm text-gray-500">{customer.email}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedCustomer && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ausgewählter Kunde</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div><strong>{selectedCustomer.name}</strong></div>
                    {selectedCustomer.contact_name && (
                      <div className="text-sm text-gray-600">Kontakt: {selectedCustomer.contact_name}</div>
                    )}
                    {selectedCustomer.email && (
                      <div className="text-sm text-gray-600">E-Mail: {selectedCustomer.email}</div>
                    )}
                    {selectedCustomer.phone && (
                      <div className="text-sm text-gray-600">Telefon: {selectedCustomer.phone}</div>
                    )}
                    {wizardData.customer_address && (
                      <div className="text-sm text-gray-600">
                        <strong>Adresse:</strong><br />
                        {wizardData.customer_address}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case 2:
        const totals = calculateTotals()
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Rechnungspositionen</h3>
              <Button onClick={addInvoiceItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Position hinzufügen
              </Button>
            </div>

            {wizardData.items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Keine Positionen vorhanden. Klicken Sie auf "Position hinzufügen" um zu beginnen.
              </div>
            ) : (
              <div className="space-y-4">
                {wizardData.items.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2 relative">
                          <Label>Artikel</Label>
                          <div className="relative">
                            <Input
                              placeholder="Artikel suchen..."
                              value={itemSearch}
                              onChange={(e) => setItemSearch(e.target.value)}
                            />
                            {itemSearch && availableItems.length > 0 && (
                              <div className="absolute z-20 w-full bg-white border rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                                {availableItems.filter(ai => 
                                  ai.name.toLowerCase().includes(itemSearch.toLowerCase())
                                ).slice(0, 10).map((availableItem) => (
                                  <div
                                    key={availableItem.id}
                                    className="p-2 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => {
                                      updateInvoiceItem(index, 'item', availableItem.id)
                                      setItemSearch("")
                                    }}
                                  >
                                    <div className="font-medium">{availableItem.name}</div>
                                    <div className="text-sm text-gray-500">
                                      {formatCurrency(availableItem.price || "0")} - Lager: {availableItem.quantity}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {item.item_name && (
                            <div className="mt-1 text-sm font-medium text-green-600">
                              ✓ {item.item_name}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label>Menge</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.qty_base}
                            onChange={(e) => updateInvoiceItem(index, 'qty_base', parseInt(e.target.value) || 1)}
                          />
                        </div>

                        <div>
                          <Label>Einzelpreis (CHF)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => updateInvoiceItem(index, 'unit_price', e.target.value)}
                          />
                        </div>

                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label>MWST %</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={item.tax_rate}
                              onChange={(e) => updateInvoiceItem(index, 'tax_rate', e.target.value)}
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeInvoiceItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-right text-sm text-gray-600">
                        Zeilensumme: {formatCurrency((item.qty_base * parseFloat(item.unit_price || "0")))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-2 text-right">
                      <div className="flex justify-between">
                        <span>Zwischensumme:</span>
                        <span>{formatCurrency(totals.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>MWST:</span>
                        <span>{formatCurrency(totals.totalTax)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(totals.total)}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        * Die tatsächliche Berechnung erfolgt durch den Server
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )

      case 3:
        const finalTotals = calculateTotals()
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Rechnung erstellen</h3>
            
            <Card>
              <CardHeader>
                <CardTitle>Zusammenfassung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <strong>Kunde:</strong> {wizardData.customer_name}
                </div>
                
                <div>
                  <strong>Positionen:</strong> {wizardData.items.length} Artikel
                </div>
                
                <div className="text-right space-y-1">
                  <div>Zwischensumme: {formatCurrency(finalTotals.subtotal)}</div>
                  <div>MWST: {formatCurrency(finalTotals.totalTax)}</div>
                  <div className="font-bold text-lg">
                    Total: {formatCurrency(finalTotals.total)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Die Rechnung wird erstellt und das PDF automatisch heruntergeladen.
                Stellen Sie sicher, dass Ihr Firmenprofil (inkl. IBAN) vollständig ausgefüllt ist.
              </AlertDescription>
            </Alert>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile completion alert */}
      {showProfileAlert && (
        <Alert className="bg-amber-50 text-amber-700 border-amber-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Ihr Firmenprofil ist unvollständig. Bitte ergänzen Sie Ihre IBAN, um QR-Rechnungen zu generieren.
            </span>
            <div className="flex gap-2 ml-4">
              <Link href="/settings">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Zu den Einstellungen
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowProfileAlert(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Rechnungen</h1>
        <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neue Rechnung
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Neue Rechnung erstellen</DialogTitle>
              <DialogDescription>
                Schritt {currentStep} von 3: {
                  currentStep === 1 ? "Kunde auswählen" :
                  currentStep === 2 ? "Positionen erfassen" :
                  "Rechnung generieren"
                }
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {renderWizardStep()}
            </div>

            <DialogFooter className="flex justify-between">
              <div>
                {currentStep > 1 && (
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    disabled={isCreating}
                  >
                    Zurück
                  </Button>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleWizardClose}
                  disabled={isCreating}
                >
                  Abbrechen
                </Button>
                
                {currentStep < 3 ? (
                  <Button 
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    disabled={
                      (currentStep === 1 && !selectedCustomer) ||
                      (currentStep === 2 && wizardData.items.length === 0)
                    }
                  >
                    Weiter
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCreateInvoice}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Erstelle Rechnung...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Rechnung erstellen
                      </>
                    )}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Suche nach Rechnungsnummer oder Kunde..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices table */}
      <Card>
        <CardHeader>
          <CardTitle>Rechnungsübersicht</CardTitle>
          <CardDescription>
            {totalCount} Rechnungen gefunden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2">Lade Rechnungen...</p>
              </div>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Rechnungen gefunden</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? "Keine Rechnungen entsprechen Ihren Suchkriterien." : "Erstellen Sie Ihre erste Rechnung."}
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Neue Rechnung
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rechnung Nr.</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {invoice.invoice_number}
                          {invoice.is_archived && (
                            <Badge variant="secondary" className="text-xs">
                              Archiviert
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>
                        {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('de-CH') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(invoice.total_gross)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDownloadPDF(invoice.id!)}
                              disabled={isDownloading === invoice.id}
                            >
                              {isDownloading === invoice.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              PDF herunterladen
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => handleArchiveInvoice(invoice.id!, invoice.is_archived || false)}
                              disabled={isArchiving === invoice.id}
                            >
                              {isArchiving === invoice.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : invoice.is_archived ? (
                                <ArchiveRestore className="h-4 w-4 mr-2" />
                              ) : (
                                <Archive className="h-4 w-4 mr-2" />
                              )}
                              {invoice.is_archived ? 'Dearchivieren' : 'Archivieren'}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(invoice.id!)}
                              disabled={isDeleting === invoice.id}
                              className="text-red-600 focus:text-red-600"
                            >
                              {isDeleting === invoice.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {(currentPage > 1 || hasNextPage) && (
                <div className="flex items-center justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                  >
                    Vorherige
                  </Button>
                  
                  <span className="text-sm text-gray-600">
                    Seite {currentPage}
                  </span>
                  
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={!hasNextPage || isLoading}
                  >
                    Nächste
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechnung löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie diese Rechnung unwiderruflich löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting !== null}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteInvoice}
              disabled={isDeleting !== null}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gelöscht...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Löschen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}