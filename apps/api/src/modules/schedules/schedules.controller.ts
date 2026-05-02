import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
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
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger'
import type { ScheduleBlock, ScheduleException, AuthUser } from '@rezeta/shared'
import {
  CreateScheduleBlockSchema,
  UpdateScheduleBlockSchema,
  CreateScheduleExceptionSchema,
  UpdateScheduleExceptionSchema,
  type CreateScheduleBlockDto,
  type UpdateScheduleBlockDto,
  type CreateScheduleExceptionDto,
  type UpdateScheduleExceptionDto,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { SchedulesService } from './schedules.service.js'

@ApiTags('Schedules')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/schedules')
export class SchedulesController {
  constructor(@Inject(SchedulesService) private svc: SchedulesService) {}

  // ── Blocks ──────────────────────────────────────────────────────────────────

  @Get('blocks')
  @ApiOperation({ summary: 'List schedule blocks for the authenticated doctor' })
  @ApiQuery({ name: 'locationId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Array of schedule blocks' })
  listBlocks(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
  ): Promise<ScheduleBlock[]> {
    return this.svc.listBlocks({
      userId: user.id,
      ...(locationId ? { locationId } : {}),
    })
  }

  @Post('blocks')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateScheduleBlockSchema))
  @ApiOperation({ summary: 'Create a schedule block' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'SCHEDULE_BLOCK_TIME_INVALID' })
  @ApiResponse({ status: 409, description: 'SCHEDULE_BLOCK_OVERLAP' })
  createBlock(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateScheduleBlockDto,
  ): Promise<ScheduleBlock> {
    return this.svc.createBlock(user.id, dto)
  }

  @Patch('blocks/:id')
  @UsePipes(new ZodValidationPipe(UpdateScheduleBlockSchema))
  @ApiOperation({ summary: 'Update a schedule block' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'SCHEDULE_BLOCK_TIME_INVALID' })
  @ApiResponse({ status: 404, description: 'SCHEDULE_BLOCK_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'SCHEDULE_BLOCK_OVERLAP' })
  updateBlock(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleBlockDto,
  ): Promise<ScheduleBlock> {
    return this.svc.updateBlock(id, user.id, dto)
  }

  @Delete('blocks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a schedule block' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'SCHEDULE_BLOCK_NOT_FOUND' })
  async deleteBlock(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.svc.deleteBlock(id, user.id)
  }

  // ── Exceptions ──────────────────────────────────────────────────────────────

  @Get('exceptions')
  @ApiOperation({ summary: 'List schedule exceptions for the authenticated doctor' })
  @ApiQuery({ name: 'locationId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Array of schedule exceptions' })
  listExceptions(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ScheduleException[]> {
    return this.svc.listExceptions({
      userId: user.id,
      ...(locationId ? { locationId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    })
  }

  @Post('exceptions')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateScheduleExceptionSchema))
  @ApiOperation({ summary: 'Create a schedule exception' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'SCHEDULE_EXCEPTION_TIME_INVALID' })
  createException(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    return this.svc.createException(user.id, dto)
  }

  @Patch('exceptions/:id')
  @UsePipes(new ZodValidationPipe(UpdateScheduleExceptionSchema))
  @ApiOperation({ summary: 'Update a schedule exception' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'SCHEDULE_EXCEPTION_TIME_INVALID' })
  @ApiResponse({ status: 404, description: 'SCHEDULE_EXCEPTION_NOT_FOUND' })
  updateException(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    return this.svc.updateException(id, user.id, dto)
  }

  @Delete('exceptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a schedule exception' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'SCHEDULE_EXCEPTION_NOT_FOUND' })
  async deleteException(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.svc.deleteException(id, user.id)
  }
}
