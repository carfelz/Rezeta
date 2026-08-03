/* eslint-disable @typescript-eslint/unbound-method */
import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js'
import { LoginRoutingController } from '../login-routing.controller.js'
import type { LoginRoutingService } from '../login-routing.service.js'

describe('LoginRoutingController', () => {
  it('marks loginMethods as public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, LoginRoutingController.prototype.loginMethods)).toBe(true)
  })

  it('delegates the parsed body to the service', async () => {
    const response = { methods: ['password', 'google'] }
    const service = { methodsForEmail: vi.fn().mockResolvedValue(response) } as unknown as LoginRoutingService

    const result = await new LoginRoutingController(service).loginMethods({ email: 'doctor@gmail.com' })

    expect(service.methodsForEmail).toHaveBeenCalledWith('doctor@gmail.com')
    expect(result).toBe(response)
  })
})
