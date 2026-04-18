import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ParseUUIDPipe,
} from '@nestjs/common'
import type { Patient } from '@rezeta/db'
import {
  CreatePatientSchema,
  UpdatePatientSchema,
  type CreatePatientDto,
  type UpdatePatientDto,
  type AuthUser,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { PatientsService } from './patients.service.js'

@Controller('v1/patients')
export class PatientsController {
  constructor(private service: PatientsService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<{ items: Patient[]; hasMore: boolean; nextCursor?: string }> {
    return this.service.list({
      tenantId,
      ownerId: user.id,
      ...(search ? { search } : {}),
      ...(cursor ? { cursor } : {}),
      ...(limit ? { limit: parseInt(limit, 10) } : {}),
    })
  }

  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ): Promise<Patient> {
    return this.service.getById(id, tenantId)
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreatePatientSchema))
  create(
    @Body() dto: CreatePatientDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Patient> {
    return this.service.create(tenantId, user.id, dto)
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePatientSchema)) dto: UpdatePatientDto,
    @TenantId() tenantId: string,
  ): Promise<Patient> {
    return this.service.update(id, tenantId, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ): Promise<void> {
    return this.service.remove(id, tenantId)
  }
}
