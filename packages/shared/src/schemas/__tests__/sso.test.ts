import { describe, expect, it } from 'vitest'
import { CreateSsoConnectionSchema, UpdateSsoConnectionSchema, LoginMethodsRequestSchema } from '../sso.js'

describe('CreateSsoConnectionSchema', () => {
  const valid = {
    tenantId: '4b1c2f9e-0000-4000-8000-000000000001',
    displayName: 'Hospital General',
    issuerUrl: 'https://login.microsoftonline.com/x/v2.0',
    clientId: 'client-1',
    clientSecret: 'shhh',
    domains: ['hospitalgeneral.do'],
  }

  it('accepts a valid payload and defaults allowPassword to true', () => {
    const parsed = CreateSsoConnectionSchema.parse(valid)
    expect(parsed.allowPassword).toBe(true)
  })

  it('lowercases domains', () => {
    const parsed = CreateSsoConnectionSchema.parse({ ...valid, domains: ['Hospital.DO'] })
    expect(parsed.domains).toEqual(['hospital.do'])
  })

  it('rejects a non-https issuer', () => {
    expect(() => CreateSsoConnectionSchema.parse({ ...valid, issuerUrl: 'http://x.com' })).toThrow()
  })

  it('rejects an empty domains list', () => {
    expect(() => CreateSsoConnectionSchema.parse({ ...valid, domains: [] })).toThrow()
  })

  it('rejects a domain that is not a bare hostname', () => {
    expect(() => CreateSsoConnectionSchema.parse({ ...valid, domains: ['user@x.com'] })).toThrow()
  })
})

describe('UpdateSsoConnectionSchema', () => {
  it('accepts a partial payload without clientSecret', () => {
    expect(UpdateSsoConnectionSchema.parse({ displayName: 'Nuevo' })).toEqual({ displayName: 'Nuevo' })
  })
})

describe('LoginMethodsRequestSchema', () => {
  it('accepts an email and rejects a non-email', () => {
    expect(LoginMethodsRequestSchema.parse({ email: 'a@b.do' })).toEqual({ email: 'a@b.do' })
    expect(() => LoginMethodsRequestSchema.parse({ email: 'nope' })).toThrow()
  })
})
