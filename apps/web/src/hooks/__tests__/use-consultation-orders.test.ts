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
  useConsultationOrders,
  useCreatePrescriptionGroup,
  useCreateImagingOrderGroup,
  useCreateLabOrderGroup,
  useDeleteOrderGroup,
} from '../use-consultation-orders'

const mockOrders = {
  prescriptions: [{ id: 'rx-1', consultationId: 'cons-1', items: [] }],
  imagingOrders: [{ id: 'img-1', consultationId: 'cons-1' }],
  labOrders: [{ id: 'lab-1', consultationId: 'cons-1' }],
}

const mockPrescription = { id: 'rx-2', consultationId: 'cons-1', items: [] }
const mockImagingOrders = [{ id: 'img-2', consultationId: 'cons-1' }]
const mockLabOrders = [{ id: 'lab-2', consultationId: 'cons-1' }]

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useConsultationOrders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches all orders for a consultation', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockOrders)
    const { result } = renderHook(() => useConsultationOrders('cons-1'), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations/cons-1/orders')
    expect(result.current.data).toEqual(mockOrders)
  })

  it('is disabled when consultationId is empty', () => {
    const { result } = renderHook(() => useConsultationOrders(''), {
      wrapper: makeWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreatePrescriptionGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts a new prescription group', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockPrescription)
    const { result } = renderHook(() => useCreatePrescriptionGroup('cons-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ items: [] })
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/cons-1/prescriptions', {
      items: [],
    })
  })
})

describe('useCreateImagingOrderGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts a new imaging order group', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockImagingOrders)
    const { result } = renderHook(() => useCreateImagingOrderGroup('cons-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ orders: [] })
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/cons-1/imaging-orders', {
      orders: [],
    })
  })
})

describe('useCreateLabOrderGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts a new lab order group', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockLabOrders)
    const { result } = renderHook(() => useCreateLabOrderGroup('cons-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ orders: [] })
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/cons-1/lab-orders', {
      orders: [],
    })
  })
})

describe('useDeleteOrderGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a prescription group', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteOrderGroup('cons-1', 'prescriptions'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync('rx-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/consultations/cons-1/prescriptions/rx-1')
  })

  it('deletes an imaging order group', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteOrderGroup('cons-1', 'imaging-orders'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync('img-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/consultations/cons-1/imaging-orders/img-1')
  })

  it('deletes a lab order group', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteOrderGroup('cons-1', 'lab-orders'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync('lab-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/consultations/cons-1/lab-orders/lab-1')
  })
})
