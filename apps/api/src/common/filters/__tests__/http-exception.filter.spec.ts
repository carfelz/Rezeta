import { HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import { HttpExceptionFilter } from '../http-exception.filter.js'
import { ErrorCode } from '@rezeta/shared'

function makeHost(statusFn = vi.fn(), jsonFn = vi.fn()): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: statusFn.mockReturnValue({ json: jsonFn }),
        json: jsonFn,
      }),
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter
  let statusFn: ReturnType<typeof vi.fn>
  let jsonFn: ReturnType<typeof vi.fn>
  let host: ArgumentsHost

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    filter = new HttpExceptionFilter()
    statusFn = vi.fn()
    jsonFn = vi.fn()
    host = makeHost(statusFn, jsonFn)
  })

  it('handles HttpException with structured error object', () => {
    const exception = new HttpException(
      { code: ErrorCode.NOT_FOUND, message: 'Patient not found' },
      HttpStatus.NOT_FOUND,
    )
    filter.catch(exception, host)
    expect(statusFn).toHaveBeenCalledWith(404)
    expect(jsonFn).toHaveBeenCalledWith({
      error: { code: ErrorCode.NOT_FOUND, message: 'Patient not found' },
    })
  })

  it('handles HttpException with a plain string message', () => {
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND)
    filter.catch(exception, host)
    expect(statusFn).toHaveBeenCalledWith(404)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string; message: string } }
    expect(arg.error.code).toBe(ErrorCode.NOT_FOUND)
    expect(arg.error.message).toBe('Not found')
  })

  it('maps 401 status to UNAUTHORIZED code', () => {
    const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED)
    filter.catch(exception, host)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string } }
    expect(arg.error.code).toBe(ErrorCode.UNAUTHORIZED)
  })

  it('maps 403 status to FORBIDDEN code', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN)
    filter.catch(exception, host)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string } }
    expect(arg.error.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('maps 422 status to VALIDATION_ERROR code', () => {
    const exception = new HttpException('Invalid', HttpStatus.UNPROCESSABLE_ENTITY)
    filter.catch(exception, host)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string } }
    expect(arg.error.code).toBe(ErrorCode.VALIDATION_ERROR)
  })

  it('handles unknown status with INTERNAL_ERROR', () => {
    const exception = new HttpException('Conflict', HttpStatus.CONFLICT)
    filter.catch(exception, host)
    expect(statusFn).toHaveBeenCalledWith(409)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string } }
    expect(arg.error.code).toBe(ErrorCode.INTERNAL_ERROR)
  })

  it('handles non-HttpException as 500 INTERNAL_ERROR', () => {
    const exception = new Error('Unexpected crash')
    filter.catch(exception, host)
    expect(statusFn).toHaveBeenCalledWith(500)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string; message: string } }
    expect(arg.error.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(arg.error.message).toBe('Internal server error')
  })

  it('logs error for non-HttpException', () => {
    const logSpy = vi.spyOn(Logger.prototype, 'error')
    filter.catch(new Error('boom'), host)
    expect(logSpy).toHaveBeenCalled()
  })

  it('handles non-Error thrown value as 500', () => {
    filter.catch('some string error', host)
    expect(statusFn).toHaveBeenCalledWith(500)
  })
})
