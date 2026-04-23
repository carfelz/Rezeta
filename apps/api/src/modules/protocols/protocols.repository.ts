import { Injectable, Inject } from '@nestjs/common'
import type { Protocol, ProtocolVersion, ProtocolType, ProtocolTemplate } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'

type ProtocolCreateResult = {
  protocol: Protocol & { type: ProtocolType & { template: ProtocolTemplate } }
  version: ProtocolVersion
}
type ProtocolFullResult = Protocol & {
  type: ProtocolType & { template: ProtocolTemplate }
  currentVersion: ProtocolVersion | null
}
type ProtocolListEntry = Protocol & {
  type: { id: string; name: string }
  versions: { versionNumber: number }[]
}

@Injectable()
export class ProtocolsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: {
    tenantId: string
    title: string
    createdBy: string
    typeId: string
    tags?: string[]
    content: unknown
  }): Promise<ProtocolCreateResult> {
    return this.prisma.$transaction(async (tx) => {
      const protocol = await tx.protocol.create({
        data: {
          tenantId: data.tenantId,
          title: data.title,
          createdBy: data.createdBy,
          typeId: data.typeId,
          tags: data.tags ?? [],
          status: 'draft',
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
        include: { type: { include: { template: true } } },
      })

      return { protocol: updated as Protocol & { type: ProtocolType & { template: ProtocolTemplate } }, version }
    })
  }

  async findById(id: string, tenantId: string): Promise<ProtocolFullResult | null> {
    const protocol = await this.prisma.protocol.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { type: { include: { template: true } } },
    })
    if (!protocol) return null

    const currentVersion = protocol.currentVersionId
      ? await this.prisma.protocolVersion.findFirst({
          where: { id: protocol.currentVersionId, deletedAt: null },
        })
      : null

    return { ...(protocol as Protocol & { type: ProtocolType & { template: ProtocolTemplate } }), currentVersion }
  }

  async list(tenantId: string): Promise<ProtocolListEntry[]> {
    return this.prisma.protocol.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        type: { select: { id: true, name: true } },
        versions: {
          where: { deletedAt: null },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { versionNumber: true },
        },
      },
    }) as unknown as Promise<ProtocolListEntry[]>
  }

  async rename(id: string, tenantId: string, title: string): Promise<Protocol | null> {
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
  }): Promise<ProtocolVersion | null> {
    return this.prisma.$transaction(async (tx) => {
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
