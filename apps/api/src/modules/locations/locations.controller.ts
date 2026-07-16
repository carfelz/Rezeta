import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  ParseUUIDPipe,
  UsePipes,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import type { Location, AuthUser } from '@rezeta/shared'
import { CreateLocationSchema, UpdateLocationSchema } from '@rezeta/shared'
import type { CreateLocationDto, UpdateLocationDto } from '@rezeta/shared'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { LocationsService } from './locations.service.js'

@ApiTags('Locations')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/locations')
export class LocationsController {
  constructor(@Inject(LocationsService) private service: LocationsService) {}

  @RequirePermission('locations', 'view')
  @Get()
  @ApiOperation({
    summary: 'List locations',
    description: "Returns all active locations for the authenticated doctor's tenant.",
  })
  @ApiResponse({ status: 200, description: 'Location list.' })
  list(@TenantId() tenantId: string, @CurrentUser() user: AuthUser): Promise<Location[]> {
    return this.service.list(tenantId, user.id)
  }

  @RequirePermission('locations', 'view')
  @Get(':id')
  @ApiOperation({ summary: 'Get a location by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Location record.' })
  @ApiResponse({ status: 404, description: 'Location not found.' })
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Location> {
    return this.service.getById(id, tenantId, user.id)
  }

  @RequirePermission('locations', 'manage')
  @Post()
  @UsePipes(new ZodValidationPipe(CreateLocationSchema))
  @ApiOperation({ summary: 'Create a location' })
  @ApiBody({ description: 'Location details.' })
  @ApiResponse({ status: 201, description: 'Location created.' })
  create(
    @Body() dto: CreateLocationDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Location> {
    return this.service.create(tenantId, user.id, dto)
  }

  @RequirePermission('locations', 'manage')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a location' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ description: 'Fields to update (all optional).' })
  @ApiResponse({ status: 200, description: 'Updated location.' })
  @ApiResponse({ status: 404, description: 'Location not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateLocationSchema)) dto: UpdateLocationDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Location> {
    return this.service.update(id, tenantId, user.id, dto)
  }

  @RequirePermission('locations', 'manage')
  @Patch(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive (soft-delete) a location' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Location archived.' })
  @ApiResponse({ status: 404, description: 'Location not found.' })
  @ApiResponse({ status: 409, description: 'Location has upcoming appointments.' })
  archive(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string): Promise<void> {
    return this.service.remove(id, tenantId)
  }

  @RequirePermission('locations', 'manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a location' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Location soft-deleted.' })
  @ApiResponse({ status: 404, description: 'Location not found.' })
  @ApiResponse({ status: 409, description: 'Location has upcoming appointments.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string): Promise<void> {
    return this.service.remove(id, tenantId)
  }
}
