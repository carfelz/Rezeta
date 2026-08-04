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

function makeClinicUser(overrides: { id: string; externalUid: string; email: string }) {
  return {
    id: overrides.id,
    tenantId: 'tenant-1',
    email: overrides.email,
    fullName: 'Dr. Test',
    role: 'super_admin',
    externalUid: overrides.externalUid,
    specialty: null,
    licenseNumber: null,
    tenantSeededAt: null,
  }
}

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

  it('does not let a stale (out-of-order) resolution overwrite a newer identity', async () => {
    // Reproduces: a staff session starts resolving (provision 401s
    // USER_NOT_PROVISIONED, kicking off a GET /v1/staff/me probe), then a
    // doctor signs in on the same subscription and completes first. The
    // stale staff probe settling afterwards must not clobber the doctor's
    // identity — each onAuthStateChanged firing must be able to tell it is
    // no longer the latest before writing to the store.
    const { ApiRequestError } = await import('@/lib/api-client')
    const { useAuthStore } = await import('@/store/auth.store')

    let resolveStaffMe: (value: unknown) => void = () => {}
    mocks.apiGet.mockReturnValue(
      new Promise((resolve) => {
        resolveStaffMe = resolve
      }),
    )

    const clinicUser = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'doc@test.com',
      fullName: 'Dr. Test',
      role: 'super_admin',
      externalUid: 'doc-uid',
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: null,
    }
    mocks.apiPost
      .mockRejectedValueOnce(
        new ApiRequestError({ code: 'USER_NOT_PROVISIONED', message: 'User has not been provisioned.' }),
      )
      .mockResolvedValueOnce(clinicUser)

    const staffSession = { uid: 'staff-uid', email: 'staff@rezeta.com' }
    const clinicSession = { uid: 'doc-uid', email: 'doc@test.com' }

    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>racecase</span>
        </AuthProvider>,
      )
    })

    // Event A (staff) fires first and runs up to its GET /v1/staff/me probe,
    // which we hold open.
    await act(async () => {
      mocks.onAuthStateChangedCb?.(staffSession)
    })
    await waitFor(() =>
      expect(mocks.apiGet).toHaveBeenCalledWith('/v1/staff/me', { skipSignOutOn401: true }),
    )

    // Event B (a doctor signing in) fires on the same subscription and
    // completes before A's probe settles.
    await act(async () => {
      mocks.onAuthStateChangedCb?.(clinicSession)
    })
    await waitFor(() =>
      expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: clinicUser }),
    )

    // A's stale probe finally resolves — it must not overwrite B's identity.
    await act(async () => {
      resolveStaffMe({ id: 'p1', externalUid: 'staff-uid', email: 'staff@rezeta.com', fullName: null })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: clinicUser })
    expect(useAuthStore.getState().session).toEqual(clinicSession)
  })

  it('does not let a stale successful provision overwrite a newer identity', async () => {
    // Event A's provision call resolves *after* event B's — a doctor
    // switching tabs/sessions faster than A's slow network round-trip.
    const { useAuthStore } = await import('@/store/auth.store')

    let resolveA: (value: unknown) => void = () => {}
    const userA = makeClinicUser({ id: 'user-a', externalUid: 'a-uid', email: 'a@test.com' })
    const userB = makeClinicUser({ id: 'user-b', externalUid: 'b-uid', email: 'b@test.com' })

    mocks.apiPost
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveA = resolve
          }),
      )
      .mockResolvedValueOnce(userB)

    const sessionA = { uid: 'a-uid', email: 'a@test.com' }
    const sessionB = { uid: 'b-uid', email: 'b@test.com' }

    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>stalesuccess</span>
        </AuthProvider>,
      )
    })

    await act(async () => {
      mocks.onAuthStateChangedCb?.(sessionA)
    })
    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledTimes(1))

    await act(async () => {
      mocks.onAuthStateChangedCb?.(sessionB)
    })
    await waitFor(() =>
      expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: userB }),
    )

    // A's stale provision finally resolves — must not overwrite B's identity.
    await act(async () => {
      resolveA(userA)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: userB })
  })

  it('does not sign the newer session out when a stale provision failure resolves late', async () => {
    // Event A's provision call fails for a genuine (non-USER_NOT_PROVISIONED)
    // reason, but only after event B has already signed in successfully. A
    // must not call authClient.signOut(), which would sign B's live session
    // out — nor overwrite B's identity.
    const { useAuthStore } = await import('@/store/auth.store')

    let rejectA: (err: unknown) => void = () => {}
    const userB = makeClinicUser({ id: 'user-b2', externalUid: 'b2-uid', email: 'b2@test.com' })

    mocks.apiPost
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectA = reject
          }),
      )
      .mockResolvedValueOnce(userB)

    const sessionA = { uid: 'a2-uid', email: 'a2@test.com' }
    const sessionB = { uid: 'b2-uid', email: 'b2@test.com' }

    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>stalesignout</span>
        </AuthProvider>,
      )
    })

    await act(async () => {
      mocks.onAuthStateChangedCb?.(sessionA)
    })
    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledTimes(1))

    await act(async () => {
      mocks.onAuthStateChangedCb?.(sessionB)
    })
    await waitFor(() =>
      expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: userB }),
    )

    // A's stale provision failure finally arrives — must not sign B out.
    await act(async () => {
      rejectA(new Error('stale provision failure'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: userB })
    expect(useAuthStore.getState().session).toEqual(sessionB)
  })

  it('does not clear a newer session when a stale sign-out resolves late', async () => {
    // Event A's provision fails for a genuine reason and does call
    // authClient.signOut() (it is not yet stale at that point), but the
    // signOut() call itself is slow. Event B signs in and completes while
    // it is pending. Once the stale signOut() resolves, it must not clear
    // B's session/user/identity.
    const { useAuthStore } = await import('@/store/auth.store')

    let resolveSignOut: () => void = () => {}
    mocks.signOut.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSignOut = resolve
      }),
    )

    const userB = makeClinicUser({ id: 'user-b3', externalUid: 'b3-uid', email: 'b3@test.com' })
    mocks.apiPost
      .mockRejectedValueOnce(new Error('generic provision failure'))
      .mockResolvedValueOnce(userB)

    const sessionA = { uid: 'a3-uid', email: 'a3@test.com' }
    const sessionB = { uid: 'b3-uid', email: 'b3@test.com' }

    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>stalesignoutresolve</span>
        </AuthProvider>,
      )
    })

    await act(async () => {
      mocks.onAuthStateChangedCb?.(sessionA)
    })
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1))

    await act(async () => {
      mocks.onAuthStateChangedCb?.(sessionB)
    })
    await waitFor(() =>
      expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: userB }),
    )

    // The stale signOut() finally resolves — must not clear B's state.
    await act(async () => {
      resolveSignOut()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: userB })
    expect(useAuthStore.getState().session).toEqual(sessionB)
  })

  it('does not let a stale failed staff probe overwrite a newer identity', async () => {
    // Event A resolves to the USER_NOT_PROVISIONED branch and its
    // GET /v1/staff/me probe fails, but only after event B has already
    // signed in successfully. A must land on `unprovisioned`, not clobber
    // B's `clinic` identity.
    const { ApiRequestError } = await import('@/lib/api-client')
    const { useAuthStore } = await import('@/store/auth.store')

    let rejectStaffMe: (err: unknown) => void = () => {}
    mocks.apiGet.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectStaffMe = reject
      }),
    )

    const userB = makeClinicUser({ id: 'user-b4', externalUid: 'b4-uid', email: 'b4@test.com' })
    mocks.apiPost
      .mockRejectedValueOnce(
        new ApiRequestError({ code: 'USER_NOT_PROVISIONED', message: 'User has not been provisioned.' }),
      )
      .mockResolvedValueOnce(userB)

    const staffSession = { uid: 'staff2-uid', email: 'staff2@rezeta.com' }
    const sessionB = { uid: 'b4-uid', email: 'b4@test.com' }

    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>stalefailedprobe</span>
        </AuthProvider>,
      )
    })

    await act(async () => {
      mocks.onAuthStateChangedCb?.(staffSession)
    })
    await waitFor(() =>
      expect(mocks.apiGet).toHaveBeenCalledWith('/v1/staff/me', { skipSignOutOn401: true }),
    )

    await act(async () => {
      mocks.onAuthStateChangedCb?.(sessionB)
    })
    await waitFor(() =>
      expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: userB }),
    )

    // A's stale, failed staff probe finally settles — must not overwrite B.
    await act(async () => {
      rejectStaffMe(new Error('staff/me failed'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useAuthStore.getState().identity).toEqual({ kind: 'clinic', user: userB })
    expect(useAuthStore.getState().session).toEqual(sessionB)
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
