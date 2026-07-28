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

/**
 * Staff cross-institution security dashboard (`GET
 * /v1/staff/identity/security/overview`) — identity slice 5 (design §6
 * screen 4, §8). Aggregates counts, dates, and institution names only —
 * never clinical data (control-plane isolation invariant, identity design
 * §2 decision 5). `plan` mirrors `StaffInstitutionSchema`'s enum
 * (`packages/shared/src/schemas/staff.ts`) — `Tenant.plan` never takes
 * `'enterprise'` (that's a `Tenant.type` value).
 */
export const StaffSecurityTilesSchema = z.object({
  activeInstitutions: z.number().int().nonnegative(),
  activeUsers30d: z.number().int().nonnegative(),
  logins7d: z.number().int().nonnegative(),
  dormantAccounts60d: z.number().int().nonnegative(),
})
export type StaffSecurityTilesDto = z.infer<typeof StaffSecurityTilesSchema>

export const StaffSecurityInstitutionSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().nullable(),
  plan: z.enum(['free', 'solo', 'practice', 'clinic']),
  mau30d: z.number().int().nonnegative(),
  /** Daily successful-login counts for the last 14 days, oldest first, today last. */
  logins14d: z.array(z.number().int().nonnegative()).length(14),
  dormant30d: z.number().int().nonnegative(),
  pendingInvites: z.number().int().nonnegative(),
})
export type StaffSecurityInstitutionDto = z.infer<typeof StaffSecurityInstitutionSchema>

export const StaffSecurityOverviewSchema = z.object({
  tiles: StaffSecurityTilesSchema,
  institutions: z.array(StaffSecurityInstitutionSchema),
})
export type StaffSecurityOverviewDto = z.infer<typeof StaffSecurityOverviewSchema>

/**
 * `POST /v1/identity/me/mfa/sync` result — identity slice 4 (design §4, §6
 * screen 1C/2). Mirrors `IAuthProvider.getMfaEnrollment` onto
 * `User.mfaEnrolledAt`; the web client calls this after every
 * enroll/unenroll so `AuthUser.mfaEnrolledAt` (and this response) stay in
 * sync with the provider without a separate `MfaEnrollment` table this
 * slice (see identity slice 4 plan §Out of scope).
 */
export const MfaSyncResultSchema = z.object({
  mfaEnrolledAt: z.string().nullable(),
})
export type MfaSyncResultDto = z.infer<typeof MfaSyncResultSchema>
