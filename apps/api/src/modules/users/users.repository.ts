import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common'
import { Prisma } from '@rezeta/db'
import type { User } from '@rezeta/db'
import { ErrorCode, type UserPreferences } from '@rezeta/shared'
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
   * Resolve the DB user for a verified token. Users are provisioned internally
   * (UsersService.createUser writes the row with its externalUid), so first
   * sign-in simply finds the existing row. A verified Firebase token with no DB
   * user is rejected — there is no auto-tenant-creation anymore.
   */
  async provisionUser(verified: VerifiedToken): Promise<UserWithTenant> {
    const existing = await this.prisma.user.findUnique({
      where: { externalUid: verified.externalUid, deletedAt: null },
      include: TENANT_SELECT,
    })
    if (!existing) {
      throw new UnauthorizedException({
        code: ErrorCode.USER_NOT_PROVISIONED,
        message: 'User has not been provisioned.',
      })
    }
    return existing
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
  }

  async createProvisionedUser(input: {
    tenantId: string
    externalUid: string
    email: string
    fullName: string
    role: string
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        externalUid: input.externalUid,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
      },
    })
  }

  async updateRole(id: string, tenantId: string, role: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { role },
    })
  }

  async setActive(id: string, tenantId: string, isActive: boolean): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id, tenantId },
      data: isActive
        ? { isActive: true, deletedAt: null }
        : { isActive: false, deletedAt: new Date() },
    })
  }
}
