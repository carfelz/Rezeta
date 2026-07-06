import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { GlobalLoadingIndicator } from './GlobalLoadingIndicator'

export interface AppLayoutProps {
  /**
   * Full-bleed pages (e.g. the consultation workspace) own their entire
   * viewport: no Topbar, no main gutters, and the content area is exactly
   * one viewport tall so the page itself never scrolls.
   */
  fullBleed?: boolean
}

export function AppLayout({ fullBleed = false }: AppLayoutProps): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  if (fullBleed) {
    return (
      <div className="flex h-dvh overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <GlobalLoadingIndicator />
        <main className="flex-1 lg:ml-sidebar min-w-0 h-dvh overflow-hidden">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:ml-sidebar pt-topbar min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
        <GlobalLoadingIndicator />
        <main className="py-8 px-4 sm:px-6 lg:px-12 max-w-layout">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
