/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { StaffSecurityController } from '../staff-security.controller.js'
import type { StaffSecurityService } from '../staff-security.service.js'

describe('StaffSecurityController', () => {
  it('overview delegates to the service', async () => {
    const overview = {
      tiles: { activeInstitutions: 1, activeUsers30d: 1, logins7d: 1, dormantAccounts60d: 0 },
      institutions: [],
    }
    const service = { overview: vi.fn().mockResolvedValue(overview) } as unknown as StaffSecurityService
    const result = await new StaffSecurityController(service).overview()
    expect(service.overview).toHaveBeenCalledWith()
    expect(result).toBe(overview)
  })
})
