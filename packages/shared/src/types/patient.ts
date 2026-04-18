export type DocumentType = 'cedula' | 'passport' | 'rnc'
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
export type Sex = 'male' | 'female' | 'other'

export interface Patient {
  id: string
  tenantId: string
  ownerUserId: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  sex: Sex | null
  documentType: DocumentType | null
  documentNumber: string | null
  phone: string | null
  email: string | null
  address: string | null
  bloodType: BloodType | null
  allergies: string[]
  chronicConditions: string[]
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
