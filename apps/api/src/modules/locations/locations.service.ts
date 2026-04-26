import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common'
import type { Location } from '@rezeta/shared'
import type { CreateLocationDto, UpdateLocationDto } from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import { LocationsRepository } from './locations.repository.js'

@Injectable()
export class LocationsService {
  constructor(@Inject(LocationsRepository) private repo: LocationsRepository) {}

  list(tenantId: string): Promise<Location[]> {
    return this.repo.findMany(tenantId)
  }

  async getById(id: string, tenantId: string): Promise<Location> {
    const location = await this.repo.findById(id, tenantId)
    if (!location) {
      throw new NotFoundException({
        code: ErrorCode.LOCATION_NOT_FOUND,
        message: 'Location not found',
      })
    }
    return location
  }

  async create(tenantId: string, userId: string, dto: CreateLocationDto): Promise<Location> {
    return this.repo.create(tenantId, userId, dto)
  }

  async update(id: string, tenantId: string, dto: UpdateLocationDto): Promise<Location> {
    await this.getById(id, tenantId)
    return this.repo.update(id, tenantId, dto)
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.getById(id, tenantId)
    const hasFuture = await this.repo.hasFutureAppointments(id, tenantId)
    if (hasFuture) {
      throw new ConflictException({
        code: ErrorCode.LOCATION_HAS_FUTURE_APPOINTMENTS,
        message: 'Cannot delete a location with upcoming appointments',
      })
    }
    await this.repo.softDelete(id, tenantId)
  }
}
