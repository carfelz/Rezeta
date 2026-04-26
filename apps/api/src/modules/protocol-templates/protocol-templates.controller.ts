import { Controller, Get, Post, Patch, Delete, Param, Body, Inject, HttpCode } from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger'
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

const TEMPLATE_ID = '018e3f2a-5555-7000-8000-000000000001'

const TEMPLATE_SCHEMA_EXAMPLE = {
  version: '1.0',
  metadata: {
    suggested_specialty: 'emergency_medicine',
    intended_use: 'Time-sensitive acute interventions',
  },
  blocks: [
    {
      id: 'sec_indications',
      type: 'section',
      title: 'Indicaciones',
      required: true,
      placeholder_blocks: [
        { type: 'text', placeholder: 'Criterios clínicos que activan este protocolo.' },
      ],
    },
    {
      id: 'sec_intervention',
      type: 'section',
      title: 'Intervención',
      required: true,
      placeholder_blocks: [
        {
          id: 'blk_int_meds',
          type: 'dosage_table',
          required: true,
          placeholder: 'Medicamentos de primera línea.',
        },
      ],
    },
  ],
}

@ApiTags('Protocol Templates')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/protocol-templates')
export class ProtocolTemplatesController {
  constructor(
    @Inject(ProtocolTemplatesService) private readonly service: ProtocolTemplatesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List templates',
    description: 'Returns all protocol templates owned by the tenant.',
  })
  @ApiResponse({ status: 200, description: 'Array of protocol templates.' })
  async getTemplates(@TenantId() tenantId: string): Promise<ProtocolTemplateDto[]> {
    return this.service.getTemplates(tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template by ID' })
  @ApiParam({ name: 'id', format: 'uuid', example: TEMPLATE_ID })
  @ApiResponse({ status: 200, description: 'Protocol template.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  async getTemplate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ): Promise<ProtocolTemplateDto> {
    return this.service.findById(id, tenantId)
  }

  @Post()
  @ApiOperation({
    summary: 'Create a template',
    description: 'Creates a new tenant-owned protocol template.',
  })
  @ApiBody({
    description: 'Template payload.',
    schema: {
      type: 'object',
      required: ['name', 'schema'],
      properties: {
        name: { type: 'string', example: 'Intervención de emergencia' },
        schema: {
          type: 'object',
          description: 'Template schema (see protocol-template-schema.md).',
          example: TEMPLATE_SCHEMA_EXAMPLE,
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Template created.' })
  @ApiResponse({ status: 409, description: 'Template name already exists for this tenant.' })
  async createTemplate(
    @Body(new ZodValidationPipe(CreateProtocolTemplateSchema)) body: unknown,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ProtocolTemplateDto> {
    const dto = body as CreateProtocolTemplateDto
    return this.service.create(tenantId, dto, user.id)
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a template',
    description:
      'Updates template name or schema. **Rejected if any ProtocolType references this template (lock rule).**',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: TEMPLATE_ID })
  @ApiBody({
    description: 'Fields to update (all optional).',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Intervención de emergencia v2' },
        schema: { type: 'object', description: 'Full replacement schema.' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated template.' })
  @ApiResponse({ status: 409, description: 'Template is locked by one or more ProtocolTypes.' })
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
  @ApiOperation({
    summary: 'Delete a template',
    description:
      'Soft-deletes a template. **Rejected if any ProtocolType references it (lock rule).**',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: TEMPLATE_ID })
  @ApiResponse({ status: 204, description: 'Template deleted.' })
  @ApiResponse({ status: 409, description: 'Template is locked by one or more ProtocolTypes.' })
  async deleteTemplate(@Param('id') id: string, @TenantId() tenantId: string): Promise<void> {
    return this.service.delete(id, tenantId)
  }
}
