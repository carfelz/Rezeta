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
import type { ProtocolTypeDto, CreateProtocolTypeDto, UpdateProtocolTypeDto } from '@rezeta/shared'
import { CreateProtocolTypeSchema, UpdateProtocolTypeSchema } from '@rezeta/shared'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { ProtocolTypesService } from './protocol-types.service.js'

const TYPE_ID = '018e3f2a-3333-7000-8000-000000000001'
const TEMPLATE_ID = '018e3f2a-5555-7000-8000-000000000001'

@ApiTags('Protocol Types')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/protocol-types')
export class ProtocolTypesController {
  constructor(@Inject(ProtocolTypesService) private readonly service: ProtocolTypesService) {}

  @Get()
  @ApiOperation({
    summary: 'List protocol types',
    description: 'Returns all protocol types for the tenant.',
  })
  @ApiResponse({ status: 200, description: 'Array of protocol types.' })
  async getTypes(@TenantId() tenantId: string): Promise<ProtocolTypeDto[]> {
    return this.service.getTypes(tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a protocol type by ID' })
  @ApiParam({ name: 'id', format: 'uuid', example: TYPE_ID })
  @ApiResponse({ status: 200, description: 'Protocol type.' })
  @ApiResponse({ status: 404, description: 'Type not found.' })
  async getType(@Param('id') id: string, @TenantId() tenantId: string): Promise<ProtocolTypeDto> {
    return this.service.findById(id, tenantId)
  }

  @Post()
  @ApiOperation({
    summary: 'Create a protocol type',
    description:
      'Creates a type pointing at an existing template. `templateId` is immutable after creation.',
  })
  @ApiBody({
    description: 'Type creation payload.',
    schema: {
      type: 'object',
      required: ['name', 'templateId'],
      properties: {
        name: { type: 'string', example: 'Emergencia' },
        templateId: { type: 'string', format: 'uuid', example: TEMPLATE_ID },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Protocol type created.' })
  @ApiResponse({ status: 409, description: 'Type name already exists for this tenant.' })
  async createType(
    @Body(new ZodValidationPipe(CreateProtocolTypeSchema)) body: unknown,
    @TenantId() tenantId: string,
  ): Promise<ProtocolTypeDto> {
    const dto = body as CreateProtocolTypeDto
    return this.service.create(tenantId, dto)
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Rename a protocol type',
    description:
      'Renames the type. Template reassignment is not allowed. Renaming is always permitted regardless of lock state.',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: TYPE_ID })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string', example: 'Urgencias' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated protocol type.' })
  async updateType(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProtocolTypeSchema)) body: unknown,
    @TenantId() tenantId: string,
  ): Promise<ProtocolTypeDto> {
    const dto = body as UpdateProtocolTypeDto
    return this.service.update(id, tenantId, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a protocol type',
    description: 'Soft-deletes a type. **Rejected if any Protocol references it (lock rule).**',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: TYPE_ID })
  @ApiResponse({ status: 204, description: 'Type deleted.' })
  @ApiResponse({ status: 409, description: 'Type is locked by one or more Protocols.' })
  async deleteType(@Param('id') id: string, @TenantId() tenantId: string): Promise<void> {
    return this.service.delete(id, tenantId)
  }
}
