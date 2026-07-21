import { describe, expect, it } from 'vitest'
import { CreatePlatformUserSchema, PlatformUserApiSchema } from '../platform-users.js'

describe('CreatePlatformUserSchema', () => {
  it('accepts a valid payload', () => {
    const parsed = CreatePlatformUserSchema.parse({
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })
    expect(parsed).toEqual({ email: 'laura@rezeta.do', fullName: 'Laura Medina' })
  })

  it('rejects an invalid email', () => {
    expect(() =>
      CreatePlatformUserSchema.parse({ email: 'not-an-email', fullName: 'Laura Medina' }),
    ).toThrow()
  })

  it('rejects a too-short full name', () => {
    expect(() =>
      CreatePlatformUserSchema.parse({ email: 'laura@rezeta.do', fullName: 'L' }),
    ).toThrow()
  })
})

describe('PlatformUserApiSchema', () => {
  const base = {
    id: '11111111-2222-4333-8444-555555555555',
    email: 'laura@rezeta.do',
    fullName: 'Laura Medina',
    isActive: true,
    createdAt: '2026-07-20T12:00:00.000Z',
    lastLoginAt: null,
    status: 'invited',
  }

  it('accepts a roster row with null lastLoginAt (invited)', () => {
    expect(PlatformUserApiSchema.parse(base).status).toBe('invited')
  })

  it('accepts an active row', () => {
    const parsed = PlatformUserApiSchema.parse({
      ...base,
      lastLoginAt: '2026-07-20T13:00:00.000Z',
      status: 'active',
    })
    expect(parsed.status).toBe('active')
  })

  it('rejects an unknown status', () => {
    expect(() => PlatformUserApiSchema.parse({ ...base, status: 'blocked' })).toThrow()
  })
})
