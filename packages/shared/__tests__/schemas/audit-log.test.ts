import { describe, it, expect } from 'vitest'
import {
  AuditCategorySchema,
  AuditActorTypeSchema,
  AuditStatusSchema,
  AuditLogQuerySchema,
} from '../../src/schemas/audit-log.js'

describe('AuditCategorySchema', () => {
  it('accepts all valid categories', () => {
    expect(AuditCategorySchema.parse('entity')).toBe('entity')
    expect(AuditCategorySchema.parse('auth')).toBe('auth')
    expect(AuditCategorySchema.parse('communication')).toBe('communication')
    expect(AuditCategorySchema.parse('system')).toBe('system')
  })

  it('rejects unknown category', () => {
    expect(() => AuditCategorySchema.parse('billing')).toThrow()
    expect(() => AuditCategorySchema.parse('')).toThrow()
  })
})

describe('AuditActorTypeSchema', () => {
  it('accepts all valid actor types', () => {
    expect(AuditActorTypeSchema.parse('user')).toBe('user')
    expect(AuditActorTypeSchema.parse('system')).toBe('system')
    expect(AuditActorTypeSchema.parse('webhook')).toBe('webhook')
    expect(AuditActorTypeSchema.parse('cron')).toBe('cron')
  })

  it('rejects unknown actor type', () => {
    expect(() => AuditActorTypeSchema.parse('robot')).toThrow()
  })
})

describe('AuditStatusSchema', () => {
  it('accepts success and failed', () => {
    expect(AuditStatusSchema.parse('success')).toBe('success')
    expect(AuditStatusSchema.parse('failed')).toBe('failed')
  })

  it('rejects unknown status', () => {
    expect(() => AuditStatusSchema.parse('pending')).toThrow()
  })
})

describe('AuditLogQuerySchema', () => {
  it('accepts empty object (all optional)', () => {
    expect(AuditLogQuerySchema.parse({})).toEqual({})
  })

  it('accepts cursor', () => {
    const result = AuditLogQuerySchema.parse({ cursor: 'abc123' })
    expect(result.cursor).toBe('abc123')
  })

  it('coerces limit from string to number', () => {
    const result = AuditLogQuerySchema.parse({ limit: '50' })
    expect(result.limit).toBe(50)
  })

  it('rejects limit above 200', () => {
    expect(() => AuditLogQuerySchema.parse({ limit: 201 })).toThrow()
  })

  it('rejects limit below 1', () => {
    expect(() => AuditLogQuerySchema.parse({ limit: 0 })).toThrow()
  })

  it('accepts valid dateFrom ISO datetime', () => {
    const result = AuditLogQuerySchema.parse({ dateFrom: '2026-04-01T00:00:00Z' })
    expect(result.dateFrom).toBe('2026-04-01T00:00:00Z')
  })

  it('rejects invalid dateFrom', () => {
    expect(() => AuditLogQuerySchema.parse({ dateFrom: 'not-a-date' })).toThrow()
  })

  it('accepts valid dateTo ISO datetime', () => {
    const result = AuditLogQuerySchema.parse({ dateTo: '2026-04-30T23:59:59Z' })
    expect(result.dateTo).toBe('2026-04-30T23:59:59Z')
  })

  it('accepts valid actorUserId UUID', () => {
    const uuid = '00000000-0000-0000-0000-000000000001'
    const result = AuditLogQuerySchema.parse({ actorUserId: uuid })
    expect(result.actorUserId).toBe(uuid)
  })

  it('rejects non-uuid actorUserId', () => {
    expect(() => AuditLogQuerySchema.parse({ actorUserId: 'not-a-uuid' })).toThrow()
  })

  it('accepts valid category', () => {
    const result = AuditLogQuerySchema.parse({ category: 'auth' })
    expect(result.category).toBe('auth')
  })

  it('rejects invalid category', () => {
    expect(() => AuditLogQuerySchema.parse({ category: 'other' })).toThrow()
  })

  it('accepts action as free string', () => {
    const result = AuditLogQuerySchema.parse({ action: 'login' })
    expect(result.action).toBe('login')
  })

  it('accepts entityType', () => {
    const result = AuditLogQuerySchema.parse({ entityType: 'Patient' })
    expect(result.entityType).toBe('Patient')
  })

  it('accepts valid entityId UUID', () => {
    const uuid = '00000000-0000-0000-0000-000000000002'
    const result = AuditLogQuerySchema.parse({ entityId: uuid })
    expect(result.entityId).toBe(uuid)
  })

  it('rejects non-uuid entityId', () => {
    expect(() => AuditLogQuerySchema.parse({ entityId: 'bad' })).toThrow()
  })

  it('accepts valid status', () => {
    const result = AuditLogQuerySchema.parse({ status: 'failed' })
    expect(result.status).toBe('failed')
  })

  it('accepts full valid query', () => {
    const query = {
      cursor: 'cur_123',
      limit: '25',
      dateFrom: '2026-01-01T00:00:00Z',
      dateTo: '2026-12-31T23:59:59Z',
      actorUserId: '00000000-0000-0000-0000-000000000001',
      category: 'entity',
      action: 'update',
      entityType: 'Consultation',
      entityId: '00000000-0000-0000-0000-000000000002',
      status: 'success',
    }
    const result = AuditLogQuerySchema.parse(query)
    expect(result.limit).toBe(25)
    expect(result.category).toBe('entity')
    expect(result.status).toBe('success')
  })
})
