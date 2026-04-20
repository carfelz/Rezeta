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
          { tenantId: null }, // System templates
          { tenantId } // Custom tenant templates
        ]
      },
      orderBy: { name: 'asc' }
    })
  }
}
