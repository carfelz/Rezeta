import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Logger } from '@nestjs/common'
import { LogsController } from '../logs.controller.js'
import type { ClientErrorDto } from '@rezeta/shared'

describe('LogsController', () => {
  let controller: LogsController
  let loggerError: ReturnType<typeof vi.spyOn>
  let loggerWarn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    controller = new LogsController()
    loggerError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    loggerWarn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs error with context and message', () => {
    const dto: ClientErrorDto = {
      message: 'Something broke',
      context: 'ErrorBoundary',
      severity: 'error',
    }
    controller.report(dto)
    expect(loggerError).toHaveBeenCalledWith('[ErrorBoundary] Something broke')
  })

  it('appends stack to error log when present', () => {
    const dto: ClientErrorDto = {
      message: 'Crash',
      stack: 'Error\n  at Component',
      severity: 'error',
    }
    controller.report(dto)
    expect(loggerError).toHaveBeenCalledWith('[unknown] Crash\nError\n  at Component')
  })

  it('uses unknown context when not provided', () => {
    const dto: ClientErrorDto = { message: 'No context', severity: 'error' }
    controller.report(dto)
    expect(loggerError).toHaveBeenCalledWith('[unknown] No context')
  })

  it('logs warn when severity is warn', () => {
    const dto: ClientErrorDto = {
      message: 'Suspicious state',
      context: 'QueryCache',
      severity: 'warn',
    }
    controller.report(dto)
    expect(loggerWarn).toHaveBeenCalledWith('[QueryCache] Suspicious state')
    expect(loggerError).not.toHaveBeenCalled()
  })

  it('defaults to error when severity is omitted', () => {
    const dto: ClientErrorDto = { message: 'Unknown severity' }
    controller.report(dto)
    expect(loggerError).toHaveBeenCalled()
  })

  it('returns void (no content)', () => {
    const dto: ClientErrorDto = { message: 'test', severity: 'error' }
    const result = controller.report(dto)
    expect(result).toBeUndefined()
  })
})
