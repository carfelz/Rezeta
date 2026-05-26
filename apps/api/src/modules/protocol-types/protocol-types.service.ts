import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common'
import { ProtocolTypesRepository, type TypeWithDetails } from './protocol-types.repository.js'

// Stubbed DTO until ProtocolCategory replaces ProtocolType (Plan 02).
export interface ProtocolTypeDto {
  id: string
  tenantId: string
  templateId: string
  templateName: string
  name: string
  isSeeded: boolean
  isLocked: boolean
  protocolCount: number
  createdAt: string
  updatedAt: string
}

@Injectable()
export class ProtocolTypesService {
  constructor(@Inject(ProtocolTypesRepository) private repo: ProtocolTypesRepository) {}

  private toDto(t: TypeWithDetails): ProtocolTypeDto {
    return {
      id: t.id,
      tenantId: t.tenantId,
      templateId: t.templateId,
      templateName: t.template.name,
      name: t.name,
      isSeeded: t.isSeeded,
      isLocked: t._count.protocols > 0,
      protocolCount: t._count.protocols,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }
  }

  async getTypes(tenantId: string): Promise<ProtocolTypeDto[]> {
    const types = await this.repo.findAll(tenantId)
    return types.map((t) => this.toDto(t))
  }

  async findById(id: string, tenantId: string): Promise<ProtocolTypeDto> {
    const t = await this.repo.findById(id, tenantId)
    if (!t) throw new NotFoundException({ code: 'TYPE_NOT_FOUND' })
    return this.toDto(t)
  }

  async create(
    tenantId: string,
    dto: { name: string; templateId: string },
  ): Promise<ProtocolTypeDto> {
    const templateOk = await this.repo.templateBelongsToTenant(dto.templateId, tenantId)
    if (!templateOk) {
      throw new ConflictException({ code: 'TEMPLATE_NOT_FOUND_FOR_TYPE' })
    }
    const t = await this.repo.create(tenantId, dto.name, dto.templateId)
    return this.toDto(t)
  }

  async update(
    id: string,
    tenantId: string,
    dto: { name: string },
  ): Promise<ProtocolTypeDto> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException({ code: 'TYPE_NOT_FOUND' })
    const t = await this.repo.update(id, tenantId, dto.name)
    return this.toDto(t)
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException({ code: 'TYPE_NOT_FOUND' })
    await this.repo.softDelete(id, tenantId)
  }
}
