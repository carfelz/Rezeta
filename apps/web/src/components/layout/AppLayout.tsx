import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: 'var(--color-n-500)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Cargando...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-sidebar pt-topbar min-w-0">
        <Topbar />
        <main className="py-8 px-12 max-w-layout">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
