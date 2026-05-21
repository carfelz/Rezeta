import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('window', { location: { pathname: '/test' } })

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

import { logger } from '../logger'

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue(new Response(null, { status: 204 }))
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

describe('logger', () => {
  describe('logger.error', () => {
    it('calls console.error', () => {
      logger.error('test error', { context: 'TestComponent' })
      expect(consoleError).toHaveBeenCalled()
    })

    it('fires POST to client-error endpoint', async () => {
      logger.error('something broke', { context: 'MyHook', stack: 'Error\n  at ...' })
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/v1/logs/client-error')
      const body = JSON.parse(init.body as string) as Record<string, unknown>
      expect(body['message']).toBe('something broke')
      expect(body['severity']).toBe('error')
      expect(body['context']).toBe('MyHook')
      expect(body['stack']).toBe('Error\n  at ...')
    })

    it('includes url from window.location.pathname', async () => {
      logger.error('test')
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(init.body as string) as Record<string, unknown>
      expect(body['url']).toBe('/test')
    })

    it('does not throw when fetch rejects', () => {
      mockFetch.mockRejectedValueOnce(new Error('Network down'))
      expect(() => logger.error('boom')).not.toThrow()
    })
  })

  describe('logger.warn', () => {
    it('calls console.warn', () => {
      logger.warn('test warning', { context: 'Settings' })
      expect(consoleWarn).toHaveBeenCalled()
    })

    it('fires POST with severity warn', async () => {
      logger.warn('some warning', { context: 'Settings' })
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(init.body as string) as Record<string, unknown>
      expect(body['severity']).toBe('warn')
      expect(body['message']).toBe('some warning')
    })

    it('does not call console.error', () => {
      logger.warn('just a warning')
      expect(consoleError).not.toHaveBeenCalled()
    })
  })
})
