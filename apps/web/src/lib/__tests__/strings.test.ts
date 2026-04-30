import { describe, it, expect } from 'vitest'
import { strings, firebaseErrorToSpanish } from '../strings'

describe('strings', () => {
  it('exports APP_NAME', () => {
    expect(strings.APP_NAME).toBe('Rezeta')
  })

  it('exports APP_TAGLINE', () => {
    expect(strings.APP_TAGLINE).toBeDefined()
    expect(typeof strings.APP_TAGLINE).toBe('string')
  })

  it('has non-empty string or function values for all keys', () => {
    for (const [key, value] of Object.entries(strings)) {
      const t = typeof value
      expect(['string', 'function'], `strings.${key} should be string or function`).toContain(t)
      if (t === 'string') {
        expect((value as string).length, `strings.${key} should not be empty`).toBeGreaterThan(0)
      }
    }
  })

  it('exports login strings', () => {
    expect(strings.LOGIN_TITLE).toBeDefined()
    expect(strings.LOGIN_SUBMIT).toBeDefined()
  })

  it('exports signup strings', () => {
    expect(strings.SIGNUP_TITLE).toBeDefined()
    expect(strings.SIGNUP_SUBMIT).toBeDefined()
  })

  it('exports protocol empty title', () => {
    expect(strings.PROTOCOLS_EMPTY_TITLE).toBe('Sin protocolos todavía')
  })

  it('ONBOARDING_WELCOME_HEADING handles null name', () => {
    const heading = strings.ONBOARDING_WELCOME_HEADING(null)
    expect(typeof heading).toBe('string')
    expect(heading.length).toBeGreaterThan(0)
  })

  it('ONBOARDING_WELCOME_HEADING includes name when provided', () => {
    const heading = strings.ONBOARDING_WELCOME_HEADING('Dr. García')
    expect(heading).toContain('Dr. García')
  })

  it('DASHBOARD_GREETING returns a string for null name', () => {
    const result = strings.DASHBOARD_GREETING(null)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('DASHBOARD_GREETING includes extracted last name', () => {
    const result = strings.DASHBOARD_GREETING('Dr. Carlos Feliz')
    expect(result).toContain('Feliz')
  })

  it('DASHBOARD_GREETING works without Dr. prefix', () => {
    const result = strings.DASHBOARD_GREETING('Ana López')
    expect(result).toContain('López')
  })

  it('PROTOCOLS_LIST_VERSION returns version string', () => {
    expect(strings.PROTOCOLS_LIST_VERSION(3)).toBe('v3')
  })

  it('EDITOR_PUBLICAR returns publish label', () => {
    expect(strings.EDITOR_PUBLICAR(2)).toBe('Publicar v2')
  })

  it('EDITOR_VERSION returns version label', () => {
    expect(strings.EDITOR_VERSION(1)).toBe('v1')
  })

  it('EDITOR_SECTION_DELETE_CONFIRM with children', () => {
    const msg = strings.EDITOR_SECTION_DELETE_CONFIRM(3)
    expect(msg).toContain('3')
    expect(msg).toContain('bloques')
  })

  it('EDITOR_SECTION_DELETE_CONFIRM with 1 child (singular)', () => {
    const msg = strings.EDITOR_SECTION_DELETE_CONFIRM(1)
    expect(msg).toContain('1')
    expect(msg).toContain('bloque')
    expect(msg).not.toContain('bloques')
  })

  it('EDITOR_SECTION_DELETE_CONFIRM with no children', () => {
    const msg = strings.EDITOR_SECTION_DELETE_CONFIRM(0)
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('TEMPLATES_LIST_BLOCKED_BY singular', () => {
    expect(strings.TEMPLATES_LIST_BLOCKED_BY(1)).toContain('tipo')
    expect(strings.TEMPLATES_LIST_BLOCKED_BY(1)).not.toContain('tipos')
  })

  it('TEMPLATES_LIST_BLOCKED_BY plural', () => {
    expect(strings.TEMPLATES_LIST_BLOCKED_BY(3)).toContain('tipos')
  })

  it('TEMPLATES_LIST_DELETE_CONFIRM includes name', () => {
    const msg = strings.TEMPLATES_LIST_DELETE_CONFIRM('Mi plantilla')
    expect(msg).toContain('Mi plantilla')
  })

  it('TEMPLATE_EDITOR_DELETE_SECTION_CONFIRM singular', () => {
    const msg = strings.TEMPLATE_EDITOR_DELETE_SECTION_CONFIRM('Mi sección', 1)
    expect(msg).toContain('Mi sección')
    expect(msg).toContain('1')
  })

  it('TEMPLATE_EDITOR_DELETE_SECTION_CONFIRM plural', () => {
    const msg = strings.TEMPLATE_EDITOR_DELETE_SECTION_CONFIRM('Mi sección', 3)
    expect(msg).toContain('bloques')
    expect(msg).toContain('hijos')
  })

  it('TYPES_LIST_DELETE_CONFIRM includes name', () => {
    const msg = strings.TYPES_LIST_DELETE_CONFIRM('Emergencia')
    expect(msg).toContain('Emergencia')
  })

  it('TYPES_LOCKED_BADGE singular', () => {
    expect(strings.TYPES_LOCKED_BADGE(1)).toContain('protocolo')
    expect(strings.TYPES_LOCKED_BADGE(1)).not.toContain('protocolos')
  })

  it('TYPES_LOCKED_BADGE plural', () => {
    expect(strings.TYPES_LOCKED_BADGE(5)).toContain('protocolos')
  })

  it('VIEWER_VERSION returns version label', () => {
    expect(strings.VIEWER_VERSION(7)).toBe('v7')
  })
})

describe('firebaseErrorToSpanish', () => {
  it('maps auth/email-already-in-use', () => {
    const msg = firebaseErrorToSpanish('auth/email-already-in-use')
    expect(msg).toBe(strings.FIREBASE_ERROR_EMAIL_ALREADY_IN_USE)
  })

  it('maps auth/invalid-email', () => {
    expect(firebaseErrorToSpanish('auth/invalid-email')).toBe(strings.FIREBASE_ERROR_INVALID_EMAIL)
  })

  it('maps auth/weak-password', () => {
    expect(firebaseErrorToSpanish('auth/weak-password')).toBe(strings.FIREBASE_ERROR_WEAK_PASSWORD)
  })

  it('maps auth/user-not-found', () => {
    expect(firebaseErrorToSpanish('auth/user-not-found')).toBe(
      strings.FIREBASE_ERROR_USER_NOT_FOUND,
    )
  })

  it('maps auth/wrong-password', () => {
    expect(firebaseErrorToSpanish('auth/wrong-password')).toBe(
      strings.FIREBASE_ERROR_WRONG_PASSWORD,
    )
  })

  it('maps auth/invalid-credential', () => {
    expect(firebaseErrorToSpanish('auth/invalid-credential')).toBe(
      strings.FIREBASE_ERROR_INVALID_CREDENTIAL,
    )
  })

  it('maps auth/network-request-failed', () => {
    expect(firebaseErrorToSpanish('auth/network-request-failed')).toBe(
      strings.FIREBASE_ERROR_NETWORK_REQUEST_FAILED,
    )
  })

  it('maps auth/too-many-requests', () => {
    expect(firebaseErrorToSpanish('auth/too-many-requests')).toBe(
      strings.FIREBASE_ERROR_TOO_MANY_REQUESTS,
    )
  })

  it('returns UNKNOWN for unrecognized codes', () => {
    expect(firebaseErrorToSpanish('auth/some-unknown-code')).toBe(strings.FIREBASE_ERROR_UNKNOWN)
  })
})
