'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUoMConverter } from '@/lib/hooks'
import { Badge } from '@/components/ui/badge'

interface UoMConverterProps {
  item: InventoryItem | null
  value?: UoMConversion
  onChange?: (conversion: UoMConversion) => void
  label?: string
  disabled?: boolean
  showTotal?: boolean
}

export default function UoMConverter({ 
  item, 
  value, 
  onChange, 
  label,
  disabled = false,
  showTotal = true 
}: UoMConverterProps) {
  const t = useTranslations()
  const { convertToBase, convertFromBase, formatQuantity } = useUoMConverter(item)
  const [localValue, setLocalValue] = useState<UoMConversion>({
    pallets: 0,
    packages: 0,
    singles: 0,
    total_base: 0
  })

  useEffect(() => {
    if (value) {
      setLocalValue(value)
    }
  }, [value])

  const handleChange = (field: keyof UoMConversion, val: number) => {
    if (disabled) return
    
    const updated = { ...localValue, [field]: val }
    const totalBase = convertToBase(updated)
    updated.total_base = totalBase
    
    setLocalValue(updated)
    onChange?.(updated)
  }

  if (!item) {
    return (
      <div className="space-y-2">
        <Label>{label || t('common.quantity')}</Label>
        <Input
          type="number"
          placeholder={t('stock.uom_converter')}
          value={localValue.singles}
          onChange={(e) => handleChange('singles', parseInt(e.target.value) || 0)}
          disabled={disabled}
        />
      </div>
    )
  }

  const packageFactor = item.unit_package_factor || 1
  const palletFactor = item.unit_pallet_factor || 1
  const hasPackaging = packageFactor > 1 || palletFactor > 1

  if (!hasPackaging) {
    return (
      <div className="space-y-2">
        <Label>{label || t('common.quantity')}</Label>
        <Input
          type="number"
          placeholder={t('stock.uom_converter')}
          value={localValue.singles}
          onChange={(e) => handleChange('singles', parseInt(e.target.value) || 0)}
          disabled={disabled}
        />
        {showTotal && localValue.total_base > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('stock.total_base_units')}: {localValue.total_base} {item.unit_base || t('items.units.PIECE')}
          </p>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label || t('common.quantity')}</CardTitle>
        {showTotal && localValue.total_base > 0 && (
          <Badge variant="outline" className="w-fit">
{t('common.total')}: {formatQuantity(localValue.total_base)}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {palletFactor > 1 && (
          <div className="space-y-2">
            <Label>{t('stock.pallet')}</Label>
            <Input
              type="number"
              placeholder="0"
              value={localValue.pallets || ''}
              onChange={(e) => handleChange('pallets', parseInt(e.target.value) || 0)}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
1 {t('stock.pallet')} = {palletFactor * packageFactor} {item.unit_base}
            </p>
          </div>
        )}
        
        {packageFactor > 1 && (
          <div className="space-y-2">
            <Label>{t('stock.package')}</Label>
            <Input
              type="number"
              placeholder="0"
              value={localValue.packages || ''}
              onChange={(e) => handleChange('packages', parseInt(e.target.value) || 0)}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
1 {t('stock.package')} = {packageFactor} {item.unit_base}
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          <Label>{item.unit_base || t('stock.singles')}</Label>
          <Input
            type="number"
            placeholder="0"
            value={localValue.singles || ''}
            onChange={(e) => handleChange('singles', parseInt(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>
        
        {showTotal && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium">
              Total Base Units: {localValue.total_base} {item.unit_base}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
