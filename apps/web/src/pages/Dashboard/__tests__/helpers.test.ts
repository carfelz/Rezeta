import { describe, it, expect } from 'vitest'
import type { AuditLogItem } from '@rezeta/shared'
import { describeAuditEntry } from '../helpers'

function entry(overrides: Partial<AuditLogItem> = {}): AuditLogItem {
  return {
    id: 'log-1',
    action: 'patient.create',
    entityType: 'Patient',
    createdAt: new Date().toISOString(),
    actor: { fullName: 'Dr. García' },
    ...overrides,
  } as AuditLogItem
}

describe('describeAuditEntry', () => {
  it('returns actor and a descriptive detail for create', () => {
    expect(describeAuditEntry(entry({ action: 'patient.create' }))).toEqual({
      actor: 'Dr. García',
      detail: ' creó un paciente',
    })
  })

  it('falls back to "Sistema" when there is no actor', () => {
    const result = describeAuditEntry(entry({ actor: null }))
    expect(result.actor).toBe('Sistema')
  })

  it('never emits HTML — a malicious fullName is returned verbatim as the actor text', () => {
    const payload = '<img src=x onerror="alert(1)">'
    const result = describeAuditEntry(entry({ actor: { fullName: payload } }))
    // The actor is a plain string the component renders as a text node; it must
    // not be wrapped in markup here (that was the stored-XSS sink).
    expect(result.actor).toBe(payload)
    expect(result.detail).not.toContain('<b>')
    expect(result.detail).not.toContain(payload)
  })

  it('covers update / delete / sign / login branches', () => {
    expect(describeAuditEntry(entry({ action: 'patient.update' })).detail).toContain('actualizó')
    expect(describeAuditEntry(entry({ action: 'patient.delete' })).detail).toContain('eliminó')
    expect(describeAuditEntry(entry({ action: 'consultation.sign' })).detail).toContain('firmó')
    expect(describeAuditEntry(entry({ action: 'auth.login' })).detail).toBe(' inició sesión')
  })
})
