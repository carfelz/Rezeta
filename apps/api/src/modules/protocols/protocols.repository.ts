import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import { Protocol, ProtocolVersion } from '@rezeta/db'
import { CreateProtocolDto } from '@rezeta/shared'

@Injectable()
export class ProtocolsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: {
    tenantId: string
    title: string
    createdBy: string
    templateId?: string | null
    specialty?: string | null
    tags?: string[]
    content: any // ProtocolContentSchema
  }): Promise<Protocol & { currentVersion: ProtocolVersion }> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create the Protocol
      const protocol = await tx.protocol.create({
        data: {
          tenantId: data.tenantId,
          title: data.title,
          createdBy: data.createdBy,
          templateId: data.templateId,
          specialty: data.specialty,
          tags: data.tags || [],
          status: 'draft',
          visibility: 'private',
        },
      })

      // 2. Create the first Version (v1)
      const version = await tx.protocolVersion.create({
        data: {
          tenantId: data.tenantId,
          protocolId: protocol.id,
          versionNumber: 1,
          content: data.content,
          createdBy: data.createdBy,
        },
      })

      // 3. Update Protocol with currentVersionId
      const updatedProtocol = await tx.protocol.update({
        where: { id: protocol.id },
        data: { currentVersionId: version.id },
      })

      return {
        ...updatedProtocol,
        currentVersion: version,
      }
    })
  }

  async findById(id: string, tenantId: string) {
    return this.prisma.protocol.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        template: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    })
  }

  async list(tenantId: string, createdBy?: string) {
    return this.prisma.protocol.findMany({
      where: {
        tenantId,
        ...(createdBy ? { createdBy } : {}),
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        template: true,
      },
    })
  }
}
