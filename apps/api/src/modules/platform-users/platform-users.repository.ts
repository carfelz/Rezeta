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
}
