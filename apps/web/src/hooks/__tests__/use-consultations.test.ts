import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'
import {
  usePatientConsultations,
  useConsultations,
  useConsultation,
  useCreateConsultation,
  useUpdateConsultation,
  useSignConsultation,
  useAmendConsultation,
  useDeleteConsultation,
  useAddProtocolUsage,
  useUpdateCheckedState,
  useRemoveProtocolUsage,
  useUpdateProtocolUsage,
  useCreatePrescription,
  useListPrescriptions,
  useCreateImagingOrder,
  useListImagingOrders,
  useCreateLabOrder,
  useListLabOrders,
} from '../consultations/use-consultations'

const mockConsultation = {
  id: 'cons-1',
  tenantId: 't-1',
  patientId: 'p-1',
  locationId: 'loc-1',
  status: 'draft',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const mockUsage = {
  id: 'usage-1',
  consultationId: 'cons-1',
  protocolId: 'proto-1',
  checkedItems: [],
}

const mockPrescription = { id: 'rx-1', consultationId: 'cons-1', items: [] }
const mockImaging = [{ id: 'img-1', consultationId: 'cons-1', studyType: 'Rx Tórax' }]
const mockLab = [{ id: 'lab-1', consultationId: 'cons-1', testName: 'Hemograma' }]

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('usePatientConsultations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches consultations for patient', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockConsultation])
    const { result } = renderHook(() => usePatientConsultations('p-1'), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations?patientId=p-1')
  })

  it('is disabled when patientId is empty', () => {
    const { result } = renderHook(() => usePatientConsultations(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useConsultations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches all consultations with no params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockConsultation])
    const { result } = renderHook(() => useConsultations({}), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations')
  })

  it('builds query string with all params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    const params = { patientId: 'p-1', locationId: 'loc-1', from: '2026-05-01', to: '2026-05-31' }
    const { result } = renderHook(() => useConsultations(params), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith(
      '/v1/consultations?patientId=p-1&locationId=loc-1&from=2026-05-01&to=2026-05-31',
    )
  })
})

describe('useConsultation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches single consultation', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockConsultation)
    const { result } = renderHook(() => useConsultation('cons-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations/cons-1')
  })

  it('is disabled when id is empty', () => {
    const { result } = renderHook(() => useConsultation(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreateConsultation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts new consultation', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockConsultation)
    const { result } = renderHook(() => useCreateConsultation(), { wrapper: makeWrapper() })
    const dto = { patientId: 'p-1', locationId: 'loc-1' }
    await act(async () => {
      await result.current.mutateAsync(dto as Parameters<typeof result.current.mutateAsync>[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations', dto)
  })
})

describe('useUpdateConsultation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches consultation', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ ...mockConsultation, status: 'signed' })
    const { result } = renderHook(() => useUpdateConsultation('cons-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ chiefComplaint: 'Dolor' } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/consultations/cons-1', {
      chiefComplaint: 'Dolor',
    })
  })
})

describe('useSignConsultation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to sign endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ ...mockConsultation, status: 'signed' })
    const { result } = renderHook(() => useSignConsultation('cons-1'), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync()
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/cons-1/sign', {})
  })
})

describe('useAmendConsultation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to amend endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockConsultation)
    const { result } = renderHook(() => useAmendConsultation('cons-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({
        reason: 'Corrección de diagnóstico',
        changes: {},
      } as Parameters<typeof result.current.mutateAsync>[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/v1/consultations/cons-1/amend',
      expect.any(Object),
    )
  })
})

describe('useDeleteConsultation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes consultation', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteConsultation(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync('cons-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/consultations/cons-1')
  })
})

describe('useAddProtocolUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts protocol usage to consultation', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockUsage)
    const { result } = renderHook(() => useAddProtocolUsage('cons-1'), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ protocolId: 'proto-1' } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/cons-1/protocols', {
      protocolId: 'proto-1',
    })
  })
})

describe('useUpdateCheckedState', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches protocol usage checked state', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockUsage)
    const { result } = renderHook(() => useUpdateCheckedState('cons-1', 'usage-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ checkedItems: ['itm-1'] } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/consultations/cons-1/protocols/usage-1', {
      checkedItems: ['itm-1'],
    })
  })
})

describe('useRemoveProtocolUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes protocol usage', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useRemoveProtocolUsage('cons-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync('usage-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/consultations/cons-1/protocols/usage-1')
  })
})

describe('useUpdateProtocolUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches protocol usage', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockUsage)
    const { result } = renderHook(() => useUpdateProtocolUsage('cons-1', 'usage-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ checkedItems: [] } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/consultations/cons-1/protocols/usage-1', {
      checkedItems: [],
    })
  })
})

describe('useCreatePrescription', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts prescription group', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockPrescription)
    const { result } = renderHook(() => useCreatePrescription('cons-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ items: [] } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/cons-1/prescriptions', {
      items: [],
    })
  })
})

describe('useListPrescriptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches prescriptions for consultation', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockPrescription])
    const { result } = renderHook(() => useListPrescriptions('cons-1'), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations/cons-1/prescriptions')
  })

  it('is disabled when consultationId is empty', () => {
    const { result } = renderHook(() => useListPrescriptions(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreateImagingOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts imaging order group', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockImaging)
    const { result } = renderHook(() => useCreateImagingOrder('cons-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ orders: [] } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/cons-1/imaging-orders', {
      orders: [],
    })
  })
})

describe('useListImagingOrders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches imaging orders for consultation', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockImaging)
    const { result } = renderHook(() => useListImagingOrders('cons-1'), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations/cons-1/imaging-orders')
  })

  it('is disabled when consultationId is empty', () => {
    const { result } = renderHook(() => useListImagingOrders(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreateLabOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts lab order group', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockLab)
    const { result } = renderHook(() => useCreateLabOrder('cons-1'), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ orders: [] } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/cons-1/lab-orders', {
      orders: [],
    })
  })
})

describe('useListLabOrders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches lab orders for consultation', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockLab)
    const { result } = renderHook(() => useListLabOrders('cons-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations/cons-1/lab-orders')
  })

  it('is disabled when consultationId is empty', () => {
    const { result } = renderHook(() => useListLabOrders(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
