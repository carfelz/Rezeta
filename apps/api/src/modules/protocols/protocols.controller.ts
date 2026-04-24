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
  CreateProtocolSchema,
  UpdateProtocolTitleSchema,
  SaveVersionSchema,
  ProtocolListQuerySchema,
  type CreateProtocolDto,
  type UpdateProtocolTitleDto,
  type SaveVersionDto,
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

@Controller('v1/protocols')
export class ProtocolsController {
  constructor(@Inject(ProtocolsService) private service: ProtocolsService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(ProtocolListQuerySchema)) query: ProtocolListQuery,
  ): Promise<ProtocolListItem[]> {
    return this.service.list(tenantId, query)
  }

  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ): Promise<ProtocolResponse> {
    return this.service.getById(id, tenantId)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateProtocolSchema))
  create(
    @Body() dto: CreateProtocolDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ProtocolResponse> {
    return this.service.create(tenantId, user.id, dto)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateProtocolTitleSchema))
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProtocolTitleDto,
    @TenantId() tenantId: string,
  ): Promise<{ id: string; title: string }> {
    return this.service.rename(id, tenantId, dto)
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(SaveVersionSchema))
  saveVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveVersionDto,
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
  listVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ): Promise<VersionListItem[]> {
    return this.service.listVersions(id, tenantId)
  }

  @Get(':id/versions/:versionId')
  getVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @TenantId() tenantId: string,
  ): Promise<VersionDetailResponse> {
    return this.service.getVersion(id, versionId, tenantId)
  }

  @Post(':id/versions/:versionId/restore')
  @HttpCode(HttpStatus.CREATED)
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
  addFavorite(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string): Promise<void> {
    return this.service.setFavorite(id, tenantId, true)
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFavorite(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ): Promise<void> {
    return this.service.setFavorite(id, tenantId, false)
  }
}
