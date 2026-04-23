import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolTemplate } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'

type TemplateWithTypes = ProtocolTemplate & {
  protocolTypes: { id: string }[]
}

@Injectable()
export class ProtocolTemplatesRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAllWithLockInfo(tenantId: string): Promise<TemplateWithTypes[]> {
    return this.prisma.protocolTemplate.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        protocolTypes: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    })
  }

  async findById(id: string, tenantId: string): Promise<TemplateWithTypes | null> {
    return this.prisma.protocolTemplate.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        protocolTypes: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    })
  }

  async create(
    tenantId: string,
    data: { name: string; suggestedSpecialty?: string | undefined; schema: object },
    createdBy: string,
  ): Promise<ProtocolTemplate> {
    return this.prisma.protocolTemplate.create({
      data: {
        tenantId,
        name: data.name,
        suggestedSpecialty: data.suggestedSpecialty ?? null,
        schema: data.schema,
        isSeeded: false,
        createdBy,
      },
    })
  }

  async update(
    id: string,
    tenantId: string,
    data: { name?: string | undefined; suggestedSpecialty?: string | null | undefined; schema?: object | undefined },
  ): Promise<ProtocolTemplate> {
    return this.prisma.protocolTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.suggestedSpecialty !== undefined && { suggestedSpecialty: data.suggestedSpecialty }),
        ...(data.schema !== undefined && { schema: data.schema }),
        updatedAt: new Date(),
      },
    })
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.protocolTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  // Legacy: kept for backward compat if anything calls isLocked / getBlockingTypeIds directly
  async isLocked(id: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.protocolType.count({
      where: { templateId: id, tenantId, deletedAt: null },
    })
    return count > 0
  }

  async getBlockingTypeIds(id: string, tenantId: string): Promise<string[]> {
    const types = await this.prisma.protocolType.findMany({
      where: { templateId: id, tenantId, deletedAt: null },
      select: { id: true },
    })
    return types.map((t) => t.id)
  }
}
