import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionsRepository } from '../permissions.repository.js'

const mockPrisma = {
  rolePermission: { findMany: vi.fn(), upsert: vi.fn() },
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

  it('upserts a role/module row keyed by the compound unique', async () => {
    mockPrisma.rolePermission.upsert.mockResolvedValue(undefined)
    await repo.upsertModule('t1', 'doctor', 'patients', 'manage')
    expect(mockPrisma.rolePermission.upsert).toHaveBeenCalledWith({
      where: { tenantId_role_moduleKey: { tenantId: 't1', role: 'doctor', moduleKey: 'patients' } },
      update: { accessLevel: 'manage' },
      create: { tenantId: 't1', role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' },
    })
  })
})
