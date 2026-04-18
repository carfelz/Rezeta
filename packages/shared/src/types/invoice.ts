export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'
export type Currency = 'DOP' | 'USD'

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Invoice {
  id: string
  tenantId: string
  patientId: string
  doctorUserId: string
  locationId: string
  consultationId: string | null
  status: InvoiceStatus
  currency: Currency
  items: InvoiceItem[]
  subtotal: number
  commissionAmount: number
  commissionPercent: number
  total: number
  issuedAt: string | null
  paidAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
