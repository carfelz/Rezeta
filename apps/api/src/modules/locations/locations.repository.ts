import { Injectable, Inject } from '@nestjs/common'
import type { Location } from '@rezeta/shared'
import type { CreateLocationDto, UpdateLocationDto } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

type PrismaLocation = {
  id: string
  tenantId: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  isOwned: boolean
  notes: string | null
  commissionPercent: { toNumber(): number }
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  doctorLocations?: Array<{ consultationFee: { toNumber(): number } }>
}

function toLocation(row: PrismaLocation): Location {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    address: row.address,
    city: row.city,
    phone: row.phone,
    isOwned: row.isOwned,
    notes: row.notes,
    commissionPercent: row.commissionPercent.toNumber(),
    consultationFee: row.doctorLocations?.[0]?.consultationFee.toNumber() ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

@Injectable()
export class LocationsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findMany(tenantId: string, userId: string): Promise<Location[]> {
    const rows = await this.prisma.location.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        doctorLocations: {
          where: { userId },
          select: { consultationFee: true },
          take: 1,
        },
      },
      orderBy: [{ isOwned: 'desc' }, { name: 'asc' }],
    })
    return rows.map((r) => toLocation(r as PrismaLocation))
  }

  async findById(id: string, tenantId: string, userId?: string): Promise<Location | null> {
    const include = userId
      ? {
          doctorLocations: {
            where: { userId },
            select: { consultationFee: true },
            take: 1,
          },
        }
      : null
    const row = await this.prisma.location.findFirst({
      where: { id, tenantId, deletedAt: null },
      include,
    })
    return row ? toLocation(row as PrismaLocation) : null
  }

  async create(tenantId: string, userId: string, dto: CreateLocationDto): Promise<Location> {
    const row = await this.prisma.$transaction(async (tx) => {
      const location = await tx.location.create({
        data: {
          tenantId,
          name: dto.name,
          address: dto.address ?? null,
          city: dto.city ?? null,
          phone: dto.phone ?? null,
          isOwned: dto.isOwned ?? false,
          notes: dto.notes ?? null,
          commissionPercent: dto.commissionPercent ?? 0,
        },
        include: {
          doctorLocations: {
            where: { userId },
            select: { consultationFee: true },
            take: 1,
          },
        },
      })

      await tx.doctorLocation.create({
        data: {
          userId,
          locationId: location.id,
          consultationFee: dto.consultationFee ?? 0,
          commissionPct: dto.commissionPercent ?? 0,
        },
      })

      return location
    })
    // Re-fetch with doctorLocation data
    return (await this.findById(row.id, tenantId, userId))!
  }

  async update(
    id: string,
    tenantId: string,
    userId: string,
    dto: UpdateLocationDto,
  ): Promise<Location> {
    await this.prisma.$transaction(async (tx) => {
      await tx.location.update({
        where: { id, tenantId, deletedAt: null },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.isOwned !== undefined ? { isOwned: dto.isOwned } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.commissionPercent !== undefined
            ? { commissionPercent: dto.commissionPercent }
            : {}),
        },
      })

      if (dto.consultationFee !== undefined) {
        await tx.doctorLocation.upsert({
          where: { userId_locationId: { userId, locationId: id } },
          update: { consultationFee: dto.consultationFee },
          create: {
            userId,
            locationId: id,
            consultationFee: dto.consultationFee,
            commissionPct: 0,
          },
        })
      }
    })
    return (await this.findById(id, tenantId, userId))!
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.location.update({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  }

  async hasFutureAppointments(id: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.appointment.count({
      where: {
        locationId: id,
        tenantId,
        deletedAt: null,
        startsAt: { gt: new Date() },
        status: { not: 'cancelled' },
      },
    })
    return count > 0
  }
}
