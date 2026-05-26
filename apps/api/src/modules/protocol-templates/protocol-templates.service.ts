import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common'
import type {
  ProtocolTemplateDto,
  CreateProtocolTemplateDto,
  UpdateProtocolTemplateDto,
} from '@rezeta/shared'
import { setAuditEntityName } from '../../common/audit-log/audit-context.store.js'
import { ProtocolTemplatesRepository } from './protocol-templates.repository.js'
import type { ProtocolTemplate } from '@rezeta/db'

@Injectable()
export class ProtocolTemplatesService {
  constructor(@Inject(ProtocolTemplatesRepository) private repo: ProtocolTemplatesRepository) {}

  private toDto(t: ProtocolTemplate): ProtocolTemplateDto {
    return {
      id: t.id,
      tenantId: t.tenantId,
      name: t.name,
      description: t.description,
      suggestedSpecialty: t.suggestedSpecialty,
      schema: t.schema,
      isSeeded: t.isSeeded,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }
  }

  async getTemplates(tenantId: string): Promise<ProtocolTemplateDto[]> {
    const templates = await this.repo.findAll(tenantId)
    return templates.map((t) => this.toDto(t))
  }

  async findById(id: string, tenantId: string): Promise<ProtocolTemplateDto> {
    const t = await this.repo.findById(id, tenantId)
    if (!t) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' })
    return this.toDto(t)
  }

  async create(
    tenantId: string,
    dto: CreateProtocolTemplateDto,
    userId: string,
  ): Promise<ProtocolTemplateDto> {
    const t = await this.repo.create(tenantId, dto, userId)
    return this.toDto(t)
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateProtocolTemplateDto,
  ): Promise<ProtocolTemplateDto> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' })
    const t = await this.repo.update(id, tenantId, dto)
    return this.toDto(t)
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' })
    if (existing.isSeeded) throw new BadRequestException('Cannot delete a system template')
    setAuditEntityName(existing.name)
    await this.repo.softDelete(id, tenantId)
  }
}
