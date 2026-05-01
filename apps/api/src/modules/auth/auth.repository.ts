import { Injectable, Inject, Logger } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import type { User } from '@rezeta/db'
import type { DecodedIdToken } from 'firebase-admin/auth'

export type UserWithTenant = User & { tenant: { seededAt: Date | null; plan: string } }

const TENANT_SELECT = { tenant: { select: { seededAt: true, plan: true } } } as const

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name)

  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /**
   * Idempotent provision:
   * - If a User already exists for this firebaseUid → return it (no DB writes)
   * - If not → create Tenant + User atomically in a single transaction
   *
   * This is the ONLY write path for tenant/user creation.
   * A race condition between two simultaneous provision calls is handled by
   * catching the unique constraint violation on firebaseUid and re-fetching.
   */
  async provisionUser(decoded: DecodedIdToken): Promise<UserWithTenant> {
    const { uid, email } = decoded

    // Fast-path: user already exists (the common case after first provision)
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: uid },
      include: TENANT_SELECT,
    })
    if (existing) {
      this.logger.debug(`Provision: user already exists for uid=${uid}`)
      return existing
    }

    // Slow-path: first-time provision — create Tenant + User atomically
    this.logger.log(`Provision: creating new tenant+user for uid=${uid}`)

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            // name is null until onboarding is complete
            type: 'solo',
            plan: 'free',
            country: 'DO',
            language: 'es',
            timezone: 'America/Santo_Domingo',
          },
        })

        return tx.user.create({
          data: {
            tenantId: tenant.id,
            firebaseUid: uid,
            email: email ?? '',
            // fullName is null until onboarding is complete
            role: 'owner',
          },
          include: TENANT_SELECT,
        })
      })

      return user
    } catch (err: unknown) {
      // Handle race condition: another request provisioned just before us
      const isUniqueViolation =
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'

      if (isUniqueViolation) {
        this.logger.warn(`Provision race condition for uid=${uid} — re-fetching existing user`)
        const refetched = await this.prisma.user.findUnique({
          where: { firebaseUid: uid },
          include: TENANT_SELECT,
        })
        if (refetched) return refetched
      }

      throw err
    }
  }

  async findByFirebaseUid(uid: string): Promise<UserWithTenant | null> {
    return this.prisma.user.findUnique({
      where: { firebaseUid: uid, deletedAt: null },
      include: TENANT_SELECT,
    })
  }
}
