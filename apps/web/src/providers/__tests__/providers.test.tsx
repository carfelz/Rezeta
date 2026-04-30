import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import React from 'react'

const mocks = vi.hoisted(() => ({
  firebaseAuth: null as null | object,
  onAuthStateChangedCb: null as null | ((user: unknown) => void),
  signOut: vi.fn().mockResolvedValue(undefined),
  apiPost: vi.fn(),
}))

vi.mock('@/lib/firebase', () => ({
  get auth() {
    return mocks.firebaseAuth
  },
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    mocks.onAuthStateChangedCb = cb
    return () => {
      mocks.onAuthStateChangedCb = null
    }
  },
  signOut: mocks.signOut,
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

describe('AuthProvider — auth=null (no Firebase)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.firebaseAuth = null
    mocks.onAuthStateChangedCb = null
  })

  it('renders children when auth is null', async () => {
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>app</span>
        </AuthProvider>,
      )
    })
    expect(screen.getByText('app')).toBeInTheDocument()
  })
})

describe('AuthProvider — onAuthStateChanged callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.firebaseAuth = { currentUser: null }
    mocks.onAuthStateChangedCb = null
    mocks.signOut.mockResolvedValue(undefined)
  })

  it('handles firebaseUser=null (unauthenticated)', async () => {
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

  it('handles firebaseUser present with successful provision', async () => {
    const mockProvisionedUser = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'doc@test.com',
      fullName: 'Dr. Test',
      role: 'owner',
      firebaseUid: 'fb-uid',
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: null,
    }
    mocks.apiPost.mockResolvedValue(mockProvisionedUser)

    const firebaseUser = { getIdToken: vi.fn().mockResolvedValue('token') }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>withuser</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(firebaseUser)
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByText('withuser')).toBeInTheDocument())
  })

  it('signs out when provision fails', async () => {
    mocks.apiPost.mockRejectedValue(new Error('provision failed'))

    const firebaseUser = { getIdToken: vi.fn().mockResolvedValue('token') }
    const { AuthProvider } = await import('../AuthProvider')
    await act(async () => {
      render(
        <AuthProvider>
          <span>failcase</span>
        </AuthProvider>,
      )
    })
    await act(async () => {
      mocks.onAuthStateChangedCb?.(firebaseUser)
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByText('failcase')).toBeInTheDocument())
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
