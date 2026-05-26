import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'

// ProtocolType has been replaced by ProtocolCategory.
// This repository is retained as a stub for NestJS module compatibility.
// Full replacement will be done in the ProtocolCategory migration (Plan 02).

export type TypeWithDetails = {
  id: string
  tenantId: string
  templateId: string
  template: { id: string; name: string }
  name: string
  isSeeded: boolean
  isLocked: boolean
  _count: { protocols: number }
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class ProtocolTypesRepository {
  constructor(@Inject(PrismaService) private _prisma: PrismaService) {}

  findAll(_tenantId: string): Promise<TypeWithDetails[]> {
    return Promise.resolve([])
  }

  findByIdWithTemplate(
    _id: string,
    _tenantId: string,
  ): Promise<(TypeWithDetails & { template: TypeWithDetails['template'] & { schema: unknown } }) | null> {
    return Promise.resolve(null)
  }

  findById(_id: string, _tenantId: string): Promise<TypeWithDetails | null> {
    return Promise.resolve(null)
  }

  existsByName(_name: string, _tenantId: string, _excludeId?: string): Promise<boolean> {
    return Promise.resolve(false)
  }

  async templateBelongsToTenant(templateId: string, tenantId: string): Promise<boolean> {
    const count = await this._prisma.protocolTemplate.count({
      where: { id: templateId, tenantId, deletedAt: null },
    })
    return count > 0
  }

  create(_tenantId: string, _name: string, _templateId: string): Promise<TypeWithDetails> {
    return Promise.reject(new Error('ProtocolType has been replaced by ProtocolCategory'))
  }

  update(_id: string, _tenantId: string, _name: string): Promise<TypeWithDetails> {
    return Promise.reject(new Error('ProtocolType has been replaced by ProtocolCategory'))
  }

  softDelete(_id: string, _tenantId: string): Promise<void> {
    return Promise.resolve()
  }
}
