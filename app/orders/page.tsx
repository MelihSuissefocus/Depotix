'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Eye, Edit, Trash2, MoreHorizontal, ShoppingCart, Truck, FileText, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { orderAPI, customerAPI, inventoryAPI, orderWorkflowAPI } from '@/lib/api'
import { useCRUD, useAction } from '@/lib/hooks'
import { formatCHF, formatDate } from '@/lib/hooks'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

const ORDER_STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: Edit },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: Truck },
  INVOICED: { label: 'Invoiced', color: 'bg-purple-100 text-purple-800', icon: FileText },
}

export default function OrdersPage() {
  const { data: orders, loading, fetchList, create, update, remove } = useCRUD(orderAPI)
  const { data: customers } = useCRUD(customerAPI)
  const { data: items } = useCRUD(inventoryAPI)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null)
  const [viewingOrder, setViewingOrder] = useState<SalesOrder | null>(null)
  const [formData, setFormData] = useState<Partial<SalesOrder>>({
    customer: 0,
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    notes: '',
    status: 'DRAFT'
  })

  const { execute: confirmOrder, loading: confirmLoading } = useAction(orderWorkflowAPI.confirm)
  const { execute: deliverOrder, loading: deliverLoading } = useAction(orderWorkflowAPI.deliver)
  const { execute: invoiceOrder, loading: invoiceLoading } = useAction(orderWorkflowAPI.invoice)

  useEffect(() => {
    const params: any = {}
    if (searchTerm) params.search = searchTerm
    if (statusFilter) params.status = statusFilter
    fetchList(params)
  }, [fetchList, searchTerm, statusFilter])

  useEffect(() => {
    if (customers.length === 0) customerAPI.list()
    if (items.length === 0) inventoryAPI.list()
  }, [])

  const resetForm = () => {
    setFormData({
      customer: 0,
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: '',
      notes: '',
      status: 'DRAFT'
    })
    setEditingOrder(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingOrder) {
        await update(editingOrder.id!, formData)
      } else {
        await create(formData)
      }
      setIsCreateDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Failed to save order:', error)
    }
  }

  const handleEdit = (order: SalesOrder) => {
    setEditingOrder(order)
    setFormData(order)
    setIsCreateDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this order?')) {
      await remove(id)
    }
  }

  const handleWorkflowAction = async (orderId: number, action: 'confirm' | 'deliver' | 'invoice') => {
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
      fetchList() // Refresh the list
    } catch (error) {
      console.error(`Failed to ${action} order:`, error)
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

  const getWorkflowActions = (order: SalesOrder) => {
    const actions = []
    
    if (order.status === 'DRAFT') {
      actions.push(
        <DropdownMenuItem 
          key="confirm"
          onClick={() => handleWorkflowAction(order.id!, 'confirm')}
          disabled={confirmLoading}
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Confirm Order
        </DropdownMenuItem>
      )
    }
    
    if (order.status === 'CONFIRMED') {
      actions.push(
        <DropdownMenuItem 
          key="deliver"
          onClick={() => handleWorkflowAction(order.id!, 'deliver')}
          disabled={deliverLoading}
        >
          <Truck className="mr-2 h-4 w-4" />
          Mark as Delivered
        </DropdownMenuItem>
      )
    }
    
    if (order.status === 'DELIVERED') {
      actions.push(
        <DropdownMenuItem 
          key="invoice"
          onClick={() => handleWorkflowAction(order.id!, 'invoice')}
          disabled={invoiceLoading}
        >
          <FileText className="mr-2 h-4 w-4" />
          Generate Invoice
        </DropdownMenuItem>
      )
    }
    
    return actions
  }

  const filteredOrders = orders.filter(order => {
    const customer = customers.find(c => c.id === order.customer)
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalOrders = filteredOrders.length
  const totalValue = filteredOrders.reduce((sum, order) => sum + parseFloat(order.gross_amount || '0'), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>
          <p className="text-muted-foreground">Manage customer orders and workflow</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingOrder ? 'Edit Order' : 'Create New Order'}</DialogTitle>
              <DialogDescription>
                {editingOrder ? 'Update order information' : 'Start a new customer order'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select
                  value={formData.customer?.toString() || ''}
                  onValueChange={(value) => setFormData({ ...formData, customer: parseInt(value) })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id!.toString()}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order_date">Order Date *</Label>
                  <Input
                    id="order_date"
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    value={formData.delivery_date || ''}
                    onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingOrder ? 'Update Order' : 'Create Order'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCHF(totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredOrders.filter(o => o.status === 'DRAFT' || o.status === 'CONFIRMED').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredOrders.filter(o => o.status === 'DELIVERED' || o.status === 'INVOICED').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order List</CardTitle>
          <CardDescription>
            {filteredOrders.length} orders found
          </CardDescription>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                {Object.entries(ORDER_STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading orders...</p>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const customer = customers.find(c => c.id === order.customer)
                  const workflowActions = getWorkflowActions(order)
                  
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link href={`/orders/${order.id}`} className="hover:underline">
                          {order.order_number || `#${order.id}`}
                        </Link>
                      </TableCell>
                      <TableCell>{customer?.name || 'Unknown'}</TableCell>
                      <TableCell>{formatDate(order.order_date)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="font-medium">
                        {formatCHF(order.gross_amount || '0')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/orders/${order.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            {order.status === 'DRAFT' && (
                              <DropdownMenuItem onClick={() => handleEdit(order)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {workflowActions}
                            {order.status === 'DRAFT' && (
                              <>
                                <Separator />
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(order.id!)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
