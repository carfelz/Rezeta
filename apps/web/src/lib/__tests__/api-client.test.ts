import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  authClient: {
    getToken: vi.fn().mockResolvedValue(null),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChanged: vi.fn(),
    signIn: vi.fn(),
    errorCodeToMessage: vi.fn((c: string) => c),
  },
}))

import { apiClient, ApiRequestError, triggerDownload } from '../api-client'
import { authClient } from '@/lib/auth'
import { useLoadingStore } from '@/store/loading.store'
import type { ApiError } from '@rezeta/shared'

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
    const err = new ApiRequestError({ code: 'ERR' as unknown as ApiError['code'], message: 'oops' })
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

    it('does not sign out on a USER_NOT_PROVISIONED 401, but still throws with that code', async () => {
      fetchMock.mockResolvedValue({
        status: 401,
        ok: false,
        json: vi
          .fn()
          .mockResolvedValue({ error: { code: 'USER_NOT_PROVISIONED', message: 'not provisioned' } }),
      })
      await expect(apiClient.post('/v1/auth/provision', {})).rejects.toMatchObject({
        error: { code: 'USER_NOT_PROVISIONED' },
      })
      expect(mockAuth.signOut).not.toHaveBeenCalled()
    })

    it('signs out on a 401 with any other code (existing behavior preserved)', async () => {
      fetchMock.mockResolvedValue({
        status: 401,
        ok: false,
        json: vi.fn().mockResolvedValue({ error: { code: 'UNAUTHORIZED', message: 'expired' } }),
      })
      await expect(apiClient.get('/v1/me')).rejects.toMatchObject({ error: { code: 'UNAUTHORIZED' } })
      expect(mockAuth.signOut).toHaveBeenCalled()
    })

    it('does not sign out on a 401 when skipSignOutOn401 is set, even for a non-exempt code', async () => {
      fetchMock.mockResolvedValue({
        status: 401,
        ok: false,
        json: vi.fn().mockResolvedValue({ error: { code: 'UNAUTHORIZED', message: 'no platform user' } }),
      })
      await expect(
        apiClient.get('/v1/staff/me', { skipSignOutOn401: true }),
      ).rejects.toBeInstanceOf(ApiRequestError)
      expect(mockAuth.signOut).not.toHaveBeenCalled()
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

  describe('global loading interception', () => {
    beforeEach(() => {
      useLoadingStore.setState({ pendingCount: 0, isLoading: false })
    })

    const okResponse = (): Response =>
      ({ ok: true, status: 200, json: () => Promise.resolve({ data: { id: '1' } }) }) as never

    it('increments while a request is in flight and settles after success', async () => {
      let midFlight = -1
      fetchMock.mockImplementation(() => {
        midFlight = useLoadingStore.getState().pendingCount
        return Promise.resolve(okResponse())
      })
      await apiClient.get('/v1/patients')
      expect(midFlight).toBe(1)
      expect(useLoadingStore.getState().pendingCount).toBe(0)
    })

    it('decrements on API error responses', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { code: 'ERR', message: 'bad' } }),
      } as never)
      await expect(apiClient.get('/v1/patients')).rejects.toThrow()
      expect(useLoadingStore.getState().pendingCount).toBe(0)
    })

    it('decrements on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('network down'))
      await expect(apiClient.get('/v1/patients')).rejects.toThrow('network down')
      expect(useLoadingStore.getState().pendingCount).toBe(0)
    })

    it('decrements on 204 responses', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 204 } as never)
      await apiClient.delete('/v1/appointments/a1')
      expect(useLoadingStore.getState().pendingCount).toBe(0)
    })

    it('silent requests never touch the store', async () => {
      fetchMock.mockImplementation(() => {
        expect(useLoadingStore.getState().pendingCount).toBe(0)
        return Promise.resolve(okResponse())
      })
      await apiClient.patch('/v1/consultations/c1/protocols/u1', {}, { silent: true })
      expect(useLoadingStore.getState().pendingCount).toBe(0)
    })

    it('download participates too', async () => {
      fetchMock.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) } as never)
      await apiClient.download('/v1/invoices/i1/pdf')
      expect(useLoadingStore.getState().pendingCount).toBe(0)
    })
  })

  describe('request timeouts', () => {
    beforeEach(() => {
      useLoadingStore.setState({ pendingCount: 0, isLoading: false })
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('token timeout rejects with errorRequestTimeout message', async () => {
      mockAuth.getToken.mockImplementation(() => new Promise(() => {}))
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { id: '1' } }),
      })

      const promise = apiClient.get('/v1/x')
      vi.advanceTimersByTime(15_000)
      await expect(promise).rejects.toThrow('La solicitud tardó demasiado. Revisa tu conexión e inténtalo de nuevo.')
    })

    it('fetch receives an AbortSignal', async () => {
      mockAuth.getToken.mockResolvedValue('token')
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { id: '1' } }),
      })

      await apiClient.get('/v1/x')
      const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(opts.signal).toBeInstanceOf(AbortSignal)
    })

    it('loading store requestFinished fires on token timeout', async () => {
      mockAuth.getToken.mockImplementation(() => new Promise(() => {}))
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { id: '1' } }),
      })

      const promise = apiClient.get('/v1/x')
      expect(useLoadingStore.getState().pendingCount).toBe(1)
      vi.advanceTimersByTime(15_000)
      await expect(promise).rejects.toThrow()
      expect(useLoadingStore.getState().pendingCount).toBe(0)
    })
  })
})
