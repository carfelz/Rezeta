import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common'
import {
  ErrorCode,
  type ProtocolTemplateDto,
  type CreateProtocolTemplateDto,
  type UpdateProtocolTemplateDto,
} from '@rezeta/shared'
import { setAuditEntityName } from '../../common/audit-log/audit-context.store.js'
import { ProtocolTemplatesRepository, type TemplateWithCategory } from './protocol-templates.repository.js'

@Injectable()
export class ProtocolTemplatesService {
  constructor(@Inject(ProtocolTemplatesRepository) private repo: ProtocolTemplatesRepository) {}

  private toDto(t: TemplateWithCategory): ProtocolTemplateDto {
    return {
      id: t.id,
      tenantId: t.tenantId,
      name: t.name,
      description: t.description,
      suggestedSpecialty: t.suggestedSpecialty,
      categoryId: t.categoryId,
      category: { id: t.category.id, name: t.category.name, color: t.category.color },
      schema: t.schema,
      isSeeded: t.isSeeded,
      isLocked: false,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }
  }

  async getTemplates(tenantId: string): Promise<ProtocolTemplateDto[]> {
    const templates = await this.repo.findAllWithLockInfo(tenantId)
    return templates.map((t) => this.toDto(t))
  }

  async findById(id: string, tenantId: string): Promise<ProtocolTemplateDto> {
    const t = await this.repo.findById(id, tenantId)
    if (!t) throw new NotFoundException({ code: ErrorCode.PROTOCOL_TEMPLATE_NOT_FOUND, message: 'Template not found' })
    return this.toDto(t)
  }

  async create(
    tenantId: string,
    dto: CreateProtocolTemplateDto,
    userId: string,
  ): Promise<ProtocolTemplateDto> {
    const category = await this.repo.findCategory(dto.categoryId, tenantId)
    if (!category) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_CATEGORY_NOT_FOUND,
        message: 'Category not found',
      })
    }
    const t = await this.repo.create(tenantId, dto, userId)
    return this.toDto(t)
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateProtocolTemplateDto,
  ): Promise<ProtocolTemplateDto> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException({ code: ErrorCode.PROTOCOL_TEMPLATE_NOT_FOUND, message: 'Template not found' })
    if (dto.categoryId !== undefined) {
      const category = await this.repo.findCategory(dto.categoryId, tenantId)
      if (!category) {
        throw new NotFoundException({
          code: ErrorCode.PROTOCOL_CATEGORY_NOT_FOUND,
          message: 'Category not found',
        })
      }
    }
    const t = await this.repo.update(id, tenantId, dto)
    return this.toDto(t)
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException({ code: ErrorCode.PROTOCOL_TEMPLATE_NOT_FOUND, message: 'Template not found' })
    if (existing.isSeeded) {
      throw new BadRequestException({
        code: ErrorCode.PROTOCOL_TEMPLATE_SEEDED_IMMUTABLE,
        message: 'Cannot delete a system template',
      })
    }
    setAuditEntityName(existing.name)
    await this.repo.softDelete(id, tenantId)
  }
}
