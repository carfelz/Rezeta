import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  ParseUUIDPipe,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger'
import {
  CreateProtocolSchema,
  UpdateProtocolTitleSchema,
  SaveProtocolVersionSchema,
  ProtocolListQuerySchema,
  type CreateProtocolDto,
  type UpdateProtocolTitleDto,
  type SaveProtocolVersionDto,
  type ProtocolListQuery,
  type AuthUser,
  type ProtocolListItem,
  type ProtocolResponse,
  type VersionListItem,
  type VersionDetailResponse,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ProtocolsService } from './protocols.service.js'

const PROTOCOL_ID = '018e3f2a-2222-7000-8000-000000000001'
const TYPE_ID = '018e3f2a-3333-7000-8000-000000000001'
const VERSION_ID = '018e3f2a-4444-7000-8000-000000000001'

@ApiTags('Protocols')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/protocols')
export class ProtocolsController {
  constructor(@Inject(ProtocolsService) private service: ProtocolsService) {}

  @Get()
  @ApiOperation({
    summary: 'List protocols',
    description:
      'Returns all protocols for the tenant. Supports filtering by type and full-text search.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Full-text search on title.',
    example: 'anafilaxia',
  })
  @ApiQuery({
    name: 'typeId',
    required: false,
    description: 'Filter by protocol type UUID.',
    example: TYPE_ID,
  })
  @ApiQuery({
    name: 'favorites',
    required: false,
    description: 'If true, return only favorited protocols.',
    example: 'false',
  })
  @ApiResponse({ status: 200, description: 'Array of protocol list items.' })
  list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(ProtocolListQuerySchema)) query: ProtocolListQuery,
  ): Promise<ProtocolListItem[]> {
    return this.service.list(tenantId, query)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateProtocolSchema))
  @ApiOperation({
    summary: 'Create a protocol',
    description:
      'Creates a new protocol under the given type. The template behind the type seeds the initial version content.',
  })
  @ApiBody({
    description: 'Protocol creation payload.',
    schema: {
      type: 'object',
      required: ['title', 'typeId'],
      properties: {
        title: { type: 'string', example: 'Manejo de anafilaxia' },
        typeId: { type: 'string', format: 'uuid', example: TYPE_ID },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Protocol created.' })
  create(
    @Body() dto: CreateProtocolDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ProtocolResponse> {
    return this.service.create(tenantId, user.id, dto)
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a protocol by ID',
    description: 'Returns the protocol with its current version content.',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: PROTOCOL_ID })
  @ApiResponse({ status: 200, description: 'Protocol with current version content.' })
  @ApiResponse({ status: 404, description: 'Protocol not found.' })
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ): Promise<ProtocolResponse> {
    return this.service.getById(id, tenantId)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateProtocolTitleSchema))
  @ApiOperation({ summary: 'Rename a protocol' })
  @ApiParam({ name: 'id', format: 'uuid', example: PROTOCOL_ID })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title'],
      properties: { title: { type: 'string', example: 'Manejo de anafilaxia grave' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated id + title.' })
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProtocolTitleDto,
    @TenantId() tenantId: string,
  ): Promise<{ id: string; title: string }> {
    return this.service.rename(id, tenantId, dto)
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(SaveProtocolVersionSchema))
  @ApiOperation({
    summary: 'Save a new version',
    description:
      'Creates an immutable ProtocolVersion snapshot. Every save produces a new version row.',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: PROTOCOL_ID })
  @ApiBody({
    description: 'Version payload.',
    schema: {
      type: 'object',
      required: ['content'],
      properties: {
        changeSummary: {
          type: 'string',
          nullable: true,
          example: 'Actualizadas dosis de epinefrina según guías 2026.',
        },
        content: {
          type: 'object',
          description: 'Full protocol content (ProtocolVersion.content schema).',
          example: {
            version: '1.0',
            blocks: [
              {
                id: 'sec_indications',
                type: 'section',
                title: 'Indicaciones',
                blocks: [
                  {
                    id: 'blk_01',
                    type: 'text',
                    content:
                      'Reacción alérgica aguda con compromiso respiratorio o cardiovascular.',
                  },
                ],
              },
            ],
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'New version created.' })
  saveVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveProtocolVersionDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{
    id: string
    versionNumber: number
    changeSummary: string | null
    createdAt: string
  }> {
    return this.service.saveVersion(id, tenantId, user.id, dto)
  }

  @Get(':id/versions')
  @ApiOperation({
    summary: 'List versions',
    description: 'Returns version history for a protocol, newest first.',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: PROTOCOL_ID })
  @ApiResponse({ status: 200, description: 'Array of version summaries.' })
  listVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ): Promise<VersionListItem[]> {
    return this.service.listVersions(id, tenantId)
  }

  @Get(':id/versions/:versionId')
  @ApiOperation({ summary: 'Get a specific version' })
  @ApiParam({ name: 'id', format: 'uuid', example: PROTOCOL_ID })
  @ApiParam({ name: 'versionId', format: 'uuid', example: VERSION_ID })
  @ApiResponse({ status: 200, description: 'Full version content.' })
  getVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @TenantId() tenantId: string,
  ): Promise<VersionDetailResponse> {
    return this.service.getVersion(id, versionId, tenantId)
  }

  @Post(':id/versions/:versionId/restore')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Restore a version',
    description: 'Creates a new version from the content of a historical version. Non-destructive.',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: PROTOCOL_ID })
  @ApiParam({ name: 'versionId', format: 'uuid', example: VERSION_ID })
  @ApiResponse({ status: 201, description: 'New version created from restored content.' })
  restoreVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{
    id: string
    versionNumber: number
    changeSummary: string | null
    createdAt: string
  }> {
    return this.service.restoreVersion(id, versionId, tenantId, user.id)
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Add to favorites' })
  @ApiParam({ name: 'id', format: 'uuid', example: PROTOCOL_ID })
  @ApiResponse({ status: 204, description: 'Added to favorites.' })
  addFavorite(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string): Promise<void> {
    return this.service.setFavorite(id, tenantId, true)
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove from favorites' })
  @ApiParam({ name: 'id', format: 'uuid', example: PROTOCOL_ID })
  @ApiResponse({ status: 204, description: 'Removed from favorites.' })
  removeFavorite(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ): Promise<void> {
    return this.service.setFavorite(id, tenantId, false)
  }
}
