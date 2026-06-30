import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolCategory } from '@rezeta/db'
import type { CreateProtocolCategoryDto, UpdateProtocolCategoryDto } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

@Injectable()
export class ProtocolCategoriesRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

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
        color: dto.color ?? '#6B7280',
        ...(dto.specialty !== undefined && { specialty: dto.specialty }),
      },
    })
  }

  update(id: string, dto: UpdateProtocolCategoryDto): Promise<ProtocolCategory> {
    return this.prisma.protocolCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.specialty !== undefined && { specialty: dto.specialty }),
      },
    })
  }

  softDelete(id: string): Promise<ProtocolCategory> {
    return this.prisma.protocolCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  countTemplates(categoryId: string, tenantId: string): Promise<number> {
    return this.prisma.protocolTemplate.count({
      where: { categoryId, tenantId, deletedAt: null },
    })
  }
}
