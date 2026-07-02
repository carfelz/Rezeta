import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolTemplate, ProtocolCategory } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'

export type TemplateWithCategory = ProtocolTemplate & { category: ProtocolCategory }

@Injectable()
export class ProtocolTemplatesRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAllWithLockInfo(tenantId: string): Promise<TemplateWithCategory[]> {
    return this.prisma.protocolTemplate.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { category: true },
    }) as Promise<TemplateWithCategory[]>
  }

  async findById(id: string, tenantId: string): Promise<TemplateWithCategory | null> {
    return this.prisma.protocolTemplate.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: true },
    }) as Promise<TemplateWithCategory | null>
  }

  async findCategory(id: string, tenantId: string): Promise<ProtocolCategory | null> {
    return this.prisma.protocolCategory.findFirst({ where: { id, tenantId, deletedAt: null } })
  }

  async create(
    tenantId: string,
    data: {
      name: string
      categoryId: string
      schema: object
    },
    createdBy: string,
  ): Promise<TemplateWithCategory> {
    return this.prisma.protocolTemplate.create({
      data: {
        tenantId,
        name: data.name,
        categoryId: data.categoryId,
        schema: data.schema,
        isSeeded: false,
        createdBy,
      },
      include: { category: true },
    }) as Promise<TemplateWithCategory>
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string | undefined
      categoryId?: string | undefined
      schema?: object | undefined
    },
  ): Promise<TemplateWithCategory> {
    return this.prisma.protocolTemplate.update({
      where: { id, tenantId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.schema !== undefined && { schema: data.schema }),
        updatedAt: new Date(),
      },
      include: { category: true },
    }) as Promise<TemplateWithCategory>
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.protocolTemplate.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    })
  }
}
