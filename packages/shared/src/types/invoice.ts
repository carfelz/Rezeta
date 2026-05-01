export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'
export type Currency = 'DOP' | 'USD'

export interface InvoiceItem {
  id: string
  invoiceId: string
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
  invoiceNumber: string
  status: InvoiceStatus
  currency: Currency
  subtotal: number
  tax: number
  commissionAmount: number
  commissionPercent: number
  netToDoctor: number
  total: number
  paymentMethod: string | null
  issuedAt: string | null
  paidAt: string | null
  dueDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  items: InvoiceItem[]
}

export interface InvoiceWithDetails extends Invoice {
  patientName: string
  locationName: string
}
