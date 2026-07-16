import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionsRepository } from '../permissions.repository.js'

const mockPrisma = {
  rolePermission: { findMany: vi.fn() },
}

describe('PermissionsRepository', () => {
  let repo: PermissionsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new PermissionsRepository(mockPrisma as never)
  })

  it('queries stored rows scoped to tenant and role', async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { role: 'assistant', moduleKey: 'patients', accessLevel: 'manage' },
    ])
    const rows = await repo.findByTenantAndRole('t1', 'assistant')
    expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', role: 'assistant' },
      select: { role: true, moduleKey: true, accessLevel: true },
    })
    expect(rows).toEqual([{ role: 'assistant', moduleKey: 'patients', accessLevel: 'manage' }])
  })
})
