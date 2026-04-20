import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'

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
    content: unknown
  }) {
    return this.prisma.$transaction(async (tx) => {
      const protocol = await tx.protocol.create({
        data: {
          tenantId: data.tenantId,
          title: data.title,
          createdBy: data.createdBy,
          templateId: data.templateId ?? null,
          specialty: data.specialty ?? null,
          tags: data.tags ?? [],
          status: 'draft',
          visibility: 'private',
        },
      })

      const version = await tx.protocolVersion.create({
        data: {
          tenantId: data.tenantId,
          protocolId: protocol.id,
          versionNumber: 1,
          content: data.content as object,
          createdBy: data.createdBy,
        },
      })

      const updated = await tx.protocol.update({
        where: { id: protocol.id },
        data: { currentVersionId: version.id },
        include: { template: true },
      })

      return { protocol: updated, version }
    })
  }

  async findById(id: string, tenantId: string) {
    const protocol = await this.prisma.protocol.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { template: true },
    })
    if (!protocol) return null

    const currentVersion = protocol.currentVersionId
      ? await this.prisma.protocolVersion.findFirst({
          where: { id: protocol.currentVersionId, deletedAt: null },
        })
      : null

    return { ...protocol, currentVersion }
  }

  async list(tenantId: string) {
    return this.prisma.protocol.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        template: { select: { name: true } },
        versions: {
          where: { deletedAt: null },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { versionNumber: true },
        },
      },
    })
  }

  async rename(id: string, tenantId: string, title: string) {
    const existing = await this.prisma.protocol.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!existing) return null

    return this.prisma.protocol.update({
      where: { id },
      data: { title },
    })
  }

  async saveVersion(data: {
    protocolId: string
    tenantId: string
    createdBy: string
    content: unknown
    changeSummary?: string | null
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Verify protocol belongs to tenant before creating version
      const protocol = await tx.protocol.findFirst({
        where: { id: data.protocolId, tenantId: data.tenantId, deletedAt: null },
      })
      if (!protocol) return null

      const latest = await tx.protocolVersion.findFirst({
        where: { protocolId: data.protocolId, deletedAt: null },
        orderBy: { versionNumber: 'desc' },
      })
      const nextVersion = (latest?.versionNumber ?? 0) + 1

      const version = await tx.protocolVersion.create({
        data: {
          tenantId: data.tenantId,
          protocolId: data.protocolId,
          versionNumber: nextVersion,
          content: data.content as object,
          changeSummary: data.changeSummary ?? null,
          createdBy: data.createdBy,
        },
      })

      await tx.protocol.update({
        where: { id: data.protocolId },
        data: { currentVersionId: version.id },
      })

      return version
    })
  }
}
