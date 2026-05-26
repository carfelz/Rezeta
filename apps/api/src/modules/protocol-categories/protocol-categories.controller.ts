import { Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe, HttpCode } from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger'
import type { ProtocolCategory } from '@rezeta/db'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ProtocolCategoriesService } from './protocol-categories.service.js'
import {
  CreateProtocolCategorySchema,
  UpdateProtocolCategorySchema,
  type CreateProtocolCategoryDto,
  type UpdateProtocolCategoryDto,
} from '@rezeta/shared'

@ApiTags('Protocol Categories')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/protocol-categories')
export class ProtocolCategoriesController {
  constructor(private readonly service: ProtocolCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List protocol categories' })
  @ApiResponse({ status: 200, description: 'Array of protocol categories.' })
  findAll(@TenantId() tenantId: string): Promise<ProtocolCategory[]> {
    return this.service.findAll(tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a protocol category by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Protocol category.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  findOne(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string): Promise<ProtocolCategory> {
    return this.service.findById(tenantId, id)
  }

  @Post()
  @ApiOperation({ summary: 'Create a protocol category' })
  @ApiResponse({ status: 201, description: 'Category created.' })
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreateProtocolCategorySchema)) dto: CreateProtocolCategoryDto,
  ): Promise<ProtocolCategory> {
    return this.service.create(tenantId, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a protocol category' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Category updated.' })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateProtocolCategorySchema)) dto: UpdateProtocolCategoryDto,
  ): Promise<ProtocolCategory> {
    return this.service.update(tenantId, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a protocol category' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Category deleted.' })
  async delete(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.delete(tenantId, id)
  }
}
