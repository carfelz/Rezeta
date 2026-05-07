import { Injectable, Inject, Logger } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import type { User } from '@rezeta/db'
import type { VerifiedToken } from '../../lib/auth/index.js'

export type UserWithTenant = User & { tenant: { seededAt: Date | null; plan: string } }

const TENANT_SELECT = { tenant: { select: { seededAt: true, plan: true } } } as const

@Injectable()
export class UsersRepository {
  private readonly logger = new Logger(UsersRepository.name)

  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findById(id: string, tenantId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
  }

  async findByExternalUid(externalUid: string): Promise<UserWithTenant | null> {
    return this.prisma.user.findUnique({
      where: { externalUid, deletedAt: null },
      include: TENANT_SELECT,
    })
  }

  /**
   * Idempotent provision:
   * - If a User already exists for this externalUid → return it (no DB writes)
   * - If not → create Tenant + User atomically in a single transaction
   *
   * Single source of truth for tenant + user creation. Race conditions on the
   * unique externalUid constraint are handled by catching P2002 and re-fetching.
   */
  async provisionUser(verified: VerifiedToken): Promise<UserWithTenant> {
    const { externalUid, email } = verified

    const existing = await this.prisma.user.findUnique({
      where: { externalUid },
      include: TENANT_SELECT,
    })
    if (existing) {
      this.logger.debug(`Provision: user already exists for externalUid=${externalUid}`)
      return existing
    }

    this.logger.log(`Provision: creating new tenant+user for externalUid=${externalUid}`)

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
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
            externalUid,
            email: email ?? '',
            role: 'owner',
          },
          include: TENANT_SELECT,
        })
      })

      return user
    } catch (err: unknown) {
      const isUniqueViolation =
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'

      if (isUniqueViolation) {
        this.logger.warn(
          `Provision race condition for externalUid=${externalUid} — re-fetching existing user`,
        )
        const refetched = await this.prisma.user.findUnique({
          where: { externalUid },
          include: TENANT_SELECT,
        })
        if (refetched) return refetched
      }

      throw err
    }
  }
}
