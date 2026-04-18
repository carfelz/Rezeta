import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import { ErrorCode, type ApiError } from '@rezeta/shared'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
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
          code: this.statusToCode(status),
          message: typeof body === 'string' ? body : exception.message,
        }
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR
      error = { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' }
      this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : exception)
    }

    response.status(status).json({ error })
  }

  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.UNAUTHORIZED: return ErrorCode.UNAUTHORIZED
      case HttpStatus.FORBIDDEN: return ErrorCode.FORBIDDEN
      case HttpStatus.NOT_FOUND: return ErrorCode.NOT_FOUND
      case HttpStatus.UNPROCESSABLE_ENTITY: return ErrorCode.VALIDATION_ERROR
      default: return ErrorCode.INTERNAL_ERROR
    }
  }
}
