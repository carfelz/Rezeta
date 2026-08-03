/* eslint-disable @typescript-eslint/unbound-method */
import 'reflect-metadata'
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js'
import { describe, expect, it, vi } from 'vitest'
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js'
import { LoginRoutingController } from '../login-routing.controller.js'
import type { LoginRoutingService } from '../login-routing.service.js'

describe('LoginRoutingController', () => {
  it('marks loginMethods as public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, LoginRoutingController.prototype.loginMethods)).toBe(true)
  })

  it('responds 200 (not the POST default 201) on loginMethods', () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, LoginRoutingController.prototype.loginMethods)).toBe(200)
  })

  it('delegates the parsed body to the service', async () => {
    const response = { methods: ['password', 'google'] }
    const service = { methodsForEmail: vi.fn().mockResolvedValue(response) } as unknown as LoginRoutingService

    const result = await new LoginRoutingController(service).loginMethods({ email: 'doctor@gmail.com' })

    expect(service.methodsForEmail).toHaveBeenCalledWith('doctor@gmail.com')
    expect(result).toBe(response)
  })
})
