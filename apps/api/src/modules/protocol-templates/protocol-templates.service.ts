import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common'
import type {
  ProtocolTemplateDto,
  CreateProtocolTemplateDto,
  UpdateProtocolTemplateDto,
} from '@rezeta/shared'
import { ProtocolTemplatesRepository } from './protocol-templates.repository.js'

@Injectable()
export class ProtocolTemplatesService {
  constructor(@Inject(ProtocolTemplatesRepository) private repo: ProtocolTemplatesRepository) {}

  private toDto(
    t: Awaited<ReturnType<ProtocolTemplatesRepository['findById']>>,
  ): ProtocolTemplateDto {
    if (!t) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' })
    const blockingTypeIds = t.protocolTypes.map((pt) => pt.id)
    const isLocked = blockingTypeIds.length > 0
    return {
      id: t.id,
      tenantId: t.tenantId,
      name: t.name,
      description: t.description,
      suggestedSpecialty: t.suggestedSpecialty,
      schema: t.schema,
      isSeeded: t.isSeeded,
      isLocked,
      blockingTypeIds: isLocked ? blockingTypeIds : [],
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
    return this.toDto(t)
  }

  async create(
    tenantId: string,
    dto: CreateProtocolTemplateDto,
    userId: string,
  ): Promise<ProtocolTemplateDto> {
    const t = await this.repo.create(tenantId, dto, userId)
    return {
      id: t.id,
      tenantId: t.tenantId,
      name: t.name,
      description: t.description,
      suggestedSpecialty: t.suggestedSpecialty,
      schema: t.schema,
      isSeeded: t.isSeeded,
      isLocked: false,
      blockingTypeIds: [],
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateProtocolTemplateDto,
  ): Promise<ProtocolTemplateDto> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' })

    const isLocked = existing.protocolTypes.length > 0
    if (isLocked) {
      throw new ConflictException({
        code: 'TEMPLATE_LOCKED',
        message: 'Template cannot be edited while protocol types reference it.',
        blockingTypeIds: existing.protocolTypes.map((pt) => pt.id),
      })
    }

    const t = await this.repo.update(id, tenantId, dto)
    return {
      id: t.id,
      tenantId: t.tenantId,
      name: t.name,
      description: t.description,
      suggestedSpecialty: t.suggestedSpecialty,
      schema: t.schema,
      isSeeded: t.isSeeded,
      isLocked: false,
      blockingTypeIds: [],
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' })

    const isLocked = existing.protocolTypes.length > 0
    if (isLocked) {
      throw new ConflictException({
        code: 'TEMPLATE_LOCKED',
        message: 'Template cannot be deleted while protocol types reference it.',
        blockingTypeIds: existing.protocolTypes.map((pt) => pt.id),
      })
    }

    await this.repo.softDelete(id, tenantId)
  }
}
