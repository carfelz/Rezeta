import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
}))

import { apiClient, ApiRequestError } from '../api-client'
import { auth } from '@/lib/firebase'

const mockAuth = auth as { currentUser: null | { getIdToken: () => Promise<string> } }

function _makeFetchMock(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
  })
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
    mockAuth.currentUser = null
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
      mockAuth.currentUser = {
        getIdToken: vi.fn().mockResolvedValue('my-token'),
      }
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
})
