"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, ArrowDown, ArrowUp, Box, Search, TrendingUp, TrendingDown, RotateCcw, Trash2, Pencil } from "lucide-react"
import { stockMovementAPI, supplierAPI, customerAPI } from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/date-range-picker"
import { MovementModal } from "@/components/movement-modal"
import { MultiItemMovementModal } from "@/components/multi-item-movement-modal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "react-hot-toast"
import type { DateRange } from "react-day-picker"
import { Textarea } from "@/components/ui/textarea"

export default function LogsPage() {
  const [logs, setLogs] = useState<StockMovement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [isMultiItemModalOpen, setIsMultiItemModalOpen] = useState(false)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [movementMode, setMovementMode] = useState<"IN" | "OUT" | "RETURN">("OUT")
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [editingLog, setEditingLog] = useState<StockMovement | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editFormData, setEditFormData] = useState({
    quantity: "",
    unit: "verpackung" as "palette" | "verpackung",
    supplier: "",
    customer: "",
    note: "",
    purchase_price: "",
    price_type: "none" as "palette" | "verpackung" | "none",
    currency: "CHF",
    movement_date: "",
    movement_time: "",
    use_current_datetime: false
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoadingEditData, setIsLoadingEditData] = useState(false)

  useEffect(() => {
    if (editingLog && showEditDialog) {
      const movementDate = editingLog.movement_timestamp ? new Date(editingLog.movement_timestamp) : null
      setEditFormData({
        quantity: editingLog.quantity?.toString() || "",
        unit: editingLog.unit || "verpackung",
        supplier: editingLog.supplier?.toString() || "",
        customer: editingLog.customer?.toString() || "",
        note: editingLog.note || "",
        purchase_price: editingLog.purchase_price || "",
        price_type: editingLog.purchase_price ? "verpackung" : "none",
        currency: editingLog.currency || "CHF",
        movement_date: movementDate ? movementDate.toISOString().split('T')[0] : "",
        movement_time: movementDate ? movementDate.toTimeString().slice(0, 5) : "",
        use_current_datetime: false
      })

      // Load suppliers and customers
      const loadEditData = async () => {
        try {
          setIsLoadingEditData(true)
          const [suppliersData, customersData] = await Promise.all([
            supplierAPI.getSuppliers(),
            customerAPI.getCustomers()
          ])
          setSuppliers(Array.isArray(suppliersData) ? suppliersData : suppliersData.results || [])
          setCustomers(Array.isArray(customersData) ? customersData : customersData.results || [])
        } catch (err) {
          console.error("Failed to load edit data:", err)
        } finally {
          setIsLoadingEditData(false)
        }
      }

      loadEditData()
    }
  }, [editingLog, showEditDialog])

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setIsLoading(true)
        const data = await stockMovementAPI.getMovements()
        // Ensure data is an array
        setLogs(Array.isArray(data.results) ? data.results : [])
      } catch (err) {
        setError("Failed to fetch logs")
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLogs()
  }, [])

  const handleMovementSuccess = () => {
    const fetchLogs = async () => {
      try {
        setIsLoading(true)
        const data = await stockMovementAPI.getMovements()
        setLogs(Array.isArray(data.results) ? data.results : [])
      } catch (err) {
        setError("Failed to fetch logs")
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLogs()
  }

  const openWarenausgangModal = () => {
    setMovementMode("OUT")
    setIsMovementModalOpen(true)
  }

  const openRetourModal = () => {
    setMovementMode("RETURN")
    setIsMovementModalOpen(true)
  }

  const handleClearAllLogs = async () => {
    try {
      setIsClearing(true)
      await stockMovementAPI.clearAll()
      toast.success("Alle Logs erfolgreich gelöscht")
      setShowClearDialog(false)

      // Refresh logs
      const data = await stockMovementAPI.getMovements()
      setLogs(Array.isArray(data.results) ? data.results : [])
    } catch (err: any) {
      console.error("Failed to clear logs:", err)
      toast.error("Fehler beim Löschen der Logs")
    } finally {
      setIsClearing(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingLog) return

    try {
      setIsSavingEdit(true)

      const updateData: any = {
        note: editFormData.note || null,
      }

      if (editFormData.quantity && parseInt(editFormData.quantity) > 0) {
        updateData.quantity = parseInt(editFormData.quantity)
      }

      if (editFormData.unit) {
        updateData.unit = editFormData.unit
      }

      if (editingLog.type === "IN") {
        updateData.supplier = (editFormData.supplier && editFormData.supplier !== "none") ? parseInt(editFormData.supplier) : null
      } else if (editingLog.type === "OUT" || editingLog.type === "RETURN") {
        updateData.customer = (editFormData.customer && editFormData.customer !== "none") ? parseInt(editFormData.customer) : null
      }

      if (editFormData.price_type !== "none" && editFormData.purchase_price) {
        updateData.purchase_price = parseFloat(editFormData.purchase_price)
        updateData.currency = editFormData.currency
      }

      if (!editFormData.use_current_datetime && editFormData.movement_date && editFormData.movement_time) {
        const datetime = new Date(`${editFormData.movement_date}T${editFormData.movement_time}:00`)
        updateData.movement_timestamp = datetime.toISOString()
      }

      await stockMovementAPI.updateMovement(editingLog.id, updateData)
      toast.success("Bewegung erfolgreich aktualisiert")
      setShowEditDialog(false)
      setEditingLog(null)

      // Refresh logs
      const data = await stockMovementAPI.getMovements()
      setLogs(Array.isArray(data.results) ? data.results : [])
    } catch (err: any) {
      console.error("Failed to update movement:", err)
      toast.error("Fehler beim Aktualisieren der Bewegung")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteMovement = async () => {
    if (!editingLog) return

    if (!confirm("Möchten Sie diese Bewegung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) {
      return
    }

    try {
      setIsSavingEdit(true)
      await stockMovementAPI.deleteMovement(editingLog.id)
      toast.success("Bewegung erfolgreich gelöscht")
      setShowEditDialog(false)
      setEditingLog(null)

      // Refresh logs
      const data = await stockMovementAPI.getMovements()
      setLogs(Array.isArray(data.results) ? data.results : [])
    } catch (err: any) {
      console.error("Failed to delete movement:", err)
      toast.error("Fehler beim Löschen der Bewegung")
    } finally {
      setIsSavingEdit(false)
    }
  }


  // Filter logs based on search query, action filter, and date range
  const filteredLogs = Array.isArray(logs)
    ? logs.filter((log) => {
        // Apply search filter
        const matchesSearch =
          searchQuery === "" ||
          (log.item_name && log.item_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (log.created_by_username && log.created_by_username.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (log.note && log.note.toLowerCase().includes(searchQuery.toLowerCase()))

        // Apply action filter
        const matchesAction = actionFilter === "all" || log.type === actionFilter

        // Apply date range filter
        const logDate = new Date(log.created_at)
        const matchesDateRange =
          (!dateRange?.from || logDate >= dateRange.from) && (!dateRange?.to || logDate <= dateRange.to)

        return matchesSearch && matchesAction && matchesDateRange
      })
    : []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2">Loading logs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-500">
          <AlertTriangle className="h-8 w-8 mx-auto" />
          <p className="mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-1">Please check your API connection</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center w-full sm:w-auto relative">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search logs..."
            className="pl-8 w-full sm:w-[300px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setIsMultiItemModalOpen(true)} className="bg-green-600 hover:bg-green-700">
            <TrendingUp className="h-4 w-4 mr-2" />
            + Wareneingang
          </Button>
          <Button onClick={openWarenausgangModal} className="bg-red-600 hover:bg-red-700">
            <TrendingDown className="h-4 w-4 mr-2" />
            + Warenausgang
          </Button>
          <Button onClick={openRetourModal} className="bg-orange-600 hover:bg-orange-700">
            <RotateCcw className="h-4 w-4 mr-2" />
            + Retoure
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="action-filter" className="whitespace-nowrap">
                Action:
              </Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger id="action-filter" className="w-[150px]">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="IN">Stock In</SelectItem>
                  <SelectItem value="OUT">Stock Out</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="date-range" className="whitespace-nowrap">
                Date Range:
              </Label>
              <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setActionFilter("all")
                  setDateRange({ from: undefined, to: undefined })
                }}
              >
                Reset Filters
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowClearDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Alle Logs löschen
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Supplier/Customer</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.movement_timestamp || log.created_at).toLocaleString()}</TableCell>
                    <TableCell>{log.item_name || `Item #${log.item}`}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          log.type === "IN"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : log.type === "OUT"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-orange-50 text-orange-700 border-orange-200"
                        }
                      >
                        {log.type === "IN" ? (
                          <ArrowUp className="h-3 w-3 mr-1" />
                        ) : log.type === "OUT" ? (
                          <ArrowDown className="h-3 w-3 mr-1" />
                        ) : (
                          <RotateCcw className="h-3 w-3 mr-1" />
                        )}
                        {log.type === "IN" ? "Stock In" : log.type === "OUT" ? "Stock Out" : "Return"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.type === "IN" ? "+" : log.type === "OUT" ? "-" : "+"}
                      {log.qty_base}
                    </TableCell>
                    <TableCell>
                      {log.total_purchase_price && log.currency ? (
                        <span className="font-medium">
                          {log.currency} {parseFloat(log.total_purchase_price).toFixed(2)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {log.supplier_name || log.customer_name || "-"}
                    </TableCell>
                    <TableCell>{log.created_by_username || "-"}</TableCell>
                    <TableCell>{log.note || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingLog(log)
                          setShowEditDialog(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Movement Modal */}
      <MovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        mode={movementMode}
        onSuccess={handleMovementSuccess}
      />

      {/* Multi-Item Movement Modal */}
      <MultiItemMovementModal
        isOpen={isMultiItemModalOpen}
        onClose={() => setIsMultiItemModalOpen(false)}
        onSuccess={handleMovementSuccess}
      />

      {/* Clear All Logs Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alle Logs löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie alle Bewegungslogs unwiderruflich löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              disabled={isClearing}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllLogs}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Wird gelöscht...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Alle löschen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Movement Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bewegung bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Details dieser Warenbewegung. Artikel und Typ können nicht geändert werden.
            </DialogDescription>
          </DialogHeader>

          {editingLog && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded space-y-1 text-sm">
                <div><span className="font-medium">Artikel:</span> {editingLog.item_name}</div>
                <div><span className="font-medium">Typ:</span> {editingLog.type === "IN" ? "Wareneingang" : editingLog.type === "OUT" ? "Warenausgang" : "Retoure"}</div>
                <div><span className="font-medium">Erstellt am:</span> {new Date(editingLog.created_at).toLocaleString()}</div>
              </div>

              <div className="space-y-2">
                <Label>Einheit wählen</Label>
                <Select
                  value={editFormData.unit}
                  onValueChange={(value: "palette" | "verpackung") => setEditFormData({ ...editFormData, unit: value })}
                  disabled={isLoadingEditData}
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

              <div className="space-y-2">
                <Label htmlFor="edit-quantity">
                  {editFormData.unit === "palette" ? "Anzahl Paletten" : "Anzahl Verpackungen"}
                </Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  min="1"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                  placeholder="0"
                  disabled={isLoadingEditData}
                />
              </div>

              <div className="space-y-3 border-t pt-3">
                <Label>Einkaufspreis (optional)</Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Preistyp</Label>
                    <Select
                      value={editFormData.price_type}
                      onValueChange={(value: "palette" | "verpackung" | "none") => setEditFormData({ ...editFormData, price_type: value })}
                      disabled={isLoadingEditData}
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
                      value={editFormData.currency}
                      onValueChange={(value: "CHF" | "EUR") => setEditFormData({ ...editFormData, currency: value })}
                      disabled={isLoadingEditData || editFormData.price_type === "none"}
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

                {editFormData.price_type !== "none" && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-purchase-price">
                      {editFormData.price_type === "palette" 
                        ? `Preis pro Palette (${editFormData.currency})` 
                        : `Preis pro Verpackung (${editFormData.currency})`}
                    </Label>
                    <Input
                      id="edit-purchase-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.purchase_price}
                      onChange={(e) => setEditFormData({ ...editFormData, purchase_price: e.target.value })}
                      placeholder="0.00"
                      disabled={isLoadingEditData}
                    />
                  </div>
                )}
              </div>

              {editingLog.type === "IN" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-supplier">Lieferant</Label>
                  <Select
                    value={editFormData.supplier || "none"}
                    onValueChange={(value) => setEditFormData({ ...editFormData, supplier: value === "none" ? "" : value })}
                    disabled={isLoadingEditData}
                  >
                    <SelectTrigger id="edit-supplier">
                      <SelectValue placeholder="Lieferant auswählen (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Lieferant</SelectItem>
                      {suppliers.map((sup) => (
                        <SelectItem key={sup.id} value={String(sup.id)}>
                          {sup.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(editingLog.type === "OUT" || editingLog.type === "RETURN") && (
                <div className="space-y-2">
                  <Label htmlFor="edit-customer">Kunde</Label>
                  <Select
                    value={editFormData.customer || "none"}
                    onValueChange={(value) => setEditFormData({ ...editFormData, customer: value === "none" ? "" : value })}
                    disabled={isLoadingEditData}
                  >
                    <SelectTrigger id="edit-customer">
                      <SelectValue placeholder="Kunde auswählen (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Kunde</SelectItem>
                      {customers.map((cust) => (
                        <SelectItem key={cust.id} value={String(cust.id)}>
                          {cust.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-note">Notiz</Label>
                <Textarea
                  id="edit-note"
                  value={editFormData.note}
                  onChange={(e) => setEditFormData({ ...editFormData, note: e.target.value })}
                  placeholder="Optional: Zusätzliche Informationen"
                  rows={3}
                  disabled={isLoadingEditData}
                />
              </div>

              <div className="space-y-4 p-4 bg-muted rounded-md">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-use-current-datetime"
                    checked={editFormData.use_current_datetime}
                    onChange={(e) => setEditFormData({ ...editFormData, use_current_datetime: e.target.checked })}
                    disabled={isLoadingEditData}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="edit-use-current-datetime" className="cursor-pointer">
                    Aktuelles Datum & Uhrzeit automatisch verwenden
                  </Label>
                </div>

                {!editFormData.use_current_datetime && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="edit-movement-date">Datum</Label>
                      <Input
                        id="edit-movement-date"
                        type="date"
                        value={editFormData.movement_date}
                        onChange={(e) => setEditFormData({ ...editFormData, movement_date: e.target.value })}
                        disabled={isLoadingEditData}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-movement-time">Uhrzeit</Label>
                      <Input
                        id="edit-movement-time"
                        type="time"
                        value={editFormData.movement_time}
                        onChange={(e) => setEditFormData({ ...editFormData, movement_time: e.target.value })}
                        disabled={isLoadingEditData}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={handleDeleteMovement}
              disabled={isSavingEdit || isLoadingEditData}
              className="w-full sm:w-auto sm:mr-auto"
            >
              {isSavingEdit ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Löschen...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </>
              )}
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false)
                  setEditingLog(null)
                }}
                disabled={isSavingEdit || isLoadingEditData}
                className="flex-1 sm:flex-initial"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || isLoadingEditData}
                className="flex-1 sm:flex-initial"
              >
                {isSavingEdit ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Speichern...
                  </>
                ) : (
                  "Speichern"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
