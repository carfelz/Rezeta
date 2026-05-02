import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import type { ScheduleBlock, ScheduleException } from '@rezeta/shared'
import type {
  CreateScheduleBlockDto,
  UpdateScheduleBlockDto,
  CreateScheduleExceptionDto,
  UpdateScheduleExceptionDto,
} from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import {
  SchedulesRepository,
  type BlockListParams,
  type ExceptionListParams,
} from './schedules.repository.js'

@Injectable()
export class SchedulesService {
  constructor(@Inject(SchedulesRepository) private repo: SchedulesRepository) {}

  // ── Blocks ──────────────────────────────────────────────────────────────────

  listBlocks(params: BlockListParams): Promise<ScheduleBlock[]> {
    return this.repo.findManyBlocks(params)
  }

  async createBlock(userId: string, dto: CreateScheduleBlockDto): Promise<ScheduleBlock> {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException({
        code: ErrorCode.SCHEDULE_BLOCK_TIME_INVALID,
        message: 'startTime must be before endTime',
      })
    }

    const overlapping = await this.repo.findOverlappingBlocks({
      userId,
      locationId: dto.locationId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
    })
    if (overlapping.length > 0) {
      throw new ConflictException({
        code: ErrorCode.SCHEDULE_BLOCK_OVERLAP,
        message: 'Time range overlaps with an existing schedule block',
      })
    }

    return this.repo.createBlock(userId, dto)
  }

  async updateBlock(
    id: string,
    userId: string,
    dto: UpdateScheduleBlockDto,
  ): Promise<ScheduleBlock> {
    const existing = await this.repo.findBlockById(id, userId)
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.SCHEDULE_BLOCK_NOT_FOUND,
        message: 'Schedule block not found',
      })
    }

    const startTime = dto.startTime ?? existing.startTime
    const endTime = dto.endTime ?? existing.endTime

    if (startTime >= endTime) {
      throw new BadRequestException({
        code: ErrorCode.SCHEDULE_BLOCK_TIME_INVALID,
        message: 'startTime must be before endTime',
      })
    }

    const locationId = dto.locationId ?? existing.locationId
    const dayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek

    const overlapping = await this.repo.findOverlappingBlocks({
      userId,
      locationId,
      dayOfWeek,
      startTime,
      endTime,
      excludeId: id,
    })
    if (overlapping.length > 0) {
      throw new ConflictException({
        code: ErrorCode.SCHEDULE_BLOCK_OVERLAP,
        message: 'Time range overlaps with an existing schedule block',
      })
    }

    return this.repo.updateBlock(id, userId, dto)
  }

  async deleteBlock(id: string, userId: string): Promise<void> {
    const existing = await this.repo.findBlockById(id, userId)
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.SCHEDULE_BLOCK_NOT_FOUND,
        message: 'Schedule block not found',
      })
    }
    await this.repo.deleteBlock(id, userId)
  }

  // ── Exceptions ──────────────────────────────────────────────────────────────

  listExceptions(params: ExceptionListParams): Promise<ScheduleException[]> {
    return this.repo.findManyExceptions(params)
  }

  async createException(
    userId: string,
    dto: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    const hasStart = dto.startTime != null
    const hasEnd = dto.endTime != null

    if (hasStart !== hasEnd) {
      throw new BadRequestException({
        code: ErrorCode.SCHEDULE_EXCEPTION_TIME_INVALID,
        message: 'Both startTime and endTime must be provided together',
      })
    }

    if (hasStart && hasEnd && dto.startTime! >= dto.endTime!) {
      throw new BadRequestException({
        code: ErrorCode.SCHEDULE_EXCEPTION_TIME_INVALID,
        message: 'startTime must be before endTime',
      })
    }

    return this.repo.createException(userId, dto)
  }

  async updateException(
    id: string,
    userId: string,
    dto: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    const existing = await this.repo.findExceptionById(id, userId)
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.SCHEDULE_EXCEPTION_NOT_FOUND,
        message: 'Schedule exception not found',
      })
    }

    const startTime = dto.startTime !== undefined ? dto.startTime : existing.startTime
    const endTime = dto.endTime !== undefined ? dto.endTime : existing.endTime

    const hasStart = startTime != null
    const hasEnd = endTime != null

    if (hasStart !== hasEnd) {
      throw new BadRequestException({
        code: ErrorCode.SCHEDULE_EXCEPTION_TIME_INVALID,
        message: 'Both startTime and endTime must be provided together',
      })
    }

    if (hasStart && hasEnd && startTime >= endTime) {
      throw new BadRequestException({
        code: ErrorCode.SCHEDULE_EXCEPTION_TIME_INVALID,
        message: 'startTime must be before endTime',
      })
    }

    return this.repo.updateException(id, userId, dto)
  }

  async deleteException(id: string, userId: string): Promise<void> {
    const existing = await this.repo.findExceptionById(id, userId)
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.SCHEDULE_EXCEPTION_NOT_FOUND,
        message: 'Schedule exception not found',
      })
    }
    await this.repo.deleteException(id, userId)
  }
}
