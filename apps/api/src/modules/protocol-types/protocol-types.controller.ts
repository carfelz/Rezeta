import { Controller, Get, Post, Patch, Delete, Param, Body, Inject, HttpCode } from '@nestjs/common'
import type { ProtocolTypeDto, CreateProtocolTypeDto, UpdateProtocolTypeDto } from '@rezeta/shared'
import { CreateProtocolTypeSchema, UpdateProtocolTypeSchema } from '@rezeta/shared'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { ProtocolTypesService } from './protocol-types.service.js'

@Controller('v1/protocol-types')
export class ProtocolTypesController {
  constructor(@Inject(ProtocolTypesService) private readonly service: ProtocolTypesService) {}

  @Get()
  async getTypes(@TenantId() tenantId: string): Promise<ProtocolTypeDto[]> {
    return this.service.getTypes(tenantId)
  }

  @Get(':id')
  async getType(@Param('id') id: string, @TenantId() tenantId: string): Promise<ProtocolTypeDto> {
    return this.service.findById(id, tenantId)
  }

  @Post()
  async createType(
    @Body(new ZodValidationPipe(CreateProtocolTypeSchema)) body: unknown,
    @TenantId() tenantId: string,
  ): Promise<ProtocolTypeDto> {
    const dto = body as CreateProtocolTypeDto
    return this.service.create(tenantId, dto)
  }

  @Patch(':id')
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
  async deleteType(@Param('id') id: string, @TenantId() tenantId: string): Promise<void> {
    return this.service.delete(id, tenantId)
  }
}
