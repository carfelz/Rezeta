import { describe, it, expect } from 'vitest'
import {
  DEFAULT_USER_PREFERENCES,
  UpdateUserPreferencesSchema,
  UserPreferencesSchema,
} from '../../src/schemas/user-preferences.js'

describe('UserPreferencesSchema', () => {
  it('accepts an empty object (no preferences set)', () => {
    expect(UserPreferencesSchema.parse({})).toEqual({})
  })

  it('accepts consultationViewMode = soap', () => {
    const result = UserPreferencesSchema.parse({ consultationViewMode: 'soap' })
    expect(result.consultationViewMode).toBe('soap')
  })

  it('accepts consultationViewMode = canvas', () => {
    const result = UserPreferencesSchema.parse({ consultationViewMode: 'canvas' })
    expect(result.consultationViewMode).toBe('canvas')
  })

  it('rejects unrecognized consultationViewMode value', () => {
    expect(() => UserPreferencesSchema.parse({ consultationViewMode: 'split' })).toThrow()
  })

  it('rejects non-string consultationViewMode value', () => {
    expect(() => UserPreferencesSchema.parse({ consultationViewMode: 1 })).toThrow()
  })

  it('safeParse returns success: false on malformed input', () => {
    const result = UserPreferencesSchema.safeParse({ consultationViewMode: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('safeParse returns success: true with parsed data when valid', () => {
    const result = UserPreferencesSchema.safeParse({ consultationViewMode: 'canvas' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.consultationViewMode).toBe('canvas')
    }
  })
})

describe('UpdateUserPreferencesSchema', () => {
  it('accepts a partial update with consultationViewMode', () => {
    const result = UpdateUserPreferencesSchema.parse({ consultationViewMode: 'canvas' })
    expect(result).toEqual({ consultationViewMode: 'canvas' })
  })

  it('accepts an empty patch (no-op)', () => {
    expect(UpdateUserPreferencesSchema.parse({})).toEqual({})
  })

  it('rejects an invalid consultationViewMode in the patch', () => {
    expect(() => UpdateUserPreferencesSchema.parse({ consultationViewMode: 'bad' })).toThrow()
  })
})

describe('DEFAULT_USER_PREFERENCES', () => {
  it('is an empty object', () => {
    expect(DEFAULT_USER_PREFERENCES).toEqual({})
  })

  it('passes UserPreferencesSchema validation', () => {
    expect(() => UserPreferencesSchema.parse(DEFAULT_USER_PREFERENCES)).not.toThrow()
  })
})
