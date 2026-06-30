import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import type { ProtocolCategory } from '@rezeta/db'
import { ErrorCode } from '@rezeta/shared'
import type { CreateProtocolCategoryDto, UpdateProtocolCategoryDto } from '@rezeta/shared'
import { ProtocolCategoriesRepository } from './protocol-categories.repository.js'

@Injectable()
export class ProtocolCategoriesService {
  constructor(
    @Inject(ProtocolCategoriesRepository) private readonly repo: ProtocolCategoriesRepository,
  ) {}

  findAll(tenantId: string): Promise<ProtocolCategory[]> {
    return this.repo.findAll(tenantId)
  }

  async findById(tenantId: string, id: string): Promise<ProtocolCategory> {
    const cat = await this.repo.findById(tenantId, id)
    if (!cat) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_CATEGORY_NOT_FOUND,
        message: 'Protocol category not found',
      })
    }
    return cat
  }

  create(tenantId: string, dto: CreateProtocolCategoryDto): Promise<ProtocolCategory> {
    return this.repo.create(tenantId, dto)
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProtocolCategoryDto,
  ): Promise<ProtocolCategory> {
    await this.findById(tenantId, id)
    return this.repo.update(id, dto)
  }

  async delete(tenantId: string, id: string): Promise<ProtocolCategory> {
    const cat = await this.findById(tenantId, id)
    if (cat.isSeeded) {
      throw new BadRequestException({
        code: ErrorCode.PROTOCOL_CATEGORY_SEEDED_IMMUTABLE,
        message: 'Cannot delete a seeded category',
      })
    }
    const count = await this.repo.countTemplates(id, tenantId)
    if (count > 0) {
      throw new ConflictException({
        code: ErrorCode.CATEGORY_IN_USE_BY_TEMPLATES,
        message: 'Category is in use by templates',
        details: { count },
      })
    }
    return this.repo.softDelete(id)
  }
}
