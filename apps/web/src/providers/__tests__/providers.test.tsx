import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))

const mocks = vi.hoisted(() => ({
  onAuthStateChangedCb: null as null | ((session: unknown) => void),
  signOut: vi.fn().mockResolvedValue(undefined),
  apiPost: vi.fn(),
  apiGet: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authClient: {
    onAuthStateChanged: (cb: (session: unknown) => void) => {
      mocks.onAuthStateChangedCb = cb
      return () => {
        mocks.onAuthStateChangedCb = null
      }
    },
    signOut: mocks.signOut,
    signIn: vi.fn(),
    getToken: vi.fn().mockResolvedValue(null),
    errorCodeToMessage: vi.fn((c: string) => c),
  },
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get post() {
      return mocks.apiPost
    },
    get get() {
      return mocks.apiGet
    },
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiRequestError: class ApiRequestError extends Error {
    constructor(public error: { code: string; message: string }) {
      super(error.message)
    }
  },
}))

describe('QueryProvider', () => {
  it('renders children', async () => {
    const { QueryProvider } = await import('../QueryProvider')
    render(
      <QueryProvider>
        <span>child</span>
      </QueryProvider>,
    )
    expect(screen.getByText('child')).toBeInTheDocument()
  })
})

describe('AuthProvider — onAuthStateChanged callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onAuthStateChangedCb = null
    mocks.signOut.mockResolvedValue(undefined)
    // Default: no test relies on GET /v1/staff/me unless it opts in by
    // overriding this — surfaces tests that forgot to mock it explicitly
    // instead of silently resolving `undefined` as a principal.
    mocks.apiGet.mockRejectedValue(new Error('GET /v1/staff/me not mocked in this test'))
  })

  it('handles session=null (unauthenticated)', async () => {
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>nouser</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(null)
    })
    expect(screen.getByText('nouser')).toBeInTheDocument()
  })

  it('handles session present with successful provision', async () => {
    const mockProvisionedUser = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'doc@test.com',
      fullName: 'Dr. Test',
      role: 'super_admin',
      externalUid: 'fb-uid',
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: null,
    }
    mocks.apiPost.mockResolvedValue(mockProvisionedUser)

    const session = { uid: 'fb-uid', email: 'doc@test.com' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>withuser</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByText('withuser')).toBeInTheDocument())
  })

  it('always provisions with an empty body (no signup-profile path)', async () => {
    mocks.apiPost.mockResolvedValue({
      id: 'u',
      tenantId: 't',
      email: 'doc@test.com',
      fullName: 'Dr. Solo',
      role: 'super_admin',
      externalUid: 'fb-uid',
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: null,
    })

    const session = { uid: 'fb-uid', email: 'doc@test.com' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>nospecialty</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })
    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith('/v1/auth/provision', {}))
  })

  it('signs out when provision fails with an Error', async () => {
    mocks.apiPost.mockRejectedValue(new Error('provision failed'))

    const session = { uid: 'fb-uid', email: 'doc@test.com' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>failcase</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByText('failcase')).toBeInTheDocument())
    expect(mocks.signOut).toHaveBeenCalled()
  })

  it('signs out when provision fails with a non-Error value', async () => {
    mocks.apiPost.mockRejectedValue('string rejection')

    const session = { uid: 'fb-uid', email: 'doc@test.com' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>nonerrcase</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByText('nonerrcase')).toBeInTheDocument())
    expect(mocks.signOut).toHaveBeenCalled()
  })

  it('does NOT sign out when provision 401s with USER_NOT_PROVISIONED (platform-staff identity)', async () => {
    const { ApiRequestError } = await import('@/lib/api-client')
    mocks.apiPost.mockRejectedValue(
      new ApiRequestError({ code: 'USER_NOT_PROVISIONED', message: 'User has not been provisioned.' }),
    )

    const session = { uid: 'staff-uid', email: 'staff@rezeta.com' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>platformcase</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByText('platformcase')).toBeInTheDocument())
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('keeps the store session for an unprovisioned platform identity', async () => {
    // The Firebase session is deliberately left alive for this case, so the
    // store must reflect that — RequirePlatform reads it to tell a staff
    // identity with no PlatformUser row apart from nobody being signed in.
    const { ApiRequestError } = await import('@/lib/api-client')
    mocks.apiPost.mockRejectedValue(
      new ApiRequestError({ code: 'USER_NOT_PROVISIONED', message: 'User has not been provisioned.' }),
    )
    const { useAuthStore } = await import('@/store/auth.store')

    const session = { uid: 'staff-uid', email: 'staff@rezeta.co' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>sessionkept</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })

    await waitFor(() => expect(useAuthStore.getState().status).toBe('unauthenticated'))
    expect(useAuthStore.getState().session).toEqual(session)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('clears the store session when a failed provision does sign the user out', async () => {
    const { ApiRequestError } = await import('@/lib/api-client')
    mocks.apiPost.mockRejectedValue(
      new ApiRequestError({ code: 'INTERNAL_ERROR', message: 'boom' }),
    )
    const { useAuthStore } = await import('@/store/auth.store')

    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>sessioncleared</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.({ uid: 'fb-uid' })
      await Promise.resolve()
    })

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled())
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('resolves identity=anonymous when no provider session is present', async () => {
    const { useAuthStore } = await import('@/store/auth.store')
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>anon</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(null)
    })
    expect(useAuthStore.getState().identity).toEqual({ kind: 'anonymous' })
  })

  it('resolves identity=clinic on successful provision', async () => {
    const mockProvisionedUser = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'doc@test.com',
      fullName: 'Dr. Test',
      role: 'super_admin',
      externalUid: 'fb-uid',
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: null,
    }
    mocks.apiPost.mockResolvedValue(mockProvisionedUser)
    const { useAuthStore } = await import('@/store/auth.store')

    const session = { uid: 'fb-uid', email: 'doc@test.com' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>clinicidentity</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })

    await waitFor(() =>
      expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: mockProvisionedUser }),
    )
    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  it('resolves identity=anonymous and signs out on a genuine provision failure', async () => {
    mocks.apiPost.mockRejectedValue(new Error('provision failed'))
    const { useAuthStore } = await import('@/store/auth.store')

    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>anonfail</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.({ uid: 'fb-uid' })
      await Promise.resolve()
    })

    await waitFor(() => expect(useAuthStore.getState().identity).toEqual({ kind: 'anonymous' }))
    expect(mocks.signOut).toHaveBeenCalled()
  })

  it('resolves identity=staff when provision 401s USER_NOT_PROVISIONED and GET /v1/staff/me succeeds', async () => {
    const { ApiRequestError } = await import('@/lib/api-client')
    mocks.apiPost.mockRejectedValue(
      new ApiRequestError({ code: 'USER_NOT_PROVISIONED', message: 'User has not been provisioned.' }),
    )
    const mockPrincipal = {
      id: 'platform-1',
      externalUid: 'staff-uid',
      email: 'staff@rezeta.com',
      fullName: 'Staff Member',
    }
    mocks.apiGet.mockResolvedValue(mockPrincipal)
    const { useAuthStore } = await import('@/store/auth.store')

    const session = { uid: 'staff-uid', email: 'staff@rezeta.com' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>staffidentity</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })

    await waitFor(() =>
      expect(useAuthStore.getState().identity).toEqual({ kind: 'staff', principal: mockPrincipal }),
    )
    expect(mocks.apiGet).toHaveBeenCalledWith('/v1/staff/me', { skipSignOutOn401: true })
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(useAuthStore.getState().session).toEqual(session)
    expect(useAuthStore.getState().status).toBe('unauthenticated')
  })

  it('resolves identity=unprovisioned when provision 401s USER_NOT_PROVISIONED and GET /v1/staff/me also fails', async () => {
    const { ApiRequestError } = await import('@/lib/api-client')
    mocks.apiPost.mockRejectedValue(
      new ApiRequestError({ code: 'USER_NOT_PROVISIONED', message: 'User has not been provisioned.' }),
    )
    mocks.apiGet.mockRejectedValue(
      new ApiRequestError({ code: 'UNAUTHORIZED', message: 'no platform principal' }),
    )
    const { useAuthStore } = await import('@/store/auth.store')

    const session = { uid: 'staff-uid', email: 'staff@rezeta.co' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>unprovisionedidentity</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })

    await waitFor(() => expect(useAuthStore.getState().identity).toEqual({ kind: 'unprovisioned' }))
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(useAuthStore.getState().session).toEqual(session)
  })

  it('does not log at error level for the expected USER_NOT_PROVISIONED (platform-staff) path', async () => {
    const { logger } = await import('@/lib/logger')
    const mockLogger = logger as unknown as { error: ReturnType<typeof vi.fn> }
    const { ApiRequestError } = await import('@/lib/api-client')
    mocks.apiPost.mockRejectedValue(
      new ApiRequestError({ code: 'USER_NOT_PROVISIONED', message: 'User has not been provisioned.' }),
    )

    const session = { uid: 'staff-uid', email: 'staff@rezeta.com' }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>nologerror</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(session)
      await Promise.resolve()
    })

    await waitFor(() => expect(screen.getByText('nologerror')).toBeInTheDocument())
    expect(mockLogger.error).not.toHaveBeenCalled()
  })

  it('still logs at error level for a genuinely unexpected provision failure', async () => {
    const { logger } = await import('@/lib/logger')
    const mockLogger = logger as unknown as { error: ReturnType<typeof vi.fn> }
    mocks.apiPost.mockRejectedValue(new Error('provision failed'))

    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>logerrorcase</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.({ uid: 'fb-uid' })
      await Promise.resolve()
    })

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled())
    expect(mockLogger.error).toHaveBeenCalled()
  })
})

describe('Providers (composed)', () => {
  it('renders children through all providers', async () => {
    const { Providers } = await import('../index')
    await act(async () => {
      render(
        <Providers>
          <div>hello</div>
        </Providers>,
      )
    })
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
