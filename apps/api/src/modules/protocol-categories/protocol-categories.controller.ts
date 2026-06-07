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
import type { ProtocolCategory } from '@rezeta/db'
import {
  CreateProtocolCategorySchema,
  UpdateProtocolCategorySchema,
  type CreateProtocolCategoryDto,
  type UpdateProtocolCategoryDto,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { ProtocolCategoriesService } from './protocol-categories.service.js'

const CATEGORY_ID = '018e3f2a-6666-7000-8000-000000000001'

@ApiTags('Protocol Categories')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/protocol-categories')
export class ProtocolCategoriesController {
  constructor(
    @Inject(ProtocolCategoriesService) private readonly service: ProtocolCategoriesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List categories',
    description: 'Returns all protocol categories owned by the tenant.',
  })
  @ApiResponse({ status: 200, description: 'Array of protocol categories.' })
  findAll(@TenantId() tenantId: string): Promise<ProtocolCategory[]> {
    return this.service.findAll(tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiParam({ name: 'id', format: 'uuid', example: CATEGORY_ID })
  @ApiResponse({ status: 200, description: 'Protocol category.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  findOne(@TenantId() tenantId: string, @Param('id') id: string): Promise<ProtocolCategory> {
    return this.service.findById(tenantId, id)
  }

  @Post()
  @ApiOperation({
    summary: 'Create a category',
    description: 'Creates a new tenant-owned protocol category.',
  })
  @ApiBody({
    description: 'Category payload.',
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Emergencias' },
        color: { type: 'string', example: '#EF4444' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Category created.' })
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreateProtocolCategorySchema)) body: unknown,
  ): Promise<ProtocolCategory> {
    return this.service.create(tenantId, body as CreateProtocolCategoryDto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id', format: 'uuid', example: CATEGORY_ID })
  @ApiResponse({ status: 200, description: 'Category updated.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProtocolCategorySchema)) body: unknown,
  ): Promise<ProtocolCategory> {
    return this.service.update(tenantId, id, body as UpdateProtocolCategoryDto)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a category',
    description: 'Soft-deletes a tenant category. Seeded categories cannot be deleted.',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: CATEGORY_ID })
  @ApiResponse({ status: 204, description: 'Category deleted.' })
  @ApiResponse({ status: 400, description: 'Cannot delete a seeded category.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  async delete(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    await this.service.delete(tenantId, id)
  }
}
