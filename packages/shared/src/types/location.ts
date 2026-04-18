export interface Location {
  id: string
  tenantId: string
  name: string
  address: string | null
  phone: string | null
  commissionPercent: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
