import { Injectable, Inject } from '@nestjs/common'
import type { PlatformUser } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'

/**
 * PlatformUsersRepository — control-plane identity lookups.
 *
 * PlatformUser rows have no tenant; there is no tenant filter here (that is the
 * point of the control plane). Soft-deleted rows are excluded.
 */
@Injectable()
export class PlatformUsersRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findByExternalUid(externalUid: string): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findFirst({
      where: { externalUid, deletedAt: null },
    })
  }

  async create(data: {
    externalUid: string
    email: string
    fullName: string | null
  }): Promise<PlatformUser> {
    return this.prisma.platformUser.create({ data })
  }

  /**
   * Full roster, INCLUDING deactivated (soft-deleted) rows — the staff console
   * shows them with a Reactivate action. Contrast findByExternalUid, which
   * excludes them because it authenticates.
   */
  async list(): Promise<PlatformUser[]> {
    return this.prisma.platformUser.findMany({ orderBy: { createdAt: 'asc' } })
  }

  /** By primary key, including soft-deleted rows (needed to reactivate). */
  async findById(id: string): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findUnique({ where: { id } })
  }

  /** Mirrors institution semantics: deactivation is a soft delete. */
  async setActive(id: string, isActive: boolean): Promise<PlatformUser> {
    return this.prisma.platformUser.update({
      where: { id },
      data: isActive
        ? { isActive: true, deletedAt: null }
        : { isActive: false, deletedAt: new Date() },
    })
  }

  /** First-sign-in stamp; called fire-and-forget from AuthGuard. */
  async markSignedIn(id: string): Promise<void> {
    await this.prisma.platformUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    })
  }
}
