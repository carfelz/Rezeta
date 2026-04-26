export interface Location {
  id: string
  tenantId: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  isOwned: boolean
  notes: string | null
  commissionPercent: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
