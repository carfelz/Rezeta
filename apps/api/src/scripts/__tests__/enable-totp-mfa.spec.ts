import { describe, it, expect, vi } from 'vitest'
import { enableTotpMfa, resolveCredentials, isSelfInvoked } from '../enable-totp-mfa.js'

describe('enableTotpMfa', () => {
  it('calls updateProjectConfig with TOTP enabled and 5 adjacent intervals', async () => {
    const updateProjectConfig = vi.fn().mockResolvedValue({
      multiFactorConfig: { state: 'ENABLED', providerConfigs: [{ state: 'ENABLED' }] },
    })
    const result = await enableTotpMfa({ projectConfigManager: { updateProjectConfig } as never })
    expect(updateProjectConfig).toHaveBeenCalledWith({
      multiFactorConfig: {
        state: 'ENABLED',
        providerConfigs: [{ state: 'ENABLED', totpProviderConfig: { adjacentIntervals: 5 } }],
      },
    })
    expect(result.multiFactorConfig?.state).toBe('ENABLED')
  })

  it('is idempotent — re-applying the same desired state is a no-op call shape', async () => {
    const updateProjectConfig = vi.fn().mockResolvedValue({
      multiFactorConfig: { state: 'ENABLED', providerConfigs: [{ state: 'ENABLED' }] },
    })
    await enableTotpMfa({ projectConfigManager: { updateProjectConfig } as never })
    await enableTotpMfa({ projectConfigManager: { updateProjectConfig } as never })
    expect(updateProjectConfig).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ multiFactorConfig: expect.objectContaining({ state: 'ENABLED' }) }),
    )
    expect(updateProjectConfig).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ multiFactorConfig: expect.objectContaining({ state: 'ENABLED' }) }),
    )
  })
})

describe('resolveCredentials', () => {
  const ORIGINAL_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('reads explicit FIREBASE_* env vars', () => {
    process.env['FIREBASE_PROJECT_ID'] = 'p1'
    process.env['FIREBASE_CLIENT_EMAIL'] = 'c1@x.iam.gserviceaccount.com'
    process.env['FIREBASE_PRIVATE_KEY'] = 'key1'
    delete process.env['FIREBASE_ADMIN_KEY']
    expect(resolveCredentials()).toEqual({ projectId: 'p1', clientEmail: 'c1@x.iam.gserviceaccount.com', privateKey: 'key1' })
  })

  it('falls back to FIREBASE_ADMIN_KEY JSON blob', () => {
    delete process.env['FIREBASE_PROJECT_ID']
    delete process.env['FIREBASE_CLIENT_EMAIL']
    delete process.env['FIREBASE_PRIVATE_KEY']
    process.env['FIREBASE_ADMIN_KEY'] = JSON.stringify({
      project_id: 'jp',
      client_email: 'jc@x.com',
      private_key: 'jk',
    })
    expect(resolveCredentials()).toEqual({ projectId: 'jp', clientEmail: 'jc@x.com', privateKey: 'jk' })
  })

  it('returns null when no credentials are configured', () => {
    delete process.env['FIREBASE_PROJECT_ID']
    delete process.env['FIREBASE_CLIENT_EMAIL']
    delete process.env['FIREBASE_PRIVATE_KEY']
    delete process.env['FIREBASE_ADMIN_KEY']
    expect(resolveCredentials()).toBeNull()
  })

  it('returns null on malformed FIREBASE_ADMIN_KEY JSON', () => {
    delete process.env['FIREBASE_PROJECT_ID']
    process.env['FIREBASE_ADMIN_KEY'] = '{not-json'
    expect(resolveCredentials()).toBeNull()
  })
})

describe('isSelfInvoked', () => {
  it('matches the source script invocation (ts-node/tsx)', () => {
    expect(isSelfInvoked('/app/apps/api/src/scripts/enable-totp-mfa.ts')).toBe(true)
  })

  it('matches the compiled script invocation (node dist)', () => {
    expect(isSelfInvoked('/app/apps/api/dist/scripts/enable-totp-mfa.js')).toBe(true)
  })

  it('does not match when imported by a test runner', () => {
    expect(isSelfInvoked('/app/apps/api/src/scripts/__tests__/enable-totp-mfa.spec.ts')).toBe(false)
  })

  it('does not match when argv[1] is undefined', () => {
    expect(isSelfInvoked(undefined)).toBe(false)
  })
})
