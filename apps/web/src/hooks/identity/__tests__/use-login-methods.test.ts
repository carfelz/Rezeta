import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchLoginMethods } from '../use-login-methods'

describe('fetchLoginMethods', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the parsed methods on a 2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: { methods: ['password', 'sso'], ssoProviderId: 'oidc.clinica', ssoDisplayName: 'Clinica SSO' },
      }),
    })

    const result = await fetchLoginMethods('doctor@clinica.do')

    expect(result).toEqual({
      methods: ['password', 'sso'],
      ssoProviderId: 'oidc.clinica',
      ssoDisplayName: 'Clinica SSO',
    })
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/auth/login-methods')
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe(JSON.stringify({ email: 'doctor@clinica.do' }))
  })

  it('fails open to password+google on a non-2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: { code: 'INTERNAL', message: 'oops' } }),
    })

    const result = await fetchLoginMethods('doctor@clinica.do')

    expect(result).toEqual({ methods: ['password', 'google'] })
  })

  it('fails open to password+google on a network error', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    const result = await fetchLoginMethods('doctor@clinica.do')

    expect(result).toEqual({ methods: ['password', 'google'] })
  })

  it('passes an AbortSignal to fetch (3s timeout wiring)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: { methods: ['password', 'google'] } }),
    })

    await fetchLoginMethods('doctor@clinica.do')

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(opts.signal).toBeInstanceOf(AbortSignal)
  })
})
