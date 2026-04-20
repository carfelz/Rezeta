import { Injectable, Inject } from '@nestjs/common'
import type { Patient } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'
import type { CreatePatientDto, UpdatePatientDto } from '@rezeta/shared'

export interface PatientListParams {
  tenantId: string
  ownerId: string
  search?: string
  cursor?: string
  limit?: number
}

@Injectable()
export class PatientsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findMany({ tenantId, ownerId, search, cursor, limit = 50 }: PatientListParams): Promise<Patient[]> {
    return this.prisma.patient.findMany({
      where: {
        tenantId,
        ownerUserId: ownerId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { documentNumber: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
  }

  async findById(id: string, tenantId: string): Promise<Patient | null> {
    return this.prisma.patient.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
  }

  async create(tenantId: string, ownerId: string, dto: CreatePatientDto): Promise<Patient> {
    const nameParts = dto.fullName.trim().split(/\s+/)
    const lastName = nameParts.length > 1 ? nameParts.pop()! : ''
    const firstName = nameParts.join(' ')

    return this.prisma.patient.create({
      data: {
        tenantId,
        ownerUserId: ownerId,
        firstName,
        lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        sex: dto.sex ?? null,
        documentType: dto.documentType ?? null,
        documentNumber: dto.documentNumber ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        bloodType: dto.bloodType ?? null,
        allergies: dto.allergies ?? [],
        chronicConditions: dto.chronicConditions ?? [],
        notes: dto.notes ?? null,
      },
    })
  }

  async update(id: string, tenantId: string, dto: UpdatePatientDto): Promise<Patient> {
    const updates: Record<string, unknown> = { ...dto }

    if (dto.fullName) {
      const nameParts = dto.fullName.trim().split(/\s+/)
      updates['lastName'] = nameParts.length > 1 ? nameParts.pop() : ''
      updates['firstName'] = nameParts.join(' ')
      delete updates['fullName']
    }

    if (dto.dateOfBirth !== undefined) {
      updates['dateOfBirth'] = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null
    }

    return this.prisma.patient.update({
      where: { id, tenantId, deletedAt: null },
      data: updates,
    })
  }

  async softDelete(id: string, tenantId: string): Promise<Patient> {
    return this.prisma.patient.update({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  }
}
