import { httpAuditContextStore, setAuditEntityName } from '../audit-context.store.js'

describe('httpAuditContextStore', () => {
  it('returns undefined outside of a run context', () => {
    expect(httpAuditContextStore.getStore()).toBeUndefined()
  })

  it('provides context inside run callback', () => {
    const ctx = { tenantId: 'tenant-1', actorUserId: 'user-1' }
    httpAuditContextStore.run(ctx, () => {
      expect(httpAuditContextStore.getStore()).toEqual(ctx)
    })
  })

  it('restores undefined context after run completes', () => {
    const ctx = { tenantId: 'tenant-1', actorUserId: 'user-1' }
    httpAuditContextStore.run(ctx, () => {})
    expect(httpAuditContextStore.getStore()).toBeUndefined()
  })
})

describe('setAuditEntityName', () => {
  it('sets entityName on the active context', () => {
    const ctx = { tenantId: 'tenant-1', actorUserId: 'user-1' }
    httpAuditContextStore.run(ctx, () => {
      setAuditEntityName('Test Protocol')
      expect(httpAuditContextStore.getStore()?.entityName).toBe('Test Protocol')
    })
  })

  it('does nothing when called outside an active context', () => {
    expect(() => setAuditEntityName('orphan')).not.toThrow()
    expect(httpAuditContextStore.getStore()).toBeUndefined()
  })
})
