'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'

// Generic hook for CRUD operations
export function useCRUD<T>(api: {
  list: (params?: any) => Promise<APIListResponse<T>>
  get: (id: number) => Promise<T>
  create: (data: Partial<T>) => Promise<T>
  update: (id: number, data: Partial<T>) => Promise<T>
  delete: (id: number) => Promise<void>
}) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null })

  const fetchList = useCallback(async (params?: any) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.list(params)
      setData(response.results)
      setPagination({
        count: response.count,
        next: response.next,
        previous: response.previous
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [api])

  const create = useCallback(async (item: Partial<T>) => {
    try {
      const newItem = await api.create(item)
      setData(prev => [newItem, ...prev])
      toast.success('Created successfully')
      return newItem
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Create failed'
      toast.error(message)
      throw err
    }
  }, [api])

  const update = useCallback(async (id: number, item: Partial<T>) => {
    try {
      const updatedItem = await api.update(id, item)
      setData(prev => prev.map(d => ((d as any).id === id ? updatedItem : d)))
      toast.success('Updated successfully')
      return updatedItem
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed'
      toast.error(message)
      throw err
    }
  }, [api])

  const remove = useCallback(async (id: number) => {
    try {
      await api.delete(id)
      setData(prev => prev.filter(d => (d as any).id !== id))
      toast.success('Deleted successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      toast.error(message)
      throw err
    }
  }, [api])

  return {
    data,
    loading,
    error,
    pagination,
    fetchList,
    create,
    update,
    remove,
    refetch: fetchList
  }
}

// Hook for single item details
export function useDetail<T>(api: { get: (id: number) => Promise<T> }, id: number | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const item = await api.get(id)
      setData(item)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast.error('Failed to fetch details')
    } finally {
      setLoading(false)
    }
  }, [api, id])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  return { data, loading, error, refetch: fetchDetail }
}

// Hook for actions (POST operations)
export function useAction<T = any>(actionFn: (data: any) => Promise<T>) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (data: any) => {
    setLoading(true)
    setError(null)
    try {
      const result = await actionFn(data)
      toast.success('Action completed successfully')
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [actionFn])

  return { execute, loading, error }
}

// UoM Conversion Utilities
export function useUoMConverter(item: InventoryItem | null) {
  const convertToBase = useCallback((conversion: Partial<UoMConversion>): number => {
    if (!item) return 0
    
    const { pallets = 0, packages = 0, singles = 0 } = conversion
    const packageFactor = item.unit_package_factor || 1
    const palletFactor = item.unit_pallet_factor || 1
    
    return (pallets * palletFactor * packageFactor) + (packages * packageFactor) + singles
  }, [item])

  const convertFromBase = useCallback((baseQty: number): UoMConversion => {
    if (!item) return { pallets: 0, packages: 0, singles: 0, total_base: 0 }
    
    const packageFactor = item.unit_package_factor || 1
    const palletFactor = item.unit_pallet_factor || 1
    const unitsPerPallet = palletFactor * packageFactor
    
    const pallets = Math.floor(baseQty / unitsPerPallet)
    const remainingAfterPallets = baseQty % unitsPerPallet
    const packages = Math.floor(remainingAfterPallets / packageFactor)
    const singles = remainingAfterPallets % packageFactor
    
    return { pallets, packages, singles, total_base: baseQty }
  }, [item])

  const formatQuantity = useCallback((baseQty: number): string => {
    if (!item) return `${baseQty} ${item?.unit_base || 'units'}`
    
    const conversion = convertFromBase(baseQty)
    const parts: string[] = []
    
    if (conversion.pallets > 0) parts.push(`${conversion.pallets} pallets`)
    if (conversion.packages > 0) parts.push(`${conversion.packages} packages`)
    if (conversion.singles > 0) parts.push(`${conversion.singles} ${item.unit_base || 'units'}`)
    
    return parts.length > 0 ? parts.join(' + ') : `0 ${item.unit_base || 'units'}`
  }, [item, convertFromBase])

  return { convertToBase, convertFromBase, formatQuantity }
}

// Currency formatting for CHF
export function formatCHF(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(num)
}

// Date formatting
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('de-CH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('de-CH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}
