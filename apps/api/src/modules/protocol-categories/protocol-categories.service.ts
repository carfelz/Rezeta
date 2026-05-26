import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import type { ProtocolCategory } from '@rezeta/db'
import { ProtocolCategoriesRepository } from './protocol-categories.repository.js'
import type { CreateProtocolCategoryDto, UpdateProtocolCategoryDto } from '@rezeta/shared'

@Injectable()
export class ProtocolCategoriesService {
  constructor(private readonly repo: ProtocolCategoriesRepository) {}

  findAll(tenantId: string): Promise<ProtocolCategory[]> {
    return this.repo.findAll(tenantId)
  }

  async findById(tenantId: string, id: string): Promise<ProtocolCategory> {
    const cat = await this.repo.findById(tenantId, id)
    if (!cat) throw new NotFoundException(`Protocol category ${id} not found`)
    return cat
  }

  create(tenantId: string, dto: CreateProtocolCategoryDto): Promise<ProtocolCategory> {
    return this.repo.create(tenantId, dto)
  }

  async update(tenantId: string, id: string, dto: UpdateProtocolCategoryDto): Promise<ProtocolCategory> {
    await this.findById(tenantId, id)
    return this.repo.update(tenantId, id, dto)
  }

  async delete(tenantId: string, id: string): Promise<ProtocolCategory> {
    const cat = await this.repo.findById(tenantId, id)
    if (!cat) throw new NotFoundException(`Protocol category ${id} not found`)
    if (cat.isSeeded) throw new BadRequestException('Cannot delete a seeded category')
    return this.repo.softDelete(tenantId, id)
  }
}
