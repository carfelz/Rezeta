import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  authClient: {
    getToken: vi.fn().mockResolvedValue(null),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChanged: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    errorCodeToMessage: vi.fn((c: string) => c),
  },
}))

import { apiClient, ApiRequestError, triggerDownload } from '../api-client'
import { authClient } from '@/lib/auth'

const mockAuth = authClient as unknown as {
  getToken: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
}

describe('ApiRequestError', () => {
  it('sets name and message from ApiError', () => {
    const err = new ApiRequestError({ code: 'NOT_FOUND', message: 'Not found' })
    expect(err.name).toBe('ApiRequestError')
    expect(err.message).toBe('Not found')
    expect(err.error.code).toBe('NOT_FOUND')
  })

  it('is instanceof Error', () => {
    const err = new ApiRequestError({ code: 'ERR', message: 'oops' })
    expect(err).toBeInstanceOf(Error)
  })
})

describe('apiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    mockAuth.getToken.mockResolvedValue(null)
    mockAuth.signOut.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('calls fetch with correct path and Content-Type header', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { id: '1' } }),
      })
      const result = await apiClient.get('/v1/patients')
      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/v1/patients')
      expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json')
      expect(result).toEqual({ id: '1' })
    })

    it('includes Authorization header when user is authenticated', async () => {
      mockAuth.getToken.mockResolvedValue('my-token')
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'ok' }),
      })
      await apiClient.get('/v1/patients')
      const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token')
    })

    it('omits Authorization header when no user', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'ok' }),
      })
      await apiClient.get('/v1/patients')
      const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect((opts.headers as Record<string, string>)['Authorization']).toBeUndefined()
    })

    it('throws ApiRequestError on non-OK response', async () => {
      fetchMock.mockResolvedValue({
        status: 404,
        ok: false,
        json: vi.fn().mockResolvedValue({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
      })
      await expect(apiClient.get('/v1/patients/x')).rejects.toBeInstanceOf(ApiRequestError)
    })

    it('throws ApiRequestError with correct code', async () => {
      fetchMock.mockResolvedValue({
        status: 403,
        ok: false,
        json: vi.fn().mockResolvedValue({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }),
      })
      await expect(apiClient.get('/v1/admin')).rejects.toMatchObject({
        error: { code: 'FORBIDDEN' },
      })
    })
  })

  describe('POST', () => {
    it('sends POST with JSON body', async () => {
      fetchMock.mockResolvedValue({
        status: 201,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { id: '2' } }),
      })
      await apiClient.post('/v1/patients', { firstName: 'Ana' })
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/v1/patients')
      expect(opts.method).toBe('POST')
      expect(opts.body).toBe(JSON.stringify({ firstName: 'Ana' }))
    })
  })

  describe('PATCH', () => {
    it('sends PATCH with JSON body', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { id: '2' } }),
      })
      await apiClient.patch('/v1/patients/2', { firstName: 'María' })
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/v1/patients/2')
      expect(opts.method).toBe('PATCH')
      expect(opts.body).toBe(JSON.stringify({ firstName: 'María' }))
    })
  })

  describe('DELETE', () => {
    it('sends DELETE request', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: null }),
      })
      await apiClient.delete('/v1/patients/2')
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/v1/patients/2')
      expect(opts.method).toBe('DELETE')
    })

    it('returns undefined for 204 No Content', async () => {
      fetchMock.mockResolvedValue({
        status: 204,
        ok: true,
        json: vi.fn(),
      })
      const result = await apiClient.delete('/v1/patients/2')
      expect(result).toBeUndefined()
    })
  })

  describe('download', () => {
    it('returns blob on 200', async () => {
      const blob = new Blob(['data'])
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
      })
      const result = await apiClient.download('/v1/exports/x')
      expect(result).toBe(blob)
    })

    it('attaches Authorization header when token present', async () => {
      mockAuth.getToken.mockResolvedValue('dl-token')
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob([])),
      })
      await apiClient.download('/v1/exports/x')
      const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer dl-token')
    })

    it('signs out and throws ApiRequestError on 401', async () => {
      fetchMock.mockResolvedValue({
        status: 401,
        ok: false,
        json: vi.fn().mockResolvedValue({ error: { code: 'UNAUTHORIZED', message: 'expired' } }),
      })
      await expect(apiClient.download('/v1/exports/x')).rejects.toBeInstanceOf(ApiRequestError)
      expect(mockAuth.signOut).toHaveBeenCalled()
    })

    it('throws ApiRequestError on non-200 with error body', async () => {
      fetchMock.mockResolvedValue({
        status: 500,
        ok: false,
        json: vi.fn().mockResolvedValue({ error: { code: 'INTERNAL', message: 'oops' } }),
      })
      await expect(apiClient.download('/v1/exports/x')).rejects.toMatchObject({
        error: { code: 'INTERNAL' },
      })
    })
  })

  describe('request 401 handling', () => {
    it('signs out on 401 and throws ApiRequestError', async () => {
      fetchMock.mockResolvedValue({
        status: 401,
        ok: false,
        json: vi.fn().mockResolvedValue({ error: { code: 'UNAUTHORIZED', message: 'expired' } }),
      })
      await expect(apiClient.get('/v1/me')).rejects.toBeInstanceOf(ApiRequestError)
      expect(mockAuth.signOut).toHaveBeenCalled()
    })
  })

  describe('triggerDownload', () => {
    it('creates anchor, clicks, and revokes object URL', () => {
      const createObjectURL = vi.fn().mockReturnValue('blob:fake')
      const revokeObjectURL = vi.fn()
      Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
      Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
      const clickSpy = vi.fn()
      const realCreate = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement
        }
        return realCreate(tag)
      })

      const blob = new Blob(['x'])
      triggerDownload(blob, 'file.csv')

      expect(createObjectURL).toHaveBeenCalledWith(blob)
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    })
  })
})
