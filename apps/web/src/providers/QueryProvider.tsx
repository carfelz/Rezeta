import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiRequestError } from '@/lib/api-client'
import { ErrorCode } from '@rezeta/shared'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        if (
          error instanceof ApiRequestError &&
          (error.error.code === ErrorCode.UNAUTHORIZED ||
            error.error.code === ErrorCode.FORBIDDEN ||
            error.error.code === ErrorCode.NOT_FOUND)
        ) {
          return false
        }
        return failureCount < 2
      },
    },
  },
})

export function QueryProvider({ children }: { children: ReactNode }): JSX.Element {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
