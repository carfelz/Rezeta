import { describe, it, expect } from 'vitest'
import { IS_PUBLIC_KEY, Public } from '../public.decorator.js'
import { IS_PROVISION_ROUTE_KEY, ProvisionRoute } from '../provision-route.decorator.js'
import { TenantId } from '../tenant-id.decorator.js'
import { CurrentUser } from '../current-user.decorator.js'

describe('Public decorator', () => {
  it('sets IS_PUBLIC_KEY metadata to true', () => {
    const decorator = Public()
    const target = {}
    const descriptor = Object.getOwnPropertyDescriptor(target, 'method') ?? {
      value: function () {},
      writable: true,
      enumerable: true,
      configurable: true,
    }
    decorator(target, 'method', descriptor)
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, descriptor.value)).toBe(true)
  })

  it('IS_PUBLIC_KEY equals isPublic', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic')
  })
})

describe('ProvisionRoute decorator', () => {
  it('sets IS_PROVISION_ROUTE_KEY metadata to true', () => {
    const decorator = ProvisionRoute()
    const target = {}
    const descriptor = Object.getOwnPropertyDescriptor(target, 'method') ?? {
      value: function () {},
      writable: true,
      enumerable: true,
      configurable: true,
    }
    decorator(target, 'method', descriptor)
    expect(Reflect.getMetadata(IS_PROVISION_ROUTE_KEY, descriptor.value)).toBe(true)
  })

  it('IS_PROVISION_ROUTE_KEY equals isProvisionRoute', () => {
    expect(IS_PROVISION_ROUTE_KEY).toBe('isProvisionRoute')
  })
})

describe('TenantId decorator', () => {
  it('is defined', () => {
    expect(TenantId).toBeDefined()
  })
})

describe('CurrentUser decorator', () => {
  it('is defined', () => {
    expect(CurrentUser).toBeDefined()
  })
})
