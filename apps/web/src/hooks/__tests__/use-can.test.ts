import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCan } from '../use-can'
import { useAuthStore } from '@/store/auth.store'
import { makeAuthUser, seedAuthUser } from '@/test/auth-helpers'

afterEach(() => {
  seedAuthUser(null)
})

describe('useCan', () => {
  it('returns false when unauthenticated', () => {
    const { result } = renderHook(() => useCan('patients', 'view'))
    expect(result.current).toBe(false)
  })

  it('grants view but denies manage to an assistant on patients', () => {
    seedAuthUser(makeAuthUser('assistant'))
    expect(renderHook(() => useCan('patients', 'view')).result.current).toBe(true)
    expect(renderHook(() => useCan('patients', 'manage')).result.current).toBe(false)
  })

  it('grants manage to a doctor on patients', () => {
    seedAuthUser(makeAuthUser('doctor'))
    expect(renderHook(() => useCan('patients', 'manage')).result.current).toBe(true)
  })

  it('defaults the required level to view', () => {
    seedAuthUser(makeAuthUser('assistant'))
    expect(renderHook(() => useCan('patients')).result.current).toBe(true)
  })

  it('denies a module the role lacks entirely (assistant protocols)', () => {
    seedAuthUser(makeAuthUser('assistant'))
    expect(renderHook(() => useCan('protocols', 'view')).result.current).toBe(false)
  })

  it('reflects a capability override on the seeded user', () => {
    seedAuthUser(
      makeAuthUser('assistant', {
        capabilities: { ...makeAuthUser('assistant').capabilities, protocols: 'manage' },
      }),
    )
    expect(renderHook(() => useCan('protocols', 'manage')).result.current).toBe(true)
    // useAuthStore is a module singleton; assert the seed actually took effect.
    expect(useAuthStore.getState().user?.capabilities.protocols).toBe('manage')
  })
})
