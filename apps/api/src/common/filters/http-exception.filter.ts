import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import { Prisma } from '@rezeta/db'
import { ErrorCode, type ApiError } from '@rezeta/shared'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status: number
    let error: ApiError

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const body = exception.getResponse()

      if (typeof body === 'object' && body !== null && 'code' in body) {
        error = body as ApiError
      } else {
        error = {
          code: this.statusToCode(exception.getStatus() as HttpStatus),
          message: typeof body === 'string' ? body : exception.message,
        }
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      // Unique constraint violation — surface as a clean 409 instead of a 500.
      status = HttpStatus.CONFLICT
      const isProd = process.env.NODE_ENV === 'production'
      error = {
        code: ErrorCode.RESOURCE_CONFLICT,
        message: 'A record with these values already exists',
        ...(isProd ? {} : { details: { target: exception.meta?.target } }),
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2025'
    ) {
      // Record required by the operation was not found — a clean 404.
      status = HttpStatus.NOT_FOUND
      error = { code: ErrorCode.NOT_FOUND, message: 'Resource not found' }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2003'
    ) {
      // Foreign-key constraint failure — a referenced record is missing or in
      // use. Surface as a 409 conflict instead of a 500.
      status = HttpStatus.CONFLICT
      const isProd = process.env.NODE_ENV === 'production'
      error = {
        code: ErrorCode.RESOURCE_CONFLICT,
        message: 'The operation violates a reference constraint',
        ...(isProd ? {} : { details: { field: exception.meta?.field_name } }),
      }
    } else if (
      (exception instanceof Prisma.PrismaClientKnownRequestError &&
        exception.code === 'P2023') ||
      exception instanceof Prisma.PrismaClientValidationError
    ) {
      // Malformed input value (e.g. a non-UUID id) or otherwise invalid query
      // arguments — the caller sent bad data, so this is a 400, not a 500.
      status = HttpStatus.BAD_REQUEST
      error = { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid request value' }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR
      const isProd = process.env.NODE_ENV === 'production'
      const err = exception instanceof Error ? exception : null
      error = {
        code: ErrorCode.INTERNAL_ERROR,
        message: isProd ? 'Internal server error' : (err?.message ?? 'Internal server error'),
        ...(isProd
          ? {}
          : {
              details: {
                exception: err?.name ?? typeof exception,
                stack: err?.stack?.split('\n').slice(0, 8).join('\n'),
              },
            }),
      }
      this.logger.error('Unhandled exception', err?.stack ?? String(exception))
    }

    response.status(status).json({ error })
  }

  private statusToCode(status: HttpStatus): ErrorCode {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.VALIDATION_ERROR
      default:
        return ErrorCode.INTERNAL_ERROR
    }
  }
}
