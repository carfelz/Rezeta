import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolType } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'

export type TypeWithDetails = ProtocolType & {
  template: { id: string; name: string }
  _count: { protocols: number }
}

@Injectable()
export class ProtocolTypesRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<TypeWithDetails[]> {
    return this.prisma.protocolType.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        template: { select: { id: true, name: true } },
        _count: { select: { protocols: { where: { deletedAt: null } } } },
      },
    }) as Promise<TypeWithDetails[]>
  }

  async findByIdWithTemplate(
    id: string,
    tenantId: string,
  ): Promise<(TypeWithDetails & { template: TypeWithDetails['template'] & { schema: unknown } }) | null> {
    return this.prisma.protocolType.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        template: { select: { id: true, name: true, schema: true } },
        _count: { select: { protocols: { where: { deletedAt: null } } } },
      },
    }) as Promise<(TypeWithDetails & { template: TypeWithDetails['template'] & { schema: unknown } }) | null>
  }

  async findById(id: string, tenantId: string): Promise<TypeWithDetails | null> {
    return this.prisma.protocolType.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        template: { select: { id: true, name: true } },
        _count: { select: { protocols: { where: { deletedAt: null } } } },
      },
    }) as Promise<TypeWithDetails | null>
  }

  async existsByName(name: string, tenantId: string, excludeId?: string): Promise<boolean> {
    const count = await this.prisma.protocolType.count({
      where: {
        tenantId,
        name,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    })
    return count > 0
  }

  async templateBelongsToTenant(templateId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.protocolTemplate.count({
      where: { id: templateId, tenantId, deletedAt: null },
    })
    return count > 0
  }

  async create(tenantId: string, name: string, templateId: string): Promise<TypeWithDetails> {
    return this.prisma.protocolType.create({
      data: { tenantId, name, templateId, isSeeded: false },
      include: {
        template: { select: { id: true, name: true } },
        _count: { select: { protocols: { where: { deletedAt: null } } } },
      },
    }) as Promise<TypeWithDetails>
  }

  async update(id: string, tenantId: string, name: string): Promise<TypeWithDetails> {
    return this.prisma.protocolType.update({
      where: { id, tenantId },
      data: { name },
      include: {
        template: { select: { id: true, name: true } },
        _count: { select: { protocols: { where: { deletedAt: null } } } },
      },
    }) as Promise<TypeWithDetails>
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.protocolType.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    })
  }
}
