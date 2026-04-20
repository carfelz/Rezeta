import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolTemplate } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'

@Injectable()
export class ProtocolTemplatesRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findVisibleTemplates(tenantId: string): Promise<ProtocolTemplate[]> {
    return this.prisma.protocolTemplate.findMany({
      where: {
        deletedAt: null,
        OR: [
          { tenantId: null },
          { tenantId },
        ],
      },
      orderBy: { name: 'asc' },
    })
  }

  /** Finds a template accessible to the given tenant (system template or tenant-owned). */
  async findById(id: string, tenantId: string): Promise<ProtocolTemplate | null> {
    return this.prisma.protocolTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { tenantId: null },
          { tenantId },
        ],
      },
    })
  }
}
