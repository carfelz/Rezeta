import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { toastStrings } from '@/lib/toasts'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  useCreatePrescription,
  useCreateImagingOrder,
  useCreateLabOrder,
} from '../consultations/use-consultations'

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const RX_DTO: Parameters<ReturnType<typeof useCreatePrescription>['mutateAsync']>[0] = {
  items: [],
  groupOrder: 1,
}
const IMG_DTO: Parameters<ReturnType<typeof useCreateImagingOrder>['mutateAsync']>[0] = {
  items: [],
  groupOrder: 1,
}
const LAB_DTO: Parameters<ReturnType<typeof useCreateLabOrder>['mutateAsync']>[0] = {
  items: [],
  groupOrder: 1,
}

describe('useCreatePrescription toast silencing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toasts on success by default', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'rx-1' })
    const { result } = renderHook(() => useCreatePrescription('cons-1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(RX_DTO)
    })
    expect(toast.success).toHaveBeenCalledWith(toastStrings.prescriptionCreated)
  })

  it('suppresses the success toast when silent: true', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'rx-1' })
    const { result } = renderHook(() => useCreatePrescription('cons-1', { silent: true }), {
      wrapper,
    })
    await act(async () => {
      await result.current.mutateAsync(RX_DTO)
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('toasts on error by default', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCreatePrescription('cons-1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(RX_DTO).catch(() => undefined)
    })
    expect(toast.error).toHaveBeenCalledWith(toastStrings.errorPrescriptionSave)
  })

  it('suppresses the error toast when silent: true', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCreatePrescription('cons-1', { silent: true }), {
      wrapper,
    })
    await act(async () => {
      await result.current.mutateAsync(RX_DTO).catch(() => undefined)
    })
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('useCreateImagingOrder toast silencing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toasts on success by default', async () => {
    vi.mocked(apiClient.post).mockResolvedValue([{ id: 'img-1' }])
    const { result } = renderHook(() => useCreateImagingOrder('cons-1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(IMG_DTO)
    })
    expect(toast.success).toHaveBeenCalledWith(toastStrings.imagingOrderCreated)
  })

  it('suppresses the success toast when silent: true', async () => {
    vi.mocked(apiClient.post).mockResolvedValue([{ id: 'img-1' }])
    const { result } = renderHook(() => useCreateImagingOrder('cons-1', { silent: true }), {
      wrapper,
    })
    await act(async () => {
      await result.current.mutateAsync(IMG_DTO)
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('toasts on error by default', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCreateImagingOrder('cons-1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(IMG_DTO).catch(() => undefined)
    })
    expect(toast.error).toHaveBeenCalledWith(toastStrings.errorOrderSave)
  })

  it('suppresses the error toast when silent: true', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCreateImagingOrder('cons-1', { silent: true }), {
      wrapper,
    })
    await act(async () => {
      await result.current.mutateAsync(IMG_DTO).catch(() => undefined)
    })
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('useCreateLabOrder toast silencing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toasts on success by default', async () => {
    vi.mocked(apiClient.post).mockResolvedValue([{ id: 'lab-1' }])
    const { result } = renderHook(() => useCreateLabOrder('cons-1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(LAB_DTO)
    })
    expect(toast.success).toHaveBeenCalledWith(toastStrings.labOrderCreated)
  })

  it('suppresses the success toast when silent: true', async () => {
    vi.mocked(apiClient.post).mockResolvedValue([{ id: 'lab-1' }])
    const { result } = renderHook(() => useCreateLabOrder('cons-1', { silent: true }), {
      wrapper,
    })
    await act(async () => {
      await result.current.mutateAsync(LAB_DTO)
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('toasts on error by default', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCreateLabOrder('cons-1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(LAB_DTO).catch(() => undefined)
    })
    expect(toast.error).toHaveBeenCalledWith(toastStrings.errorOrderSave)
  })

  it('suppresses the error toast when silent: true', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCreateLabOrder('cons-1', { silent: true }), {
      wrapper,
    })
    await act(async () => {
      await result.current.mutateAsync(LAB_DTO).catch(() => undefined)
    })
    expect(toast.error).not.toHaveBeenCalled()
  })
})
