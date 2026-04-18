import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@rezeta/shared'

const STUB_AUTH = import.meta.env['VITE_STUB_AUTH'] === 'true'

const STUB_USER: AuthUser = {
  id: 'dev-user-id',
  tenantId: 'dev-tenant-id',
  firebaseUid: 'dev-firebase-uid',
  email: 'demo@rezeta.app',
  fullName: 'Dr. Juan García',
  role: 'owner',
  specialty: 'Cardiología',
  licenseNumber: 'CMP-12345',
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    if (STUB_AUTH) {
      setUser(STUB_USER)
      setLoading(false)
      return
    }

    // Real Firebase auth — only runs when VITE_STUB_AUTH is not set
    let unsubscribe: (() => void) | undefined

    async function initFirebaseAuth() {
      const { onAuthStateChanged } = await import('firebase/auth')
      const { auth } = await import('@/lib/firebase')
      const { apiClient } = await import('@/lib/api-client')

      if (!auth) {
        setUser(null)
        setLoading(false)
        return
      }

      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        void (async () => {
          if (!firebaseUser) {
            setUser(null)
            setLoading(false)
            return
          }

          try {
            const user = await apiClient.get<AuthUser>('/v1/me')
            setUser(user)
          } catch {
            setUser(null)
          } finally {
            setLoading(false)
          }
        })()
      })
    }

    void initFirebaseAuth()
    return () => unsubscribe?.()
  }, [setUser, setLoading])

  return <>{children}</>
}
