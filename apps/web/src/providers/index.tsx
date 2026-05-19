import type { ReactNode } from 'react'
import { QueryProvider } from './QueryProvider'
import { AuthProvider } from './AuthProvider'
import { AppToaster } from '@/components/ui/SonnerToaster'

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <AppToaster />
      </AuthProvider>
    </QueryProvider>
  )
}
