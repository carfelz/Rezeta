import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiRequestError } from '@/lib/api-client'
import { ErrorCode } from '@rezeta/shared'
import { logger } from '@/lib/logger'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error(error.message, {
        stack: error.stack,
        context: `query:${String(query.queryKey[0])}`,
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      const key = mutation.options.mutationKey?.[0]
      logger.error(error.message, {
        stack: error.stack,
        context: `mutation:${typeof key === 'string' ? key : 'unknown'}`,
      })
    },
  }),
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
