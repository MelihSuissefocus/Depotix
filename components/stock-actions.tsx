'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUp, ArrowDown, RotateCcw, AlertTriangle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import UoMConverter from '@/components/uom-converter'
import { stockActionAPI, supplierAPI, customerAPI } from '@/lib/api'
import { useAction, useCRUD, useUoMConverter } from '@/lib/hooks'

interface StockActionModalProps {
  item: InventoryItem
  action: 'IN' | 'OUT' | 'RETURN' | 'DEFECT' | 'ADJUST'
  onSuccess?: () => void
  trigger?: React.ReactNode
}

const getActionConfig = (t: any) => ({
  IN: {
    title: t('stock.stock_in'),
    description: t('stock.stock_in'),
    icon: ArrowUp,
    color: 'text-green-600',
    requiresSupplier: true,
    requiresCustomer: false,
    buttonColor: 'bg-green-600 hover:bg-green-700',
  },
  OUT: {
    title: t('stock.stock_out'),
    description: t('stock.stock_out'),
    icon: ArrowDown,
    color: 'text-red-600',
    requiresSupplier: false,
    requiresCustomer: true,
    buttonColor: 'bg-red-600 hover:bg-red-700',
  },
  RETURN: {
    title: t('stock.stock_return'),
    description: t('stock.stock_return'),
    icon: RotateCcw,
    color: 'text-blue-600',
    requiresSupplier: false,
    requiresCustomer: true,
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
  },
  DEFECT: {
    title: t('stock.stock_defect'),
    description: t('stock.stock_defect'),
    icon: AlertTriangle,
    color: 'text-orange-600',
    requiresSupplier: false,
    requiresCustomer: false,
    buttonColor: 'bg-orange-600 hover:bg-orange-700',
  },
  ADJUST: {
    title: t('stock.stock_adjust'),
    description: t('stock.stock_adjust'),
    icon: Settings,
    color: 'text-purple-600',
    requiresSupplier: false,
    requiresCustomer: false,
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
  },
})

export default function StockActionModal({ item, action, onSuccess, trigger }: StockActionModalProps) {
  const t = useTranslations()
  const ACTION_CONFIG = getActionConfig(t)
  const [isOpen, setIsOpen] = useState(false)
  const [quantity, setQuantity] = useState<UoMConversion>({ pallets: 0, packages: 0, singles: 0, total_base: 0 })
  const [supplier, setSupplier] = useState<number | null>(null)
  const [customer, setCustomer] = useState<number | null>(null)
  const [note, setNote] = useState('')

  const { data: suppliers } = useCRUD(supplierAPI)
  const { data: customers } = useCRUD(customerAPI)
  const { convertToBase } = useUoMConverter(item)

  const config = ACTION_CONFIG[action]
  const ActionIcon = config.icon

  const { execute: executeStockAction, loading } = useAction((data: StockActionData) => {
    switch (action) {
      case 'IN': return stockActionAPI.stockIn(data)
      case 'OUT': return stockActionAPI.stockOut(data)
      case 'RETURN': return stockActionAPI.stockReturn(data)
      case 'DEFECT': return stockActionAPI.stockDefect(data)
      case 'ADJUST': return stockActionAPI.stockAdjust(data)
      default: throw new Error('Invalid action')
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (quantity.total_base <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    if (config.requiresSupplier && !supplier) {
      toast.error('Please select a supplier')
      return
    }

    if (config.requiresCustomer && !customer) {
      toast.error('Please select a customer')
      return
    }

    if (action === 'ADJUST' && !note.trim()) {
      toast.error('Please provide a reason for the adjustment')
      return
    }

    try {
      const actionData: StockActionData = {
        item: item.id!,
        qty_base: quantity.total_base,
        qty_pallets: quantity.pallets > 0 ? quantity.pallets : undefined,
        qty_packages: quantity.packages > 0 ? quantity.packages : undefined,
        qty_singles: quantity.singles > 0 ? quantity.singles : undefined,
        supplier: supplier,
        customer: customer,
        note: note.trim() || undefined,
      }

      await executeStockAction(actionData)
      setIsOpen(false)
      resetForm()
      onSuccess?.()
    } catch (error) {
      console.error('Stock action failed:', error)
    }
  }

  const resetForm = () => {
    setQuantity({ pallets: 0, packages: 0, singles: 0, total_base: 0 })
    setSupplier(null)
    setCustomer(null)
    setNote('')
  }

  const defaultTrigger = (
    <Button 
      variant="outline" 
      size="sm"
      className={`${config.color} border-current hover:bg-current hover:text-white`}
    >
      <ActionIcon className="mr-2 h-4 w-4" />
      {config.title}
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ActionIcon className={`h-5 w-5 ${config.color}`} />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description} for {item.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Current Stock</Label>
            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-medium">{item.quantity} {item.unit_base}</span>
              </div>
              {item.available_qty !== undefined && item.available_qty !== item.quantity && (
                <div className="flex justify-between">
                  <span>Available:</span>
                  <span className="font-medium">{item.available_qty} {item.unit_base}</span>
                </div>
              )}
              {item.defective_qty && item.defective_qty > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Defective:</span>
                  <span className="font-medium">{item.defective_qty} {item.unit_base}</span>
                </div>
              )}
            </div>
          </div>

          <UoMConverter
            item={item}
            value={quantity}
            onChange={setQuantity}
            label="Quantity"
          />

          {config.requiresSupplier && (
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={supplier?.toString() || ''} onValueChange={(value) => setSupplier(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {config.requiresCustomer && (
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select value={customer?.toString() || ''} onValueChange={(value) => setCustomer(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id!.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">
              {action === 'ADJUST' ? 'Reason for Adjustment *' : 'Note (Optional)'}
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                action === 'ADJUST' 
                  ? 'Please provide a reason for this adjustment...'
                  : 'Add a note about this transaction...'
              }
              rows={3}
              required={action === 'ADJUST'}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || quantity.total_base <= 0}
              className={config.buttonColor}
            >
              {loading ? 'Processing...' : `${config.title}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Stock Action Button Group Component
interface StockActionsProps {
  item: InventoryItem
  onSuccess?: () => void
  actions?: Array<'IN' | 'OUT' | 'RETURN' | 'DEFECT' | 'ADJUST'>
}

export function StockActions({ item, onSuccess, actions = ['IN', 'OUT', 'RETURN', 'DEFECT', 'ADJUST'] }: StockActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <StockActionModal 
          key={action}
          item={item} 
          action={action} 
          onSuccess={onSuccess}
        />
      ))}
    </div>
  )
}
