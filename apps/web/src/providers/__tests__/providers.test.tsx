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
    get: vi.fn(),
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
