/**
 * Centralized inventory utility functions.
 *
 * CRITICAL: These functions MUST match the backend logic exactly.
 * Any changes here must be synchronized with api/inventory/utils.py
 */

export interface PPUInput {
  qty_pallets: number
  qty_packages: number
  qty_singles: number
}

export interface UnitFactors {
  unit_pallet_factor: number
  unit_package_factor: number
}

export interface ValidationError {
  field: string
  message: string
}

/**
 * Calculate base quantity from Pallet/Package/Unit inputs.
 *
 * Formula: pallets × pallet_factor × package_factor
 *          + packages × package_factor
 *          + singles
 *
 * This MUST match api/inventory/utils.py::calculate_qty_base()
 *
 * @throws Error if validation fails
 */
export function calculateQtyBase(
  input: PPUInput,
  factors: UnitFactors
): number {
  const { qty_pallets, qty_packages, qty_singles } = input
  const { unit_pallet_factor, unit_package_factor } = factors

  // Validate factors
  if (unit_pallet_factor < 1 || unit_package_factor < 1) {
    throw new Error(
      `Einheitenfaktoren müssen >= 1 sein. ` +
      `Palette-Faktor: ${unit_pallet_factor}, Paket-Faktor: ${unit_package_factor}`
    )
  }

  // Validate quantities (must be non-negative)
  if (qty_pallets < 0 || qty_packages < 0 || qty_singles < 0) {
    throw new Error(
      `Mengen können nicht negativ sein. ` +
      `Paletten: ${qty_pallets}, Pakete: ${qty_packages}, Einzeln: ${qty_singles}`
    )
  }

  // Calculate base quantity
  const base_qty =
    qty_pallets * unit_pallet_factor * unit_package_factor +
    qty_packages * unit_package_factor +
    qty_singles

  // Must be positive
  if (base_qty <= 0) {
    throw new Error(`Gesamtmenge muss > 0 sein. Berechnet: ${base_qty}`)
  }

  return base_qty
}

/**
 * Validate PPU input fields before submission.
 * Returns array of validation errors (empty if valid).
 */
export function validatePPUInput(
  input: PPUInput,
  factors: UnitFactors
): ValidationError[] {
  const errors: ValidationError[] = []
  const { qty_pallets, qty_packages, qty_singles } = input
  const { unit_pallet_factor, unit_package_factor } = factors

  // Check for invalid numbers (NaN, negative)
  if (isNaN(qty_pallets) || qty_pallets < 0) {
    errors.push({
      field: 'qty_pallets',
      message: 'Paletten müssen eine positive Zahl sein'
    })
  }

  if (isNaN(qty_packages) || qty_packages < 0) {
    errors.push({
      field: 'qty_packages',
      message: 'Pakete müssen eine positive Zahl sein'
    })
  }

  if (isNaN(qty_singles) || qty_singles < 0) {
    errors.push({
      field: 'qty_singles',
      message: 'Einzelne müssen eine positive Zahl sein'
    })
  }

  // Check if at least one quantity is provided
  if (qty_pallets === 0 && qty_packages === 0 && qty_singles === 0) {
    errors.push({
      field: 'qty_base',
      message: 'Mindestens eine Menge muss größer als 0 sein'
    })
  }

  // Validate unit factors
  if (unit_pallet_factor < 1) {
    errors.push({
      field: 'item',
      message: 'Artikel hat ungültigen Paletten-Faktor'
    })
  }

  if (unit_package_factor < 1) {
    errors.push({
      field: 'item',
      message: 'Artikel hat ungültigen Paket-Faktor'
    })
  }

  return errors
}

/**
 * Parse string input to number, handling edge cases.
 * Returns 0 for empty/invalid input.
 */
export function parseQuantity(value: string): number {
  if (!value || value.trim() === '') return 0

  const parsed = parseInt(value, 10)

  // Return 0 for NaN or negative
  if (isNaN(parsed) || parsed < 0) return 0

  return parsed
}

/**
 * Format quantity for display with thousands separators.
 * Example: 1234 → "1'234"
 */
export function formatQuantity(qty: number): string {
  return qty.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}

/**
 * Validate movement type constraints.
 */
export function validateMovementType(
  type: string,
  qty_base: number,
  availableQty: number
): ValidationError | null {
  // OUT and DEFECT require sufficient stock
  if (type === 'OUT' || type === 'DEFECT') {
    if (qty_base > availableQty) {
      return {
        field: 'qty_base',
        message: `Nicht genügend Lagerbestand. Verfügbar: ${formatQuantity(availableQty)}, Angefordert: ${formatQuantity(qty_base)}`
      }
    }
  }

  return null
}

/**
 * Generate idempotency key for movement submission.
 * Uses crypto.randomUUID() if available, otherwise fallback.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Parse API error response into user-friendly message.
 */
export function parseAPIError(error: any): string {
  // Handle structured error responses
  if (error?.error?.code) {
    switch (error.error.code) {
      case 'INSUFFICIENT_STOCK':
        return error.error.message || 'Nicht genügend Lagerbestand'

      case 'PPU_CONVERSION_ERROR':
        return 'Fehler bei der Mengenberechnung. Bitte versuchen Sie es erneut.'

      case 'VALIDATION_ERROR':
        if (error.error.fields) {
          const fieldErrors = Object.entries(error.error.fields)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join(', ')
          return `Validierungsfehler: ${fieldErrors}`
        }
        return error.error.message || 'Validierungsfehler'

      default:
        return error.error.message || 'Ein Fehler ist aufgetreten'
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error
  }

  // Handle network errors
  if (error?.message) {
    if (error.message.includes('fetch')) {
      return 'Netzwerkfehler. Bitte prüfen Sie Ihre Internetverbindung.'
    }
    return error.message
  }

  return 'Ein unbekannter Fehler ist aufgetreten'
}
