import { describe, it, expect } from 'vitest'
import { ClientErrorSchema } from '../../src/schemas/client-error.js'

describe('ClientErrorSchema', () => {
  it('accepts minimal payload with message only', () => {
    const result = ClientErrorSchema.parse({ message: 'Something broke' })
    expect(result.message).toBe('Something broke')
    expect(result.stack).toBeUndefined()
    expect(result.severity).toBeUndefined()
  })

  it('accepts full payload', () => {
    const result = ClientErrorSchema.parse({
      message: 'Render error',
      stack: 'Error\n  at Component',
      url: '/consultas/123',
      context: 'ErrorBoundary',
      severity: 'error',
    })
    expect(result.message).toBe('Render error')
    expect(result.stack).toBe('Error\n  at Component')
    expect(result.url).toBe('/consultas/123')
    expect(result.context).toBe('ErrorBoundary')
    expect(result.severity).toBe('error')
  })

  it('accepts severity warn', () => {
    const result = ClientErrorSchema.parse({ message: 'Warning', severity: 'warn' })
    expect(result.severity).toBe('warn')
  })

  it('rejects missing message', () => {
    expect(() => ClientErrorSchema.parse({})).toThrow()
  })

  it('rejects invalid severity value', () => {
    expect(() => ClientErrorSchema.parse({ message: 'test', severity: 'debug' })).toThrow()
  })

  it('rejects message exceeding 2000 characters', () => {
    expect(() => ClientErrorSchema.parse({ message: 'x'.repeat(2001) })).toThrow()
  })

  it('rejects stack exceeding 10000 characters', () => {
    expect(() => ClientErrorSchema.parse({ message: 'test', stack: 'x'.repeat(10001) })).toThrow()
  })

  it('rejects url exceeding 500 characters', () => {
    expect(() => ClientErrorSchema.parse({ message: 'test', url: 'x'.repeat(501) })).toThrow()
  })

  it('rejects context exceeding 200 characters', () => {
    expect(() => ClientErrorSchema.parse({ message: 'test', context: 'x'.repeat(201) })).toThrow()
  })
})
