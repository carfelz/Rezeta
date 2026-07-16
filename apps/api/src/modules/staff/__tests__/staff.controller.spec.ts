/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StaffController } from '../staff.controller.js'
import type { StaffService } from '../staff.service.js'
import type { CreateInstitutionDto, PlatformPrincipal } from '@rezeta/shared'

const dto: CreateInstitutionDto = {
  institutionName: 'Clínica Norte',
  type: 'clinic',
  plan: 'free',
  adminFullName: 'Dra. Ana Reyes',
  adminEmail: 'ana@clinica.com',
}

function principal(overrides: Partial<PlatformPrincipal> = {}): PlatformPrincipal {
  return {
    id: 'platform-1',
    externalUid: 'ext-staff',
    email: 'staff@rezeta.com',
    fullName: 'Staff',
    ...overrides,
  }
}

describe('StaffController', () => {
  let service: StaffService
  let controller: StaffController

  beforeEach(() => {
    service = {
      createInstitution: vi
        .fn()
        .mockResolvedValue({ tenantId: 'new-tenant', userId: 'new-user', email: 'ana@clinica.com' }),
    } as unknown as StaffService
    controller = new StaffController(service)
  })

  it('createInstitution delegates to the service with the acting platform user id', async () => {
    const result = await controller.createInstitution(principal(), dto)
    expect(service.createInstitution).toHaveBeenCalledWith(dto, 'platform-1')
    expect(result).toEqual({ tenantId: 'new-tenant', userId: 'new-user', email: 'ana@clinica.com' })
  })

  it('me returns the current platform principal', () => {
    const p = principal()
    expect(controller.me(p)).toEqual(p)
  })
})
