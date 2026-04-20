import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
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
  type CreateProtocolDto,
  type UpdateProtocolTitleDto,
  type SaveVersionDto,
  type AuthUser,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ProtocolsService } from './protocols.service.js'

@Controller('v1/protocols')
export class ProtocolsController {
  constructor(@Inject(ProtocolsService) private service: ProtocolsService) {}

  @Get()
  list(@TenantId() tenantId: string): Promise<ProtocolListItem[]> {
    return this.service.list(tenantId)
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
}
