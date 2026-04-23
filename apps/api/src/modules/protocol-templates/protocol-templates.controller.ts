import { Controller, Get, Post, Patch, Delete, Param, Body, Inject, HttpCode } from '@nestjs/common'
import type {
  ProtocolTemplateDto,
  AuthUser,
  CreateProtocolTemplateDto,
  UpdateProtocolTemplateDto,
} from '@rezeta/shared'
import { CreateProtocolTemplateSchema, UpdateProtocolTemplateSchema } from '@rezeta/shared'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { ProtocolTemplatesService } from './protocol-templates.service.js'

@Controller('v1/protocol-templates')
export class ProtocolTemplatesController {
  constructor(
    @Inject(ProtocolTemplatesService) private readonly service: ProtocolTemplatesService,
  ) {}

  @Get()
  async getTemplates(@TenantId() tenantId: string): Promise<ProtocolTemplateDto[]> {
    return this.service.getTemplates(tenantId)
  }

  @Get(':id')
  async getTemplate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ): Promise<ProtocolTemplateDto> {
    return this.service.findById(id, tenantId)
  }

  @Post()
  async createTemplate(
    @Body(new ZodValidationPipe(CreateProtocolTemplateSchema)) body: unknown,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ProtocolTemplateDto> {
    const dto = body as CreateProtocolTemplateDto
    return this.service.create(tenantId, dto, user.id)
  }

  @Patch(':id')
  async updateTemplate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProtocolTemplateSchema)) body: unknown,
    @TenantId() tenantId: string,
  ): Promise<ProtocolTemplateDto> {
    const dto = body as UpdateProtocolTemplateDto
    return this.service.update(id, tenantId, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteTemplate(@Param('id') id: string, @TenantId() tenantId: string): Promise<void> {
    return this.service.delete(id, tenantId)
  }
}
