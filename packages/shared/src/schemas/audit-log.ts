import { z } from 'zod'

export const AuditCategorySchema = z.enum(['entity', 'auth', 'communication', 'system'])
export const AuditActorTypeSchema = z.enum(['user', 'system', 'webhook', 'cron'])
export const AuditStatusSchema = z.enum(['success', 'failed'])

export const AuditLogQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  actorUserId: z.string().uuid().optional(),
  category: AuditCategorySchema.optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  status: AuditStatusSchema.optional(),
})

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>
