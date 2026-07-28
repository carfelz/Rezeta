import { z } from 'zod'

/**
 * Identity module DTOs (`/v1/identity/*`) — login telemetry + device registry.
 * Slice 3 of the identity module design (§4, §5, §6 screens 2-3). LoginEvent/
 * UserDevice are provider-agnostic telemetry tables, not part of the AuditLog
 * legal trail (see schema.prisma model comments).
 */

export const LoginOutcomeSchema = z.enum(['success', 'blocked'])
export const LoginMethodSchema = z.enum(['password', 'google', 'sso', 'unknown'])

export const LoginEventItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  userName: z.string().nullable(),
  outcome: LoginOutcomeSchema,
  method: LoginMethodSchema,
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
})
export type LoginEventItemDto = z.infer<typeof LoginEventItemSchema>

export const SecuritySummarySchema = z.object({
  logins: z.number().int().nonnegative(),
  distinctUsers: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  dormantUsers30d: z.number().int().nonnegative(),
})
export type SecuritySummaryDto = z.infer<typeof SecuritySummarySchema>

export const UserDeviceItemSchema = z.object({
  id: z.string().uuid(),
  fingerprint: z.string(),
  userAgent: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
})
export type UserDeviceItemDto = z.infer<typeof UserDeviceItemSchema>
