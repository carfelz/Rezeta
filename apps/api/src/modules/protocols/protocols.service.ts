import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common'
import { ProtocolsRepository } from './protocols.repository.js'
import { ProtocolTemplatesRepository } from '../protocol-templates/protocol-templates.repository.js'
import {
  type CreateProtocolDto,
  type UpdateProtocolTitleDto,
  type SaveVersionDto,
  type ProtocolListItem,
  type ProtocolResponse,
  ProtocolContentSchema,
  buildInitialContentFromTemplate,
  ErrorCode,
} from '@rezeta/shared'

@Injectable()
export class ProtocolsService {
  constructor(
    @Inject(ProtocolsRepository) private repository: ProtocolsRepository,
    @Inject(ProtocolTemplatesRepository) private templatesRepository: ProtocolTemplatesRepository,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateProtocolDto): Promise<ProtocolResponse> {
    let content: unknown
    let defaultTitle = 'Protocolo sin título'
    let templateName: string | null = null
    let templateSchema: unknown = null

    if (dto.templateId) {
      const template = await this.templatesRepository.findById(dto.templateId, tenantId)
      if (!template) {
        throw new NotFoundException({
          code: ErrorCode.PROTOCOL_TEMPLATE_NOT_FOUND,
          message: 'Protocol template not found or not accessible',
        })
      }
      defaultTitle = `${template.name} (nuevo)`
      templateName = template.name
      templateSchema = template.schema
      content = buildInitialContentFromTemplate(template.schema as unknown as Parameters<typeof buildInitialContentFromTemplate>[0])
    } else {
      content = { version: '1.0', blocks: [] }
    }

    const title = dto.title?.trim() || defaultTitle
    const { protocol, version } = await this.repository.create({
      tenantId,
      title,
      createdBy: userId,
      templateId: dto.templateId ?? null,
      specialty: dto.specialty ?? null,
      tags: dto.tags ?? [],
      content,
    })

    return this.formatResponse({ ...protocol, currentVersion: version, template: protocol.template ?? null })
  }

  async list(tenantId: string): Promise<ProtocolListItem[]> {
    const protocols = await this.repository.list(tenantId)
    return protocols.map((p) => ({
      id: p.id,
      title: p.title,
      templateId: p.templateId,
      templateName: p.template?.name ?? null,
      status: p.status,
      isFavorite: p.isFavorite,
      updatedAt: p.updatedAt.toISOString(),
      currentVersionNumber: p.versions[0]?.versionNumber ?? null,
    }))
  }

  async getById(id: string, tenantId: string): Promise<ProtocolResponse> {
    const protocol = await this.repository.findById(id, tenantId)
    if (!protocol) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }
    return this.formatResponse(protocol)
  }

  async rename(id: string, tenantId: string, dto: UpdateProtocolTitleDto): Promise<{ id: string; title: string }> {
    const updated = await this.repository.rename(id, tenantId, dto.title)
    if (!updated) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }
    return { id: updated.id, title: updated.title }
  }

  async saveVersion(
    protocolId: string,
    tenantId: string,
    userId: string,
    dto: SaveVersionDto,
  ) {
    // Validate content passes schema
    const parseResult = ProtocolContentSchema.safeParse(dto.content)
    if (!parseResult.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Protocol content failed schema validation',
        details: parseResult.error.flatten(),
      })
    }

    // Validate required blocks if protocol has a template
    const protocol = await this.repository.findById(protocolId, tenantId)
    if (!protocol) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }

    if (protocol.template) {
      this.validateRequiredBlocks(
        protocol.template.schema as unknown as { blocks: Array<{ id?: string; required?: boolean; type: string; placeholder_blocks?: Array<{ id?: string; required?: boolean; type: string }> }> },
        dto.content.blocks as Array<{ id: string }>,
      )
    }

    const version = await this.repository.saveVersion({
      protocolId,
      tenantId,
      createdBy: userId,
      content: dto.content,
      changeSummary: dto.changeSummary ?? null,
    })

    if (!version) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }

    return {
      id: version.id,
      versionNumber: version.versionNumber,
      changeSummary: version.changeSummary,
      createdAt: version.createdAt.toISOString(),
    }
  }

  private validateRequiredBlocks(
    templateSchema: { blocks: Array<{ id?: string; required?: boolean; type: string; placeholder_blocks?: Array<{ id?: string; required?: boolean; type: string }> }> },
    contentBlocks: Array<{ id: string }>,
  ): void {
    const contentIds = new Set(this.collectAllIds(contentBlocks))

    for (const block of templateSchema.blocks) {
      if (!block.required) continue

      if (block.id && !contentIds.has(block.id)) {
        throw new BadRequestException({
          code: ErrorCode.PROTOCOL_REQUIRED_BLOCK_MISSING,
          message: `Required block '${block.id}' is missing from protocol content`,
        })
      }

      // Check required blocks inside placeholder_blocks of a required section
      if (block.type === 'section' && block.placeholder_blocks) {
        for (const child of block.placeholder_blocks) {
          if (child.required && child.id && !contentIds.has(child.id)) {
            throw new BadRequestException({
              code: ErrorCode.PROTOCOL_REQUIRED_BLOCK_MISSING,
              message: `Required block '${child.id}' is missing from protocol content`,
            })
          }
        }
      }
    }
  }

  private collectAllIds(blocks: Array<{ id: string; blocks?: Array<{ id: string }> }>): string[] {
    const ids: string[] = []
    for (const block of blocks) {
      ids.push(block.id)
      if (block.blocks) {
        ids.push(...this.collectAllIds(block.blocks))
      }
    }
    return ids
  }

  private formatResponse(protocol: {
    id: string
    title: string
    status: string
    isFavorite: boolean
    createdAt: Date
    updatedAt: Date
    templateId: string | null
    template?: { name: string; schema: unknown } | null
    currentVersion?: {
      id: string
      versionNumber: number
      content: unknown
      changeSummary: string | null
      createdAt: Date
    } | null
  }): ProtocolResponse {
    return {
      id: protocol.id,
      title: protocol.title,
      status: protocol.status,
      isFavorite: protocol.isFavorite,
      createdAt: protocol.createdAt.toISOString(),
      updatedAt: protocol.updatedAt.toISOString(),
      templateId: protocol.templateId,
      templateName: protocol.template?.name ?? null,
      templateSchema: protocol.template?.schema ?? null,
      currentVersion: protocol.currentVersion
        ? {
            id: protocol.currentVersion.id,
            versionNumber: protocol.currentVersion.versionNumber,
            content: protocol.currentVersion.content as ProtocolResponse['currentVersion'] extends { content: infer C } ? C : never,
            changeSummary: protocol.currentVersion.changeSummary,
            createdAt: protocol.currentVersion.createdAt.toISOString(),
          }
        : null,
    }
  }
}
