import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { toastStrings } from '@/lib/toasts'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { useProtocols } from '../use-protocols'

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const CONTENT = { version: '1.0', template_version: '1.0', blocks: [] }

describe('useSaveVersion success toast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'v1', versionNumber: 2 })
  })

  it('toasts "publicada" when publishing', async () => {
    const { result } = renderHook(() => useProtocols().useSaveVersion('p1'), { wrapper })
    result.current.mutate({ content: CONTENT, changeSummary: null, publish: true })
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith(toastStrings.protocolVersionPublished)
  })

  it('toasts "borrador guardado" when saving a draft, not "publicada"', async () => {
    const { result } = renderHook(() => useProtocols().useSaveVersion('p1'), { wrapper })
    result.current.mutate({ content: CONTENT, changeSummary: null, publish: false })
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith(toastStrings.protocolDraftSaved)
    expect(toast.success).not.toHaveBeenCalledWith(toastStrings.protocolVersionPublished)
  })
})
