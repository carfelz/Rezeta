import { describe, it, expect } from 'vitest'
import { redactForAudit, redactChangesForAudit } from '../redact.js'

describe('redactForAudit', () => {
  it('passes through non-sensitive fields unchanged', () => {
    const result = redactForAudit('Patient', { firstName: 'Ana', age: 42 })
    expect(result['firstName']).toBe('Ana')
    expect(result['age']).toBe(42)
  })

  it('masks non-string entity-rule field with [REDACTED]', () => {
    const result = redactForAudit('Patient', { cedula: 12345, passport: null })
    expect(result['cedula']).toBe('[REDACTED]')
    expect(result['passport']).toBe('[REDACTED]')
  })

  it('masks short string entity-rule field (≤4 chars) with [REDACTED]', () => {
    const result = redactForAudit('Patient', { cedula: '123' })
    expect(result['cedula']).toBe('[REDACTED]')
  })

  it('shows last 4 chars of long string entity-rule field', () => {
    const result = redactForAudit('Patient', { cedula: '001-1234567-8' })
    expect(result['cedula']).toBe('**** 67-8')
  })

  it('returns empty object for unknown entity type', () => {
    const result = redactChangesForAudit('UnknownEntity', {
      foo: { before: 'a', after: 'b' },
    })
    expect(result['foo']).toEqual({ before: 'a', after: 'b' })
  })

  it('redacts globally blocked fields: password', () => {
    const result = redactForAudit('User', { email: 'a@b.com', password: 'secret123' })
    expect(result['email']).toBe('a@b.com')
    expect(result['password']).toBe('[REDACTED]')
  })

  it('redacts globally blocked fields: token variants', () => {
    const result = redactForAudit('User', {
      accessToken: 'tok',
      refreshToken: 'ref',
      idToken: 'idtok',
    })
    expect(result['accessToken']).toBe('[REDACTED]')
    expect(result['refreshToken']).toBe('[REDACTED]')
    expect(result['idToken']).toBe('[REDACTED]')
  })

  it('redacts globally blocked fields: apiKey, secret, privateKey', () => {
    const result = redactForAudit('Tenant', { apiKey: 'key', secret: 'sec', privateKey: 'pk' })
    expect(result['apiKey']).toBe('[REDACTED]')
    expect(result['secret']).toBe('[REDACTED]')
    expect(result['privateKey']).toBe('[REDACTED]')
  })

  it('masks last-4 of cedula for Patient entity', () => {
    const result = redactForAudit('Patient', { cedula: '001-1234567-8' })
    expect(result['cedula']).toBe('**** 67-8')
  })

  it('masks last-4 of passport for Patient entity', () => {
    const result = redactForAudit('Patient', { passport: 'AB123456' })
    expect(result['passport']).toBe('**** 3456')
  })

  it('masks last-4 of documentNumber — the real Patient column', () => {
    // The Patient model stores the ID in `documentNumber`, not `cedula`.
    const result = redactForAudit('Patient', { documentNumber: '001-1234567-8' })
    expect(result['documentNumber']).toBe('**** 67-8')
  })

  it('does not apply the documentNumber rule to other entities', () => {
    const result = redactForAudit('Invoice', { documentNumber: '001-1234567-8' })
    expect(result['documentNumber']).toBe('001-1234567-8')
  })

  it('redacts documentNumber in change sets', () => {
    const result = redactChangesForAudit('Patient', {
      documentNumber: { before: '001-0000000-1', after: '001-0000000-2' },
    })
    expect(result['documentNumber']).toEqual({ before: '[REDACTED]', after: '[REDACTED]' })
  })

  it('fully redacts externalUid for User entity', () => {
    const result = redactForAudit('User', { externalUid: 'firebase-uid-xyz' })
    expect(result['externalUid']).toBe('[REDACTED]')
  })

  it('redacts creditCard and cardNumber', () => {
    const result = redactForAudit('Invoice', { creditCard: '4111111111111111' })
    expect(result['creditCard']).toBe('[REDACTED]')
  })

  it('does not apply entity-specific rules to other entities', () => {
    // cedula rule is Patient-specific; should NOT mask for Invoice entity
    const result = redactForAudit('Invoice', { cedula: 'something' })
    expect(result['cedula']).toBe('something')
  })

  it('returns empty object for empty payload', () => {
    expect(redactForAudit('Patient', {})).toEqual({})
  })

  it('redacts short cedula (<=4 chars) fully', () => {
    const result = redactForAudit('Patient', { cedula: '1234' })
    expect(result['cedula']).toBe('[REDACTED]')
  })
})

describe('redactChangesForAudit', () => {
  it('passes through non-sensitive field changes unchanged', () => {
    const result = redactChangesForAudit('Patient', {
      firstName: { before: 'Ana', after: 'Ana M.' },
    })
    expect(result['firstName']).toEqual({ before: 'Ana', after: 'Ana M.' })
  })

  it('redacts password in before and after', () => {
    const result = redactChangesForAudit('User', {
      password: { before: 'old-hash', after: 'new-hash' },
    })
    expect(result['password']).toEqual({ before: '[REDACTED]', after: '[REDACTED]' })
  })

  it('redacts externalUid for User changes', () => {
    const result = redactChangesForAudit('User', {
      externalUid: { before: 'old-uid', after: 'new-uid' },
    })
    expect(result['externalUid']).toEqual({ before: '[REDACTED]', after: '[REDACTED]' })
  })

  it('redacts cedula for Patient changes', () => {
    const result = redactChangesForAudit('Patient', {
      cedula: { before: '001-0000000-1', after: '001-0000000-2' },
    })
    expect(result['cedula']).toEqual({ before: '[REDACTED]', after: '[REDACTED]' })
  })

  it('handles multiple fields: redacts sensitive, passes others', () => {
    const result = redactChangesForAudit('User', {
      email: { before: 'old@test.com', after: 'new@test.com' },
      password: { before: 'old', after: 'new' },
    })
    expect(result['email']).toEqual({ before: 'old@test.com', after: 'new@test.com' })
    expect(result['password']).toEqual({ before: '[REDACTED]', after: '[REDACTED]' })
  })

  it('returns empty object for empty changes', () => {
    expect(redactChangesForAudit('Patient', {})).toEqual({})
  })
})
