import { describe, it, expect } from 'vitest'
import type { PlatformPrincipal } from '@rezeta/shared'
import { makeAuthUser } from '@/test/auth-helpers'
import { isSafeRedirect, resolveDestination, type Identity } from '../auth-routing'

const DOCTOR_HOST = 'app-dev.rezeta.co'
const STAFF_HOST = 'staff-dev.rezeta.co'

const platformPrincipal: PlatformPrincipal = {
  id: 'platform-user-1',
  externalUid: 'fb-uid-platform',
  email: 'staffer@rezeta.app',
  fullName: 'Staff Person',
}

describe('isSafeRedirect', () => {
  it('rejects null', () => {
    expect(isSafeRedirect(null)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isSafeRedirect('')).toBe(false)
  })

  it('rejects a path that is not "/"-prefixed', () => {
    expect(isSafeRedirect('dashboard')).toBe(false)
  })

  it('rejects a protocol-relative "//"-prefixed path', () => {
    expect(isSafeRedirect('//evil.example.com')).toBe(false)
  })

  it('rejects any path containing "://"', () => {
    expect(isSafeRedirect('/redirect?next=https://evil.example.com')).toBe(false)
  })

  it('accepts a plain absolute path', () => {
    expect(isSafeRedirect('/dashboard')).toBe(true)
  })
})

describe('resolveDestination', () => {
  it('clinic: sends the requested redirect when it is safe and belongs to the host app', () => {
    const identity: Identity = { kind: 'clinic', user: makeAuthUser('doctor') }
    expect(
      resolveDestination({ identity, hostname: DOCTOR_HOST, requestedRedirect: '/agenda' }),
    ).toBe('/agenda')
  })

  it('clinic: falls back to /dashboard when the redirect is unsafe', () => {
    const identity: Identity = { kind: 'clinic', user: makeAuthUser('doctor') }
    expect(
      resolveDestination({
        identity,
        hostname: DOCTOR_HOST,
        requestedRedirect: '//evil.example.com',
      }),
    ).toBe('/dashboard')
  })

  it('clinic: falls back to /dashboard when the redirect belongs to the other host app', () => {
    const identity: Identity = { kind: 'clinic', user: makeAuthUser('doctor') }
    expect(
      resolveDestination({
        identity,
        hostname: DOCTOR_HOST,
        requestedRedirect: '/staff/institutions',
      }),
    ).toBe('/dashboard')
  })

  it('staff: sends the requested redirect when it is safe and belongs to the host app', () => {
    const identity: Identity = { kind: 'staff', principal: platformPrincipal }
    expect(
      resolveDestination({
        identity,
        hostname: STAFF_HOST,
        requestedRedirect: '/staff/security',
      }),
    ).toBe('/staff/security')
  })

  it('staff: falls back to /staff/institutions when the redirect is unsafe', () => {
    const identity: Identity = { kind: 'staff', principal: platformPrincipal }
    expect(
      resolveDestination({
        identity,
        hostname: STAFF_HOST,
        requestedRedirect: 'javascript://alert(1)',
      }),
    ).toBe('/staff/institutions')
  })

  it('staff: falls back to /staff/institutions when the redirect belongs to the other host app', () => {
    const identity: Identity = { kind: 'staff', principal: platformPrincipal }
    expect(
      resolveDestination({ identity, hostname: STAFF_HOST, requestedRedirect: '/dashboard' }),
    ).toBe('/staff/institutions')
  })

  it('anonymous: always goes to /login, ignoring any requested redirect', () => {
    const identity: Identity = { kind: 'anonymous' }
    expect(
      resolveDestination({ identity, hostname: DOCTOR_HOST, requestedRedirect: '/dashboard' }),
    ).toBe('/login')
  })

  it('unprovisioned: returns null so the caller never navigates', () => {
    const identity: Identity = { kind: 'unprovisioned' }
    expect(
      resolveDestination({ identity, hostname: STAFF_HOST, requestedRedirect: '/dashboard' }),
    ).toBeNull()
  })

  it('loading: returns null so the caller renders nothing yet', () => {
    const identity: Identity = { kind: 'loading' }
    expect(
      resolveDestination({ identity, hostname: DOCTOR_HOST, requestedRedirect: null }),
    ).toBeNull()
  })
})
