'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, Download, ArrowUp, ArrowDown, RotateCcw, AlertTriangle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { stockMovementAPI } from '@/lib/api'
import { useCRUD, useUoMConverter } from '@/lib/hooks'
import { formatDate, formatDateTime } from '@/lib/hooks'
import { format } from 'date-fns'

const MOVEMENT_TYPES = [
  { value: 'IN', label: 'Stock In', icon: ArrowUp, color: 'text-green-600' },
  { value: 'OUT', label: 'Stock Out', icon: ArrowDown, color: 'text-red-600' },
  { value: 'RETURN', label: 'Return', icon: RotateCcw, color: 'text-blue-600' },
  { value: 'DEFECT', label: 'Defect', icon: AlertTriangle, color: 'text-orange-600' },
  { value: 'ADJUST', label: 'Adjustment', icon: Settings, color: 'text-purple-600' },
]

export default function StockMovementsPage() {
  const { data: movements, loading, fetchList } = useCRUD(stockMovementAPI)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<string>('')

  useEffect(() => {
    const params: any = {}
    if (searchTerm) params.item_name = searchTerm
    if (typeFilter) params.type = typeFilter
    if (dateFilter) params.date_from = dateFilter
    
    fetchList(params)
  }, [fetchList, searchTerm, typeFilter, dateFilter])

  const getMovementTypeInfo = (type: string) => {
    return MOVEMENT_TYPES.find(t => t.value === type) || MOVEMENT_TYPES[0]
  }

  const getMovementBadgeVariant = (type: string) => {
    switch (type) {
      case 'IN': return 'default'
      case 'OUT': return 'destructive'
      case 'RETURN': return 'secondary'
      case 'DEFECT': return 'outline'
      case 'ADJUST': return 'secondary'
      default: return 'secondary'
    }
  }

  const filteredMovements = movements.filter(movement => {
    const matchesSearch = movement.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Item', 'Quantity', 'Units', 'Supplier/Customer', 'User', 'Note']
    const rows = filteredMovements.map(movement => [
      formatDateTime(movement.created_at!),
      getMovementTypeInfo(movement.type).label,
      movement.item_name || '',
      movement.qty_base.toString(),
      movement.qty_units || '',
      movement.supplier_name || movement.customer_name || '',
      movement.created_by_username || '',
      movement.note || ''
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `stock-movements-${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculate summary stats
  const totalIn = filteredMovements
    .filter(m => m.type === 'IN')
    .reduce((sum, m) => sum + m.qty_base, 0)
  
  const totalOut = filteredMovements
    .filter(m => m.type === 'OUT')
    .reduce((sum, m) => sum + m.qty_base, 0)

  const totalDefective = filteredMovements
    .filter(m => m.type === 'DEFECT')
    .reduce((sum, m) => sum + m.qty_base, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Movements</h1>
          <p className="text-muted-foreground">View inventory movement history and transactions</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Movements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredMovements.length}</div>
            <p className="text-xs text-muted-foreground">
              All time transactions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock In</CardTitle>
            <ArrowUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{totalIn}</div>
            <p className="text-xs text-muted-foreground">
              Units added
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Out</CardTitle>
            <ArrowDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{totalOut}</div>
            <p className="text-xs text-muted-foreground">
              Units removed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Defective</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalDefective}</div>
            <p className="text-xs text-muted-foreground">
              Units marked defective
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
          <CardDescription>
            {filteredMovements.length} movements found
          </CardDescription>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search movements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                {MOVEMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-48"
              placeholder="Filter by date"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading movements...</p>
              </div>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No stock movements found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Supplier/Customer</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((movement) => {
                  const typeInfo = getMovementTypeInfo(movement.type)
                  const TypeIcon = typeInfo.icon
                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="text-sm">
                        {formatDateTime(movement.created_at!)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getMovementBadgeVariant(movement.type)} className="flex items-center gap-1 w-fit">
                          <TypeIcon className={`h-3 w-3 ${typeInfo.color}`} />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {movement.item_name}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {movement.type === 'OUT' || movement.type === 'DEFECT' ? '-' : '+'}
                            {movement.qty_base}
                          </div>
                          {movement.qty_units && (
                            <div className="text-xs text-muted-foreground">
                              {movement.qty_units}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {movement.supplier_name || movement.customer_name || '-'}
                      </TableCell>
                      <TableCell>
                        {movement.created_by_username || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {movement.note || '-'}
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
