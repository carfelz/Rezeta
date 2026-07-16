/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect } from 'vitest'
import { Reflector } from '@nestjs/core'
import { ForbiddenException, type ExecutionContext } from '@nestjs/common'
import { ErrorCode, defaultCapabilitiesFor, type CapabilityMap } from '@rezeta/shared'
import { PermissionGuard } from '../permission.guard.js'
import { PatientsController } from '../../../modules/patients/patients.controller.js'

/**
 * Build a context whose getHandler() returns a REAL decorated controller method,
 * so the guard reads the actual @RequirePermission metadata via a real Reflector.
 */
function ctxFor(
  handler: (...args: unknown[]) => unknown,
  capabilities: CapabilityMap,
): ExecutionContext {
  const request = { user: { capabilities } }
  return {
    getHandler: () => handler,
    getClass: () => PatientsController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

describe('PermissionGuard × PatientsController (integration)', () => {
  const guard = new PermissionGuard(new Reflector())
  const create = PatientsController.prototype.create // @RequirePermission('patients', 'manage')
  const list = PatientsController.prototype.list // @RequirePermission('patients', 'view')

  it('denies an assistant (patients: view) on the manage endpoint with a 403 code', () => {
    const assistant = defaultCapabilitiesFor('assistant')
    expect(assistant.patients).toBe('view')
    try {
      guard.canActivate(ctxFor(create as never, assistant))
      expect.unreachable('assistant should be forbidden from creating patients')
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException)
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: ErrorCode.INSUFFICIENT_PERMISSION,
      })
    }
  })

  it('allows a doctor (patients: manage) on the manage endpoint', () => {
    const doctor = defaultCapabilitiesFor('doctor')
    expect(doctor.patients).toBe('manage')
    expect(guard.canActivate(ctxFor(create as never, doctor))).toBe(true)
  })

  it('allows an assistant on the view endpoint', () => {
    const assistant = defaultCapabilitiesFor('assistant')
    expect(guard.canActivate(ctxFor(list as never, assistant))).toBe(true)
  })
})
