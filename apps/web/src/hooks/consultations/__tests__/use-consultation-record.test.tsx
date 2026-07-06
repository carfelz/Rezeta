import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useConsultationRecord,
  useSignRecord,
  downloadRecordPdf,
  useUpdateRecordSections,
  useRegenerateRecord,
  useEnsureRecord,
} from '../use-consultation-record'
import { apiClient, ApiRequestError, triggerDownload } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => {
  class MockApiRequestError extends Error {
    constructor(public readonly error: { code: string; message: string }) {
      super(error.message)
      this.name = 'ApiRequestError'
    }
  }
  return {
    apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), download: vi.fn() },
    ApiRequestError: MockApiRequestError,
    triggerDownload: vi.fn(),
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('useConsultationRecord', () => {
  it('fetches the record', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ id: 'rec1', status: 'draft' })
    const { result } = renderHook(() => useConsultationRecord('c1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations/c1/record')
    expect(result.current.data).toMatchObject({ id: 'rec1' })
  })

  it('resolves null on RECORD_NOT_FOUND instead of erroring', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      new ApiRequestError({ code: 'RECORD_NOT_FOUND', message: 'x' }),
    )
    const { result } = renderHook(() => useConsultationRecord('c1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('is disabled without a consultation id', () => {
    const { result } = renderHook(() => useConsultationRecord(null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useSignRecord', () => {
  it('posts to the sign endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'rec1', status: 'signed' })
    const { result } = renderHook(() => useSignRecord('c1'), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/c1/record/sign', {})
  })
})

describe('useEnsureRecord', () => {
  it('posts to create the record', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'rec1', status: 'draft' })
    const { result } = renderHook(() => useEnsureRecord(), { wrapper })
    result.current.mutate('c1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/c1/record', {})
    expect(result.current.data).toMatchObject({ id: 'rec1' })
  })
})

describe('useUpdateRecordSections', () => {
  it('patches the record with new sections', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ id: 'rec1', status: 'draft' })
    const { result } = renderHook(() => useUpdateRecordSections('c1'), { wrapper })
    const dto = { sections: [{ key: 'diagnosticos' as const, content: 'Updated' }] }
    result.current.mutate(dto)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/consultations/c1/record', dto)
  })
})

describe('useRegenerateRecord', () => {
  it('posts to regenerate the record', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'rec1', status: 'draft' })
    const { result } = renderHook(() => useRegenerateRecord('c1'), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/c1/record/regenerate', {})
  })
})

describe('downloadRecordPdf', () => {
  it('downloads and triggers the file download', async () => {
    const blob = new Blob(['pdf content'], { type: 'application/pdf' })
    vi.mocked(apiClient.download).mockResolvedValue(blob)

    await downloadRecordPdf('c1')

    expect(apiClient.download).toHaveBeenCalledWith('/v1/consultations/c1/record/pdf')
    expect(triggerDownload).toHaveBeenCalledWith(blob, 'historia-c1.pdf')
  })
})
