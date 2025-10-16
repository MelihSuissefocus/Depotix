"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, ArrowDown, ArrowUp, Box, Search, TrendingUp, TrendingDown, RotateCcw, Trash2 } from "lucide-react"
import { stockMovementAPI } from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/date-range-picker"
import { MovementModal } from "@/components/movement-modal"
import { MultiItemMovementModal } from "@/components/multi-item-movement-modal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "react-hot-toast"
import type { DateRange } from "react-day-picker"

export default function LogsPage() {
  const [logs, setLogs] = useState<StockMovement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [isMultiItemModalOpen, setIsMultiItemModalOpen] = useState(false)
  const [movementMode, setMovementMode] = useState<"IN" | "OUT" | "RETURN">("IN")
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

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

  const openWareneingangModal = () => {
    setMovementMode("IN")
    setIsMovementModalOpen(true)
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
          <Button onClick={() => setIsMultiItemModalOpen(true)} className="bg-green-700 hover:bg-green-800">
            <Box className="h-4 w-4 mr-2" />
            + Multi-Wareneingang
          </Button>
          <Button onClick={openWareneingangModal} className="bg-green-600 hover:bg-green-700" variant="outline">
            <TrendingUp className="h-4 w-4 mr-2" />
            + Wareneingang (Einzeln)
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
                <TableHead>Supplier/Customer</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Notes</TableHead>
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
                      {log.supplier_name || log.customer_name || "-"}
                    </TableCell>
                    <TableCell>{log.created_by_username || "-"}</TableCell>
                    <TableCell>{log.note || "-"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
    </div>
  )
}
