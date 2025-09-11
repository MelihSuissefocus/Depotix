'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUp, ArrowDown, RotateCcw, Settings, Package, Receipt, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { inventoryAPI, stockMovementAPI, expenseAPI, orderAPI } from '@/lib/api'
import { useCRUD } from '@/lib/hooks'
import { formatCHF, formatDate, formatDateTime } from '@/lib/hooks'

const MOVEMENT_ICONS = {
  IN: ArrowUp,
  OUT: ArrowDown,
  RETURN: RotateCcw,
  DEFECT: AlertTriangle,
  ADJUST: Settings,
}

const MOVEMENT_COLORS = {
  IN: 'text-green-600',
  OUT: 'text-red-600',
  RETURN: 'text-blue-600',
  DEFECT: 'text-orange-600',
  ADJUST: 'text-purple-600',
}

export function LowStockWidget() {
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const response = await inventoryAPI.lowStock()
        setLowStockItems(response.results || [])
      } catch (error) {
        console.error('Failed to fetch low stock items:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLowStock()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Low Stock Alerts
        </CardTitle>
        <CardDescription>
          {lowStockItems.length} items below minimum stock level
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lowStockItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">All items are well stocked</p>
        ) : (
          <div className="space-y-3">
            {lowStockItems.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <Link 
                    href={`/inventory/${item.id}`}
                    className="font-medium hover:underline"
                  >
                    {item.name}
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    Current: {item.available_qty || item.quantity} / Min: {item.min_stock_level}
                  </div>
                </div>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  Low
                </Badge>
              </div>
            ))}
            {lowStockItems.length > 5 && (
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/inventory?low_stock=true">
                  View All ({lowStockItems.length})
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function StockMovementTimelineWidget() {
  const { data: movements, loading } = useCRUD(stockMovementAPI)
  const recentMovements = movements.slice(0, 8)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Stock Movements</CardTitle>
        <CardDescription>
          Latest inventory transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentMovements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent movements</p>
        ) : (
          <div className="space-y-3">
            {recentMovements.map((movement) => {
              const Icon = MOVEMENT_ICONS[movement.type as keyof typeof MOVEMENT_ICONS]
              const colorClass = MOVEMENT_COLORS[movement.type as keyof typeof MOVEMENT_COLORS]
              
              return (
                <div key={movement.id} className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full bg-muted ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{movement.item_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {movement.type === 'OUT' || movement.type === 'DEFECT' ? '-' : '+'}
                      {movement.qty_base} {movement.qty_units || 'units'}
                      {' • '}
                      {formatDateTime(movement.created_at!)}
                    </div>
                  </div>
                </div>
              )
            })}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/stock-movements">
                View All Movements
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function KPIDashboard() {
  const { data: items } = useCRUD(inventoryAPI)
  const { data: movements } = useCRUD(stockMovementAPI)
  const { data: expenses } = useCRUD(expenseAPI)
  const { data: orders } = useCRUD(orderAPI)

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  // Calculate KPIs
  const totalItems = items.length
  const lowStockCount = items.filter(item => 
    (item.available_qty !== undefined ? item.available_qty : item.quantity) <= (item.min_stock_level || 0)
  ).length

  const thisMonthMovements = movements.filter(movement => {
    const date = new Date(movement.created_at!)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })

  const stockIn = thisMonthMovements
    .filter(m => m.type === 'IN')
    .reduce((sum, m) => sum + m.qty_base, 0)

  const stockOut = thisMonthMovements
    .filter(m => m.type === 'OUT')
    .reduce((sum, m) => sum + m.qty_base, 0)

  const thisMonthExpenses = expenses
    .filter(expense => {
      const date = new Date(expense.date)
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
    })
    .reduce((sum, expense) => sum + parseFloat(expense.amount), 0)

  const thisMonthOrders = orders.filter(order => {
    const date = new Date(order.order_date)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  }).length

  const thisMonthRevenue = orders
    .filter(order => {
      const date = new Date(order.order_date)
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear && order.status === 'INVOICED'
    })
    .reduce((sum, order) => sum + parseFloat(order.gross_amount || '0'), 0)

  const kpis = [
    {
      title: 'Total Items',
      value: totalItems.toString(),
      icon: Package,
      color: 'text-blue-600',
    },
    {
      title: 'Low Stock Items',
      value: lowStockCount.toString(),
      icon: AlertTriangle,
      color: lowStockCount > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      title: 'Stock In (Month)',
      value: stockIn.toString(),
      icon: ArrowUp,
      color: 'text-green-600',
    },
    {
      title: 'Stock Out (Month)',
      value: stockOut.toString(),
      icon: ArrowDown,
      color: 'text-red-600',
    },
    {
      title: 'Monthly Expenses',
      value: formatCHF(thisMonthExpenses),
      icon: Receipt,
      color: 'text-red-600',
    },
    {
      title: 'Monthly Orders',
      value: thisMonthOrders.toString(),
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Monthly Revenue',
      value: formatCHF(thisMonthRevenue),
      icon: TrendingUp,
      color: 'text-green-600',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function RecentOrdersWidget() {
  const { data: orders, loading } = useCRUD(orderAPI)
  const recentOrders = orders.slice(0, 5)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800'
      case 'DELIVERED': return 'bg-green-100 text-green-800'
      case 'INVOICED': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardDescription>
          Latest customer orders
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent orders</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <Link 
                    href={`/orders/${order.id}`}
                    className="font-medium hover:underline"
                  >
                    {order.order_number || `#${order.id}`}
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    {order.customer_name} • {formatDate(order.order_date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCHF(order.gross_amount || '0')}</div>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/orders">
                View All Orders
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
