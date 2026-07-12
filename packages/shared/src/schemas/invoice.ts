import { z } from 'zod'

export const CurrencySchema = z.enum(['DOP', 'USD'])

// Sane upper bound for a single money field (2dp DOP). Guards against overflow
// and absurd inputs; well above any realistic line amount.
const MAX_MONEY = 100_000_000

export const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0).max(MAX_MONEY).finite(),
  // `total` is accepted for backward compatibility (the web client still sends it)
  // but the server never trusts it — line totals are recomputed from quantity * unitPrice.
  total: z.number().min(0).max(MAX_MONEY).finite(),
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
