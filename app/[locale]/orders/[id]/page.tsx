'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Edit, Trash2, CheckCircle, Truck, FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { orderAPI, orderItemAPI, inventoryAPI, customerAPI, orderWorkflowAPI, invoiceAPI, pdfAPI } from '@/lib/api'
import { useDetail, useCRUD, useAction, useUoMConverter } from '@/lib/hooks'
import { formatCHF, formatDate } from '@/lib/hooks'
import UoMConverter from '@/components/uom-converter'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

const ORDER_STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: Edit },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: Truck },
  INVOICED: { label: 'Invoiced', color: 'bg-purple-100 text-purple-800', icon: FileText },
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = parseInt(params.id as string)
  
  const { data: order, loading: orderLoading, refetch: refetchOrder } = useDetail(orderAPI, orderId)
  const { data: orderItems, loading: itemsLoading, fetchList: fetchOrderItems, create: createOrderItem, update: updateOrderItem, remove: removeOrderItem } = useCRUD(orderItemAPI)
  const { data: items } = useCRUD(inventoryAPI)
  const { data: customers } = useCRUD(customerAPI)
  const { data: invoices } = useCRUD(invoiceAPI)
  
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SalesOrderItem | null>(null)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null)
  const [quantity, setQuantity] = useState<UoMConversion>({ pallets: 0, packages: 0, singles: 0, total_base: 0 })
  const [unitPrice, setUnitPrice] = useState('')
  const [taxRate, setTaxRate] = useState(7.7)

  const { convertToBase } = useUoMConverter(selectedInventoryItem)
  
  const { execute: confirmOrder, loading: confirmLoading } = useAction(orderWorkflowAPI.confirm)
  const { execute: deliverOrder, loading: deliverLoading } = useAction(orderWorkflowAPI.deliver)
  const { execute: invoiceOrder, loading: invoiceLoading } = useAction(orderWorkflowAPI.invoice)

  useEffect(() => {
    if (orderId) {
      fetchOrderItems({ order: orderId })
    }
  }, [orderId, fetchOrderItems])

  useEffect(() => {
    if (items.length === 0) inventoryAPI.list()
    if (customers.length === 0) customerAPI.list()
    if (order?.status === 'INVOICED') {
      invoiceAPI.list({ order: orderId })
    }
  }, [order?.status])

  const customer = customers.find(c => c.id === order?.customer)
  const orderInvoice = invoices.find(i => i.order === orderId)

  const resetItemForm = () => {
    setSelectedInventoryItem(null)
    setQuantity({ pallets: 0, packages: 0, singles: 0, total_base: 0 })
    setUnitPrice('')
    setTaxRate(7.7)
    setEditingItem(null)
  }

  const handleAddItem = async () => {
    if (!selectedInventoryItem || quantity.total_base <= 0) {
      toast.error('Please select an item and enter a valid quantity')
      return
    }

    if (!unitPrice) {
      toast.error('Please enter a unit price')
      return
    }

    try {
      const itemData = {
        order: orderId,
        item: selectedInventoryItem.id!,
        quantity: quantity.total_base,
        unit_price: unitPrice,
        tax_rate: taxRate,
      }

      if (editingItem) {
        await updateOrderItem(editingItem.id!, itemData)
      } else {
        await createOrderItem(itemData)
      }

      setIsAddItemDialogOpen(false)
      resetItemForm()
      refetchOrder() // Refresh order to get updated totals
    } catch (error) {
      console.error('Failed to save order item:', error)
    }
  }

  const handleEditItem = (item: SalesOrderItem) => {
    setEditingItem(item)
    const inventoryItem = items.find(i => i.id === item.item)
    setSelectedInventoryItem(inventoryItem || null)
    setQuantity({ pallets: 0, packages: 0, singles: item.quantity, total_base: item.quantity })
    setUnitPrice(item.unit_price)
    setTaxRate(item.tax_rate || 7.7)
    setIsAddItemDialogOpen(true)
  }

  const handleDeleteItem = async (itemId: number) => {
    if (confirm('Are you sure you want to remove this item from the order?')) {
      await removeOrderItem(itemId)
      refetchOrder()
    }
  }

  const handleWorkflowAction = async (action: 'confirm' | 'deliver' | 'invoice') => {
    try {
      switch (action) {
        case 'confirm':
          await confirmOrder(orderId)
          break
        case 'deliver':
          await deliverOrder(orderId)
          break
        case 'invoice':
          await invoiceOrder(orderId)
          break
      }
      refetchOrder()
    } catch (error) {
      console.error(`Failed to ${action} order:`, error)
    }
  }

  const handleDownloadInvoicePDF = async () => {
    if (!orderInvoice) return
    
    try {
      await pdfAPI.downloadInvoicePDF(orderInvoice.id!)
      toast.success('Invoice PDF downloaded successfully')
    } catch (error) {
      console.error('Failed to download invoice PDF:', error)
      toast.error('Failed to download invoice PDF')
    }
  }

  const handleDownloadDeliveryNotePDF = async () => {
    try {
      await pdfAPI.downloadDeliveryNotePDF(orderId)
      toast.success('Delivery note PDF downloaded successfully')
    } catch (error) {
      console.error('Failed to download delivery note PDF:', error)
      toast.error('Failed to download delivery note PDF')
    }
  }

  const getStatusBadge = (status: string) => {
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG]
    const StatusIcon = config.icon
    return (
      <Badge className={config.color}>
        <StatusIcon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const canEditOrder = order?.status === 'DRAFT'
  const canConfirm = order?.status === 'DRAFT' && orderItems.length > 0
  const canDeliver = order?.status === 'CONFIRMED'
  const canInvoice = order?.status === 'DELIVERED'

  if (orderLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading order...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Order not found</p>
        <Button asChild className="mt-4">
          <Link href="/orders">Back to Orders</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Order {order.order_number || `#${order.id}`}
            </h1>
            <p className="text-muted-foreground">
              {customer?.name} • {formatDate(order.order_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(order.status)}
          {(order.status === 'DELIVERED' || order.status === 'INVOICED') && (
            <Button variant="outline" onClick={handleDownloadDeliveryNotePDF}>
              <Download className="mr-2 h-4 w-4" />
              Lieferschein PDF
            </Button>
          )}
          {order.status === 'INVOICED' && orderInvoice && (
            <Button variant="outline" onClick={handleDownloadInvoicePDF}>
              <Download className="mr-2 h-4 w-4" />
              Rechnung PDF
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Order Items</CardTitle>
            {canEditOrder && (
              <Button onClick={() => setIsAddItemDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="text-center py-4">Loading items...</div>
            ) : orderItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No items in this order
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    {canEditOrder && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCHF(item.unit_price)}</TableCell>
                      <TableCell>{formatCHF(item.gross_amount || '0')}</TableCell>
                      {canEditOrder && (
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Net Amount:</span>
                <span>{formatCHF(order.net_amount || '0')}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>{formatCHF(order.tax_amount || '0')}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>{formatCHF(order.gross_amount || '0')}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canConfirm && (
                <Button 
                  className="w-full" 
                  onClick={() => handleWorkflowAction('confirm')}
                  disabled={confirmLoading}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Order
                </Button>
              )}
              {canDeliver && (
                <Button 
                  className="w-full" 
                  onClick={() => handleWorkflowAction('deliver')}
                  disabled={deliverLoading}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  Mark as Delivered
                </Button>
              )}
              {canInvoice && (
                <Button 
                  className="w-full" 
                  onClick={() => handleWorkflowAction('invoice')}
                  disabled={invoiceLoading}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Invoice
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Order Item' : 'Add Order Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item *</Label>
              <Select
                value={selectedInventoryItem?.id?.toString() || ''}
                onValueChange={(value) => {
                  const item = items.find(i => i.id === parseInt(value))
                  setSelectedInventoryItem(item || null)
                  if (item && !unitPrice) {
                    setUnitPrice(item.price)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id!.toString()}>
                      {item.name} - {formatCHF(item.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedInventoryItem && (
              <UoMConverter
                item={selectedInventoryItem}
                value={quantity}
                onChange={setQuantity}
                label="Quantity"
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit Price (CHF) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {quantity.total_base > 0 && unitPrice && (
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span>{quantity.total_base} {selectedInventoryItem?.unit_base}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unit Price:</span>
                    <span>{formatCHF(unitPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Total:</span>
                    <span>{formatCHF((quantity.total_base * parseFloat(unitPrice || '0')).toString())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax ({taxRate}%):</span>
                    <span>{formatCHF(((quantity.total_base * parseFloat(unitPrice || '0')) * taxRate / 100).toString())}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Gross Total:</span>
                    <span>{formatCHF(((quantity.total_base * parseFloat(unitPrice || '0')) * (1 + taxRate / 100)).toString())}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem}>
              {editingItem ? 'Update Item' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
