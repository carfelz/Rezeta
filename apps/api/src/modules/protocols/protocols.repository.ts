import { Injectable, Inject } from '@nestjs/common'
import type { Protocol, ProtocolVersion, ProtocolCategory } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'

type ProtocolCreateResult = {
  protocol: Protocol & { category: ProtocolCategory | null }
  version: ProtocolVersion
}
type ProtocolFullResult = Protocol & {
  category: ProtocolCategory | null
  currentVersion: ProtocolVersion | null
}
type ProtocolListEntry = Protocol & {
  category: { id: string; name: string } | null
  versions: { versionNumber: number; content: unknown }[]
}

@Injectable()
export class ProtocolsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: {
    tenantId: string
    title: string
    createdBy: string
    categoryId?: string
    tags?: string[]
    content: unknown
  }): Promise<ProtocolCreateResult> {
    return this.prisma.$transaction(async (tx) => {
      const protocol = await tx.protocol.create({
        data: {
          tenantId: data.tenantId,
          title: data.title,
          createdBy: data.createdBy,
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
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
        include: { category: true },
      })

      return {
        protocol: updated as Protocol & { category: ProtocolCategory | null },
        version,
      }
    })
  }

  async findById(id: string, tenantId: string): Promise<ProtocolFullResult | null> {
    const protocol = await this.prisma.protocol.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: true },
    })
    if (!protocol) return null

    const currentVersion = protocol.currentVersionId
      ? await this.prisma.protocolVersion.findFirst({
          where: { id: protocol.currentVersionId, deletedAt: null },
        })
      : null

    return {
      ...(protocol as Protocol & { category: ProtocolCategory | null }),
      currentVersion,
    }
  }

  async list(
    tenantId: string,
    filters: {
      search?: string
      categoryId?: string
      status?: string
      favoritesOnly?: boolean
      sort?: string
    } = {},
  ): Promise<ProtocolListEntry[]> {
    const orderBy = (() => {
      switch (filters.sort) {
        case 'updatedAt_asc':
          return { updatedAt: 'asc' as const }
        case 'title_asc':
          return { title: 'asc' as const }
        case 'title_desc':
          return { title: 'desc' as const }
        default:
          return { updatedAt: 'desc' as const }
      }
    })()

    return this.prisma.protocol.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.favoritesOnly ? { isFavorite: true } : {}),
        ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}),
      },
      orderBy,
      include: {
        category: { select: { id: true, name: true } },
        versions: {
          where: { deletedAt: null },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { versionNumber: true, content: true },
        },
      },
    }) as unknown as Promise<ProtocolListEntry[]>
  }

  async setFavorite(id: string, tenantId: string, isFavorite: boolean): Promise<boolean> {
    const existing = await this.prisma.protocol.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!existing) return false
    await this.prisma.protocol.update({ where: { id }, data: { isFavorite } })
    return true
  }

  async archive(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.prisma.protocol.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!existing) return false
    await this.prisma.protocol.update({ where: { id }, data: { status: 'archived' } })
    return true
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

  async listVersions(
    protocolId: string,
    tenantId: string,
  ): Promise<
    Array<{
      id: string
      versionNumber: number
      changeSummary: string | null
      createdAt: Date
      isCurrent: boolean
    }>
  > {
    const protocol = await this.prisma.protocol.findFirst({
      where: { id: protocolId, tenantId, deletedAt: null },
      select: { currentVersionId: true },
    })
    if (!protocol) return []

    const versions = await this.prisma.protocolVersion.findMany({
      where: { protocolId, tenantId, deletedAt: null },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, changeSummary: true, createdAt: true },
    })

    return versions.map((v) => ({ ...v, isCurrent: v.id === protocol.currentVersionId }))
  }

  async getVersion(
    protocolId: string,
    versionId: string,
    tenantId: string,
  ): Promise<ProtocolVersion | null> {
    return this.prisma.protocolVersion.findFirst({
      where: { id: versionId, protocolId, tenantId, deletedAt: null },
    })
  }

  async saveVersion(data: {
    protocolId: string
    tenantId: string
    createdBy: string
    content: unknown
    changeSummary?: string | null
    publish?: boolean
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
        data: {
          currentVersionId: version.id,
          ...(data.publish ? { status: 'active' } : {}),
        },
      })

      return version
    })
  }
}
