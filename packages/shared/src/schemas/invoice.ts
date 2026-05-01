import { z } from 'zod'

export const CurrencySchema = z.enum(['DOP', 'USD'])

export const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
})

export const CreateInvoiceSchema = z.object({
  patientId: z.string().uuid(),
  locationId: z.string().uuid(),
  consultationId: z.string().uuid().nullable().optional(),
  currency: CurrencySchema.default('DOP'),
  items: z.array(InvoiceItemSchema).min(1),
  notes: z.string().max(2000).nullable().optional(),
})

export const UpdateInvoiceSchema = z.object({
  currency: CurrencySchema.optional(),
  items: z.array(InvoiceItemSchema).min(1).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const UpdateInvoiceStatusSchema = z.object({
  status: z.enum(['issued', 'paid', 'cancelled']),
  paymentMethod: z.string().max(100).nullable().optional(),
})

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>
export type UpdateInvoiceDto = z.infer<typeof UpdateInvoiceSchema>
export type UpdateInvoiceStatusDto = z.infer<typeof UpdateInvoiceStatusSchema>
