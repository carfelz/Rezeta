import type { BadgeProps } from '@/components/ui'
import type { InvoiceStatus, InvoiceWithDetails } from '@rezeta/shared'

export function formatCurrency(amount: number, currency: string): string {
  const symbol = currency === 'USD' ? 'US$' : 'RD$'
  return `${symbol} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function statusVariant(status: InvoiceStatus): BadgeProps['variant'] {
  switch (status) {
    case 'paid':
      return 'paid'
    case 'issued':
      return 'active'
    case 'cancelled':
      return 'archived'
    default:
      return 'draft'
  }
}

export function statusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'draft':
      return 'Borrador'
    case 'issued':
      return 'Emitida'
    case 'paid':
      return 'Pagada'
    case 'cancelled':
      return 'Cancelada'
  }
}

export interface ItemRow {
  description: string
  quantity: number
  unitPrice: number
}

export function calcTotal(item: ItemRow): number {
  return Number((item.quantity * item.unitPrice).toFixed(2))
}

export function defaultItem(): ItemRow {
  return { description: '', quantity: 1, unitPrice: 0 }
}

export const STATUS_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'issued', label: 'Emitidas' },
  { value: 'paid', label: 'Pagadas' },
  { value: 'cancelled', label: 'Canceladas' },
]

export type ActiveModal =
  | { type: 'create' }
  | { type: 'edit'; invoice: InvoiceWithDetails }
  | { type: 'delete'; invoice: InvoiceWithDetails }
  | null
