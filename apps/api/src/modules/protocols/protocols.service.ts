import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common'
import { setAuditEntityName } from '../../common/audit-log/audit-context.store.js'
import { ProtocolsRepository } from './protocols.repository.js'
import { buildProtocolContentFromTemplate } from './template-to-content.js'
import {
  type CreateProtocolDto,
  type UpdateProtocolTitleDto,
  type SaveProtocolVersionDto,
  type ProtocolListItem,
  type ProtocolListQuery,
  type ProtocolResponse,
  type VersionListItem,
  type VersionDetailResponse,
  ProtocolContentSchema,
  ErrorCode,
} from '@rezeta/shared'

@Injectable()
export class ProtocolsService {
  constructor(
    @Inject(ProtocolsRepository) private repository: ProtocolsRepository,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateProtocolDto,
  ): Promise<ProtocolResponse> {
    const template = await this.repository.findTemplateForCreate(dto.templateId, tenantId)
    if (!template) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_TEMPLATE_NOT_FOUND,
        message: 'Template not found',
      })
    }

    const content = buildProtocolContentFromTemplate(template.schema)

    const createResult = await this.repository.create({
      tenantId,
      title: dto.title.trim(),
      createdBy: userId,
      templateId: template.id,
      categoryId: template.categoryId,
      tags: [],
      content,
    })
    const { protocol, version } = createResult

    return this.formatResponse({
      ...protocol,
      currentVersion: version,
      category: protocol.category,
    })
  }

  async list(
    tenantId: string,
    query: ProtocolListQuery = { favoritesOnly: false },
  ): Promise<ProtocolListItem[]> {
    const listFilters = {
      ...(query.search ? { search: query.search } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      favoritesOnly: query.favoritesOnly || false,
      ...(query.sort ? { sort: query.sort } : {}),
    }
    const protocols = await this.repository.list(tenantId, listFilters)
    return protocols.map((p) => {
      const latestVersion = p.versions[0] as { versionNumber: number; content: unknown } | undefined
      const content = (latestVersion?.content ?? null) as { blocks?: unknown[] } | null
      const blockCount = Array.isArray(content?.blocks) ? content.blocks.length : 0
      return {
        id: p.id,
        title: p.title,
        categoryId: p.category?.id ?? null,
        categoryName: p.category?.name ?? null,
        status: p.status,
        isFavorite: p.isFavorite,
        updatedAt: p.updatedAt.toISOString(),
        currentVersionNumber: latestVersion?.versionNumber ?? null,
        blockCount,
      }
    })
  }

  async setFavorite(id: string, tenantId: string, isFavorite: boolean): Promise<void> {
    const found = await this.repository.setFavorite(id, tenantId, isFavorite)
    if (!found) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }
  }

  async archive(id: string, tenantId: string): Promise<void> {
    const existing = await this.repository.findById(id, tenantId)
    if (existing) setAuditEntityName(existing.title)
    const found = await this.repository.archive(id, tenantId)
    if (!found) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }
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

  async rename(
    id: string,
    tenantId: string,
    dto: UpdateProtocolTitleDto,
  ): Promise<{ id: string; title: string }> {
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
    dto: SaveProtocolVersionDto,
  ): Promise<{
    id: string
    versionNumber: number
    changeSummary: string | null
    createdAt: string
  }> {
    const parseResult = ProtocolContentSchema.safeParse(dto.content)
    if (!parseResult.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Protocol content failed schema validation',
        details: parseResult.error.flatten(),
      })
    }

    const protocol = await this.repository.findById(protocolId, tenantId)
    if (!protocol) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }

    // Template schema validation not available without type relation (Plan 02 will restore this)
    const templateSchema = ({ blocks: [] }) as {
      blocks: Array<{
        id?: string
        required?: boolean
        type: string
        placeholder_blocks?: Array<{ id?: string; required?: boolean; type: string }>
      }>
    }
    this.validateRequiredBlocks(templateSchema, dto.content.blocks as Array<{ id: string }>)

    const version = await this.repository.saveVersion({
      protocolId,
      tenantId,
      createdBy: userId,
      content: dto.content,
      changeSummary: dto.changeSummary ?? null,
      publish: dto.publish,
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
    templateSchema: {
      blocks: Array<{
        id?: string
        required?: boolean
        type: string
        placeholder_blocks?: Array<{ id?: string; required?: boolean; type: string }>
      }>
    },
    contentBlocks: Array<{ id: string }>,
  ): void {
    const contentIds = new Set(this.collectAllIds(contentBlocks))

    // Template schema is always { blocks: [] } in schema-reset-v2.
    // This loop body is unreachable until Plan 02 restores ProtocolCategory.
    /* c8 ignore start */
    for (const block of templateSchema.blocks) {
      if (!block.required) continue

      if (block.id && !contentIds.has(block.id)) {
        throw new BadRequestException({
          code: ErrorCode.PROTOCOL_REQUIRED_BLOCK_MISSING,
          message: `Required block '${block.id}' is missing from protocol content`,
        })
      }

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
    /* c8 ignore end */
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

  async listVersions(protocolId: string, tenantId: string): Promise<VersionListItem[]> {
    const protocol = await this.repository.findById(protocolId, tenantId)
    if (!protocol) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }
    const versions = await this.repository.listVersions(protocolId, tenantId)
    return versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      changeSummary: v.changeSummary,
      createdAt: v.createdAt.toISOString(),
      isCurrent: v.isCurrent,
    }))
  }

  async getVersion(
    protocolId: string,
    versionId: string,
    tenantId: string,
  ): Promise<VersionDetailResponse> {
    const version = await this.repository.getVersion(protocolId, versionId, tenantId)
    if (!version) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Version not found',
      })
    }
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      content: version.content as unknown as VersionDetailResponse['content'],
      changeSummary: version.changeSummary,
      createdAt: version.createdAt.toISOString(),
    }
  }

  async restoreVersion(
    protocolId: string,
    versionId: string,
    tenantId: string,
    userId: string,
  ): Promise<{
    id: string
    versionNumber: number
    changeSummary: string | null
    createdAt: string
  }> {
    const version = await this.repository.getVersion(protocolId, versionId, tenantId)
    if (!version) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Version not found',
      })
    }

    const restored = await this.repository.saveVersion({
      protocolId,
      tenantId,
      createdBy: userId,
      content: version.content,
      changeSummary: `Restaurado desde v${version.versionNumber}`,
    })

    if (!restored) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }

    return {
      id: restored.id,
      versionNumber: restored.versionNumber,
      changeSummary: restored.changeSummary,
      createdAt: restored.createdAt.toISOString(),
    }
  }

  private formatResponse(protocol: {
    id: string
    title: string
    status: string
    isFavorite: boolean
    createdAt: Date
    updatedAt: Date
    categoryId?: string | null
    category?: { id: string; name: string } | null
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
      categoryId: protocol.category?.id ?? null,
      categoryName: protocol.category?.name ?? null,
      templateSchema: null,
      currentVersion: protocol.currentVersion
        ? {
            id: protocol.currentVersion.id,
            versionNumber: protocol.currentVersion.versionNumber,
            content: protocol.currentVersion.content as ProtocolResponse['currentVersion'] extends {
              content: infer C
            }
              ? C
              : never,
            changeSummary: protocol.currentVersion.changeSummary,
            createdAt: protocol.currentVersion.createdAt.toISOString(),
          }
        : null,
    }
  }
}
