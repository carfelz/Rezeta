import { Injectable, Inject, BadRequestException } from '@nestjs/common'
import type { ProtocolTemplate } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'

@Injectable()
export class ProtocolTemplatesRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAllWithLockInfo(tenantId: string): Promise<ProtocolTemplate[]> {
    return this.prisma.protocolTemplate.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    })
  }

  async findById(id: string, tenantId: string): Promise<ProtocolTemplate | null> {
    return this.prisma.protocolTemplate.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
  }

  async create(
    tenantId: string,
    data: {
      name: string
      suggestedSpecialty?: string | undefined
      schema: object
      categoryId?: string | undefined
    },
    createdBy: string,
  ): Promise<ProtocolTemplate> {
    let categoryId = data.categoryId
    if (!categoryId) {
      const fallback = await this.prisma.protocolCategory.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (!fallback) {
        throw new BadRequestException({ code: 'CATEGORY_REQUIRED' })
      }
      categoryId = fallback.id
    }
    return this.prisma.protocolTemplate.create({
      data: {
        tenantId,
        name: data.name,
        suggestedSpecialty: data.suggestedSpecialty ?? null,
        categoryId,
        schema: data.schema,
        isSeeded: false,
        createdBy,
      },
    })
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string | undefined
      suggestedSpecialty?: string | null | undefined
      schema?: object | undefined
    },
  ): Promise<ProtocolTemplate> {
    return this.prisma.protocolTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.suggestedSpecialty !== undefined && {
          suggestedSpecialty: data.suggestedSpecialty,
        }),
        ...(data.schema !== undefined && { schema: data.schema }),
        updatedAt: new Date(),
      },
    })
  }

  async softDelete(id: string, _tenantId: string): Promise<void> {
    await this.prisma.protocolTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}
