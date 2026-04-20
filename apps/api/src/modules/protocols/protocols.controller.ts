import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UsePipes,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common'
import {
  CreateProtocolSchema,
  type CreateProtocolDto,
  type AuthUser,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ProtocolsService } from './protocols.service.js'

@Controller('v1/protocols')
export class ProtocolsController {
  constructor(
    @Inject(ProtocolsService) private service: ProtocolsService,
  ) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.list(tenantId, user.id)
  }

  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.getById(id, tenantId)
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateProtocolSchema))
  create(
    @Body() dto: CreateProtocolDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(tenantId, user.id, dto)
  }
}
