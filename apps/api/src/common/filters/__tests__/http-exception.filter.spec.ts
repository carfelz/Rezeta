import { HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import { Prisma } from '@rezeta/db'
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

  it('handles non-HttpException as 500 INTERNAL_ERROR (prod masks message)', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const exception = new Error('Unexpected crash')
      filter.catch(exception, host)
      expect(statusFn).toHaveBeenCalledWith(500)
      const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string; message: string } }
      expect(arg.error.code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(arg.error.message).toBe('Internal server error')
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it('surfaces real exception message + stack in non-prod', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      const exception = new Error('Unexpected crash')
      filter.catch(exception, host)
      expect(statusFn).toHaveBeenCalledWith(500)
      const arg = jsonFn.mock.calls[0]?.[0] as {
        error: { code: string; message: string; details?: { exception?: string; stack?: string } }
      }
      expect(arg.error.code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(arg.error.message).toBe('Unexpected crash')
      expect(arg.error.details?.exception).toBe('Error')
      expect(arg.error.details?.stack).toContain('Error')
    } finally {
      process.env.NODE_ENV = prev
    }
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

  it('maps Prisma P2002 unique violation to 409 RESOURCE_CONFLICT', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`tenant_id`,`name`)',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['tenant_id', 'name'] } },
      )
      filter.catch(exception, host)
      expect(statusFn).toHaveBeenCalledWith(409)
      const arg = jsonFn.mock.calls[0]?.[0] as {
        error: { code: string; message: string; details?: { target?: unknown } }
      }
      expect(arg.error.code).toBe(ErrorCode.RESOURCE_CONFLICT)
      expect(arg.error.details?.target).toEqual(['tenant_id', 'name'])
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it('omits Prisma P2002 target details in production', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const exception = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['tenant_id', 'name'] },
      })
      filter.catch(exception, host)
      expect(statusFn).toHaveBeenCalledWith(409)
      const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string; details?: unknown } }
      expect(arg.error.code).toBe(ErrorCode.RESOURCE_CONFLICT)
      expect(arg.error.details).toBeUndefined()
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it('maps Prisma P2025 record-not-found to 404 NOT_FOUND', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    })
    filter.catch(exception, host)
    expect(statusFn).toHaveBeenCalledWith(404)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string } }
    expect(arg.error.code).toBe(ErrorCode.NOT_FOUND)
  })

  it('maps Prisma P2003 foreign-key violation to 409 RESOURCE_CONFLICT', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: 'test',
      meta: { field_name: 'patient_id' },
    })
    filter.catch(exception, host)
    expect(statusFn).toHaveBeenCalledWith(409)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string } }
    expect(arg.error.code).toBe(ErrorCode.RESOURCE_CONFLICT)
  })

  it('maps Prisma P2023 malformed input value to 400 VALIDATION_ERROR', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('Malformed UUID', {
      code: 'P2023',
      clientVersion: 'test',
    })
    filter.catch(exception, host)
    expect(statusFn).toHaveBeenCalledWith(400)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string } }
    expect(arg.error.code).toBe(ErrorCode.VALIDATION_ERROR)
  })

  it('maps PrismaClientValidationError to 400 VALIDATION_ERROR', () => {
    const exception = new Prisma.PrismaClientValidationError('Invalid arguments', {
      clientVersion: 'test',
    })
    filter.catch(exception, host)
    expect(statusFn).toHaveBeenCalledWith(400)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string } }
    expect(arg.error.code).toBe(ErrorCode.VALIDATION_ERROR)
  })

  it('treats other Prisma known errors as 500 INTERNAL_ERROR', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('Timed out', {
      code: 'P2024',
      clientVersion: 'test',
    })
    filter.catch(exception, host)
    expect(statusFn).toHaveBeenCalledWith(500)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { code: string } }
    expect(arg.error.code).toBe(ErrorCode.INTERNAL_ERROR)
  })

  it('falls back to exception.message when body is object without code field', () => {
    const exception = new HttpException({ unrelated: 'info' }, HttpStatus.BAD_REQUEST)
    filter.catch(exception, host)
    const arg = jsonFn.mock.calls[0]?.[0] as { error: { message: string } }
    expect(arg.error.message).toBe(exception.message)
  })
})
