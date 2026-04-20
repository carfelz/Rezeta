import { Injectable, NotFoundException, Inject } from '@nestjs/common'
import { ProtocolsRepository } from './protocols.repository.js'
import { ProtocolTemplatesRepository } from '../protocol-templates/protocol-templates.repository.js'
import { CreateProtocolDto } from '@rezeta/shared'

@Injectable()
export class ProtocolsService {
  constructor(
    @Inject(ProtocolsRepository) private repository: ProtocolsRepository,
    @Inject(ProtocolTemplatesRepository) private templatesRepository: ProtocolTemplatesRepository,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateProtocolDto) {
    let initialContent = dto.content

    // If a template is provided, initialize content from it
    if (dto.templateId) {
      const template = await this.templatesRepository.findById(dto.templateId)
      if (!template) {
        throw new NotFoundException('Template not found')
      }

      // Transform template schema to protocol content
      // 1. Snapshot the template version
      // 2. Strip template-only authoring fields (required, placeholder, etc.)
      const templateSchema = template.schema as any
      initialContent = {
        version: '1.0',
        template_version: templateSchema.version || '1.0',
        blocks: this.stripTemplateFields(templateSchema.blocks || []),
      }
    }

    return this.repository.create({
      tenantId,
      createdBy: userId,
      title: dto.title,
      templateId: dto.templateId,
      specialty: dto.specialty,
      tags: dto.tags,
      content: initialContent,
    })
  }

  async list(tenantId: string, userId?: string) {
    return this.repository.list(tenantId, userId)
  }

  async getById(id: string, tenantId: string) {
    const protocol = await this.repository.findById(id, tenantId)
    if (!protocol) {
      throw new NotFoundException('Protocol not found')
    }
    return protocol
  }

  /**
   * Recursively strips template-only fields like 'required' and 'placeholder'
   * to convert a ProtocolTemplate structure to a ProtocolContent structure.
   */
  private stripTemplateFields(blocks: any[]): any[] {
    return blocks.map((block) => {
      const { required, placeholder, placeholder_blocks, blocks: childBlocks, ...rest } = block

      const stripped: any = { ...rest }

      // If it's a section, process its blocks
      // In templates, 'placeholder_blocks' are used to seed the initial protocol 'blocks'
      const sourceBlocks = childBlocks || placeholder_blocks
      if (sourceBlocks) {
        stripped.blocks = this.stripTemplateFields(sourceBlocks)
      }

      return stripped
    })
  }
}
