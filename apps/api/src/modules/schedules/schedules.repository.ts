import { Injectable, Inject } from '@nestjs/common'
import type { ScheduleBlock, ScheduleException } from '@rezeta/shared'
import type {
  CreateScheduleBlockDto,
  UpdateScheduleBlockDto,
  CreateScheduleExceptionDto,
  UpdateScheduleExceptionDto,
} from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

type PrismaBlock = {
  id: string
  userId: string
  locationId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  slotDurationMin: number
  createdAt: Date
  location: { name: string }
}

type PrismaException = {
  id: string
  userId: string
  locationId: string
  date: Date
  type: string
  startTime: string | null
  endTime: string | null
  reason: string | null
  createdAt: Date
  location: { name: string }
}

function toBlock(row: PrismaBlock): ScheduleBlock {
  return {
    id: row.id,
    userId: row.userId,
    locationId: row.locationId,
    locationName: row.location.name,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    slotDurationMin: row.slotDurationMin,
    createdAt: row.createdAt.toISOString(),
  }
}

function toException(row: PrismaException): ScheduleException {
  return {
    id: row.id,
    userId: row.userId,
    locationId: row.locationId,
    locationName: row.location.name,
    date: row.date.toISOString().split('T')[0] ?? '',
    type: row.type as ScheduleException['type'],
    startTime: row.startTime,
    endTime: row.endTime,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  }
}

const LOCATION_INCLUDE = { location: { select: { name: true } } } as const

export interface BlockListParams {
  userId: string
  locationId?: string
}

export interface ExceptionListParams {
  userId: string
  locationId?: string
  from?: string
  to?: string
}

export interface OverlapParams {
  userId: string
  locationId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  excludeId?: string
}

@Injectable()
export class SchedulesRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findManyBlocks(params: BlockListParams): Promise<ScheduleBlock[]> {
    const rows = await this.prisma.scheduleBlock.findMany({
      where: {
        userId: params.userId,
        ...(params.locationId ? { locationId: params.locationId } : {}),
      },
      include: LOCATION_INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
    return rows.map((r) => toBlock(r as PrismaBlock))
  }

  async findBlockById(id: string, userId: string): Promise<ScheduleBlock | null> {
    const row = await this.prisma.scheduleBlock.findFirst({
      where: { id, userId },
      include: LOCATION_INCLUDE,
    })
    return row ? toBlock(row as PrismaBlock) : null
  }

  async createBlock(userId: string, dto: CreateScheduleBlockDto): Promise<ScheduleBlock> {
    const row = await this.prisma.scheduleBlock.create({
      data: {
        userId,
        locationId: dto.locationId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        slotDurationMin: dto.slotDurationMin ?? 30,
      },
      include: LOCATION_INCLUDE,
    })
    return toBlock(row as PrismaBlock)
  }

  async updateBlock(
    id: string,
    userId: string,
    dto: UpdateScheduleBlockDto,
  ): Promise<ScheduleBlock> {
    const row = await this.prisma.scheduleBlock.update({
      where: { id, userId },
      data: {
        ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        ...(dto.dayOfWeek !== undefined ? { dayOfWeek: dto.dayOfWeek } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.slotDurationMin !== undefined ? { slotDurationMin: dto.slotDurationMin } : {}),
      },
      include: LOCATION_INCLUDE,
    })
    return toBlock(row as PrismaBlock)
  }

  async deleteBlock(id: string, userId: string): Promise<void> {
    await this.prisma.scheduleBlock.delete({ where: { id, userId } })
  }

  async findOverlappingBlocks(params: OverlapParams): Promise<ScheduleBlock[]> {
    const rows = await this.prisma.scheduleBlock.findMany({
      where: {
        userId: params.userId,
        locationId: params.locationId,
        dayOfWeek: params.dayOfWeek,
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        AND: [{ startTime: { lt: params.endTime } }, { endTime: { gt: params.startTime } }],
      },
      include: LOCATION_INCLUDE,
    })
    return rows.map((r) => toBlock(r as PrismaBlock))
  }

  async findManyExceptions(params: ExceptionListParams): Promise<ScheduleException[]> {
    const rows = await this.prisma.scheduleException.findMany({
      where: {
        userId: params.userId,
        ...(params.locationId ? { locationId: params.locationId } : {}),
        ...(params.from || params.to
          ? {
              date: {
                ...(params.from ? { gte: new Date(params.from) } : {}),
                ...(params.to ? { lte: new Date(params.to) } : {}),
              },
            }
          : {}),
      },
      include: LOCATION_INCLUDE,
      orderBy: { date: 'asc' },
    })
    return rows.map((r) => toException(r as PrismaException))
  }

  async findExceptionById(id: string, userId: string): Promise<ScheduleException | null> {
    const row = await this.prisma.scheduleException.findFirst({
      where: { id, userId },
      include: LOCATION_INCLUDE,
    })
    return row ? toException(row as PrismaException) : null
  }

  async createException(
    userId: string,
    dto: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    const row = await this.prisma.scheduleException.create({
      data: {
        userId,
        locationId: dto.locationId,
        date: new Date(dto.date),
        type: dto.type,
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        reason: dto.reason ?? null,
      },
      include: LOCATION_INCLUDE,
    })
    return toException(row as PrismaException)
  }

  async updateException(
    id: string,
    userId: string,
    dto: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    const row = await this.prisma.scheduleException.update({
      where: { id, userId },
      data: {
        ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      },
      include: LOCATION_INCLUDE,
    })
    return toException(row as PrismaException)
  }

  async deleteException(id: string, userId: string): Promise<void> {
    await this.prisma.scheduleException.delete({ where: { id, userId } })
  }
}
