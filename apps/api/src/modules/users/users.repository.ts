import { Injectable, Inject, Logger } from '@nestjs/common'
import { Prisma } from '@rezeta/db'
import type { User } from '@rezeta/db'
import type { UserPreferences } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'
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

  async updateProfile(
    id: string,
    tenantId: string,
    data: { fullName: string; specialty: string | null; licenseNumber: string | null },
  ): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: {
        fullName: data.fullName,
        specialty: data.specialty,
        licenseNumber: data.licenseNumber,
      },
    })
  }

  async updatePreferences(
    id: string,
    tenantId: string,
    preferences: UserPreferences,
  ): Promise<void> {
    // Tenant filter on updateMany guards against cross-tenant writes — even
    // though the service has already verified ownership.
    await this.prisma.user.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { preferences: preferences as Prisma.InputJsonValue },
    })
  }

  async markSignedIn(id: string, tenantId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id, tenantId },
      data: { lastLoginAt: new Date() },
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
  async provisionUser(
    verified: VerifiedToken,
    profile?: { fullName?: string; specialty?: string },
  ): Promise<UserWithTenant> {
    const { externalUid, email } = verified

    const existing = await this.prisma.user.findUnique({
      where: { externalUid },
      include: TENANT_SELECT,
    })
    if (existing) {
      // Backfill the profile when a racing empty provision (e.g. the
      // onAuthStateChanged call at signup) created this row before the signup
      // flow's provision carrying the profile arrived. Only fill a blank name so
      // this stays idempotent: a later empty provision cannot blank an existing
      // name, and a real profile cannot clobber a name the user has since edited.
      const suppliedName = profile?.fullName?.trim()
      const storedNameBlank = !existing.fullName || existing.fullName.trim() === ''
      if (suppliedName && storedNameBlank) {
        this.logger.log(`Provision: backfilling blank profile for externalUid=${externalUid}`)
        const data: Prisma.UserUpdateManyMutationInput = { fullName: suppliedName }
        if (profile?.specialty) data.specialty = profile.specialty
        await this.prisma.user.updateMany({
          where: { id: existing.id, tenantId: existing.tenantId, deletedAt: null },
          data,
        })
        return {
          ...existing,
          fullName: suppliedName,
          ...(profile?.specialty ? { specialty: profile.specialty } : {}),
        }
      }
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
            role: 'super_admin',
            ...(profile?.fullName ? { fullName: profile.fullName } : {}),
            ...(profile?.specialty ? { specialty: profile.specialty } : {}),
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
