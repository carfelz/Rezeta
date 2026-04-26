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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

@Injectable()
export class LocationsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findMany(tenantId: string): Promise<Location[]> {
    const rows = await this.prisma.location.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ isOwned: 'desc' }, { name: 'asc' }],
    })
    return rows.map((r) => toLocation(r as PrismaLocation))
  }

  async findById(id: string, tenantId: string): Promise<Location | null> {
    const row = await this.prisma.location.findFirst({
      where: { id, tenantId, deletedAt: null },
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
      })

      await tx.doctorLocation.create({
        data: {
          userId,
          locationId: location.id,
          consultationFee: 0,
          commissionPct: dto.commissionPercent ?? 0,
        },
      })

      return location
    })
    return toLocation(row as PrismaLocation)
  }

  async update(id: string, tenantId: string, dto: UpdateLocationDto): Promise<Location> {
    const row = await this.prisma.location.update({
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
    return toLocation(row as PrismaLocation)
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
