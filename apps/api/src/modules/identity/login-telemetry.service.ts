import { Inject, Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { InvitationMailerService } from '../users/index.js'
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
  /**
   * Institution user's email — used only to send the new-device
   * notification when this call creates a brand-new device row. Optional
   * because the platform-staff device-tracking path (out of scope this
   * slice, see `UpsertDeviceInput.userId`'s doc) has no email to send to.
   */
  email?: string | null
}

export interface UpsertDeviceResult {
  created: boolean
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
 * `recordLogin` doesn't catch its own errors — matching the codebase's
 * existing fire-and-forget convention (see AuthGuard.markSignedIn): callers
 * invoke these with `void ...().catch((err) => logger.warn(...))` so a
 * telemetry outage never blocks a login. See AuthService.provision and
 * AuthGuard below. `upsertDevice` additionally fires the new-device email
 * (identity design §7 "New-device email") on its own internal
 * fire-and-forget path — a mailer failure never rejects `upsertDevice`
 * itself, so a caller's `.catch` can't mistake it for a telemetry-write
 * failure.
 */
@Injectable()
export class LoginTelemetryService {
  private readonly logger = new Logger(LoginTelemetryService.name)

  constructor(
    @Inject(IdentityRepository) private repository: IdentityRepository,
    @Inject(InvitationMailerService) private mailer: InvitationMailerService,
  ) {}

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

  async upsertDevice(input: UpsertDeviceInput): Promise<UpsertDeviceResult> {
    const row = await this.repository.upsertDevice({
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      platformUserId: input.platformUserId ?? null,
      fingerprint: fingerprintFor(input.userAgent, input.ipAddress),
      userAgent: input.userAgent ?? null,
    })
    const created = row.firstSeenAt.getTime() === row.lastSeenAt.getTime()

    if (created && input.userId && input.email) {
      const deviceLabel = input.userAgent ?? 'Unknown device'
      void this.mailer.sendNewDeviceEmail(input.email, deviceLabel).catch((err: unknown) => {
        this.logger.warn(
          `Failed to send new-device email for user id=${input.userId}: ${(err as Error).message}`,
        )
      })
    }

    return { created }
  }
}
