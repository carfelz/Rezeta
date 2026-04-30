import type { ExecutionContext, CallHandler } from '@nestjs/common'
import { of } from 'rxjs'
import { firstValueFrom } from 'rxjs'
import { ResponseEnvelopeInterceptor } from '../response-envelope.interceptor.js'

function makeContext(): ExecutionContext {
  return {} as ExecutionContext
}

function makeHandler(data: unknown): CallHandler {
  return { handle: () => of(data) }
}

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor()

  it('wraps a plain object in { data }', async () => {
    const payload = { id: '1', name: 'Test' }
    const result = await firstValueFrom(interceptor.intercept(makeContext(), makeHandler(payload)))
    expect(result).toEqual({ data: payload })
  })

  it('wraps an array in { data }', async () => {
    const payload = [1, 2, 3]
    const result = await firstValueFrom(interceptor.intercept(makeContext(), makeHandler(payload)))
    expect(result).toEqual({ data: payload })
  })

  it('wraps null in { data: null }', async () => {
    const result = await firstValueFrom(interceptor.intercept(makeContext(), makeHandler(null)))
    expect(result).toEqual({ data: null })
  })

  it('wraps a primitive string in { data }', async () => {
    const result = await firstValueFrom(interceptor.intercept(makeContext(), makeHandler('hello')))
    expect(result).toEqual({ data: 'hello' })
  })

  it('does not call the handler twice', () => {
    const handleSpy = vi.fn(() => of('value'))
    const handler: CallHandler = { handle: handleSpy }
    interceptor.intercept(makeContext(), handler).subscribe()
    expect(handleSpy).toHaveBeenCalledTimes(1)
  })
})
