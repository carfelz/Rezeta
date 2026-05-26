import { Injectable } from '@nestjs/common'
import type { ProtocolCategory } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'
import type { CreateProtocolCategoryDto, UpdateProtocolCategoryDto } from '@rezeta/shared'

@Injectable()
export class ProtocolCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string): Promise<ProtocolCategory[]> {
    return this.prisma.protocolCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    })
  }

  findById(tenantId: string, id: string): Promise<ProtocolCategory | null> {
    return this.prisma.protocolCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
  }

  create(tenantId: string, dto: CreateProtocolCategoryDto): Promise<ProtocolCategory> {
    return this.prisma.protocolCategory.create({
      data: {
        tenantId,
        name: dto.name,
        ...(dto.color !== undefined && { color: dto.color }),
      },
    })
  }

  update(tenantId: string, id: string, dto: UpdateProtocolCategoryDto): Promise<ProtocolCategory> {
    return this.prisma.protocolCategory.update({
      where: { id, tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    })
  }

  softDelete(tenantId: string, id: string): Promise<ProtocolCategory> {
    return this.prisma.protocolCategory.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    })
  }
}
