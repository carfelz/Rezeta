import { Inject, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { IdentityRepository } from './identity.repository.js'

export type LoginOutcome = 'success' | 'blocked'
export type LoginMethod = 'password' | 'google' | 'sso' | 'unknown'

export interface RecordLoginInput {
  tenantId?: string | null
  userId?: string | null
  platformUserId?: string | null
  outcome: LoginOutcome
  method: LoginMethod
  ipAddress?: string | null
  userAgent?: string | null
}

export interface UpsertDeviceInput {
  tenantId?: string | null
  userId?: string | null
  platformUserId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

/** sha256(`${userAgent}|${ip}`) — deterministic, stores no more PII than the raw UA/IP already carry. */
export function fingerprintFor(
  userAgent: string | null | undefined,
  ipAddress: string | null | undefined,
): string {
  return createHash('sha256').update(`${userAgent ?? ''}|${ipAddress ?? ''}`).digest('hex')
}

/** Firebase `sign_in_provider` → our closed LoginMethod enum. Unrecognized/absent claims map to 'unknown'. */
export function mapFirebaseSignInMethod(rawClaims: Record<string, unknown>): LoginMethod {
  const firebase = rawClaims['firebase'] as { sign_in_provider?: string } | undefined
  if (firebase?.sign_in_provider === 'password') return 'password'
  if (firebase?.sign_in_provider === 'google.com') return 'google'
  return 'unknown'
}

/**
 * Login telemetry (LoginEvent) + device registry (UserDevice) writes.
 * Neither method catches its own errors — matching the codebase's existing
 * fire-and-forget convention (see AuthGuard.markSignedIn): callers invoke
 * these with `void ...().catch((err) => logger.warn(...))` so a telemetry
 * outage never blocks a login. See AuthService.provision and AuthGuard below.
 */
@Injectable()
export class LoginTelemetryService {
  constructor(@Inject(IdentityRepository) private repository: IdentityRepository) {}

  async recordLogin(input: RecordLoginInput): Promise<void> {
    await this.repository.insertLoginEvent({
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      platformUserId: input.platformUserId ?? null,
      outcome: input.outcome,
      method: input.method,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
  }

  async upsertDevice(input: UpsertDeviceInput): Promise<void> {
    await this.repository.upsertDevice({
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      platformUserId: input.platformUserId ?? null,
      fingerprint: fingerprintFor(input.userAgent, input.ipAddress),
      userAgent: input.userAgent ?? null,
    })
  }
}
