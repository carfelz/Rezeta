import { Injectable, NotFoundException, Inject } from '@nestjs/common'
import type { Patient } from '@rezeta/db'
import { ErrorCode, type CreatePatientDto, type UpdatePatientDto } from '@rezeta/shared'
import { PatientsRepository, type PatientListParams } from './patients.repository.js'

@Injectable()
export class PatientsService {
  constructor(@Inject(PatientsRepository) private repo: PatientsRepository) {}

  async list(
    params: PatientListParams,
  ): Promise<{ items: Patient[]; hasMore: boolean; nextCursor?: string }> {
    const limit = params.limit ?? 50
    const rows = await this.repo.findMany({ ...params, limit })

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { items, hasMore, ...(nextCursor ? { nextCursor } : {}) }
  }

  async getById(id: string, tenantId: string): Promise<Patient> {
    const patient = await this.repo.findById(id, tenantId)
    if (!patient) {
      throw new NotFoundException({
        code: ErrorCode.PATIENT_NOT_FOUND,
        message: 'Patient not found',
      })
    }
    return patient
  }

  async create(tenantId: string, ownerId: string, dto: CreatePatientDto): Promise<Patient> {
    return this.repo.create(tenantId, ownerId, dto)
  }

  async update(id: string, tenantId: string, dto: UpdatePatientDto): Promise<Patient> {
    await this.getById(id, tenantId)
    return this.repo.update(id, tenantId, dto)
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.getById(id, tenantId)
    await this.repo.softDelete(id, tenantId)
  }
}
