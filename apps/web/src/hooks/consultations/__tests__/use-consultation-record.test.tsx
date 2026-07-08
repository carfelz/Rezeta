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
  useRecordVersions,
  useRecordVersion,
} from '../use-consultation-record'
import { apiClient, ApiRequestError, triggerDownload } from '@/lib/api-client'
import { toast } from 'sonner'
import { toastStrings } from '@/lib/toasts'

vi.mock('@/lib/api-client', () => {
  class MockApiRequestError extends Error {
    constructor(
      public readonly error: { code: string; message: string; details?: Record<string, unknown> },
    ) {
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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

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

  it('invalidates the versions list on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'rec1', status: 'signed' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const signWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useSignRecord('c1'), { wrapper: signWrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['consultation-record', 'c1', 'versions'] })
  })

  it('toasts an error when the sign request fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useSignRecord('c1'), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith(toastStrings.errorHistoriaSign)
  })

  it('toasts the generic missing-sections string when the API rejects without details', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiRequestError({ code: 'RECORD_REQUIRED_SECTIONS_MISSING', message: 'x' }),
    )
    const { result } = renderHook(() => useSignRecord('c1'), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith(toastStrings.historiaMissingSections)
    expect(toast.error).not.toHaveBeenCalledWith(toastStrings.errorHistoriaSign)
  })

  it('toasts the missing section names when the API rejects with details.missing', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiRequestError({
        code: 'RECORD_REQUIRED_SECTIONS_MISSING',
        message: 'x',
        details: { missing: ['motivo_consulta', 'plan_tratamiento'] },
      }),
    )
    const { result } = renderHook(() => useSignRecord('c1'), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    const [message] = vi.mocked(toast.error).mock.calls[0] as [string]
    expect(message).toContain('Motivo de consulta')
    expect(message).toContain('Plan de tratamiento')
    expect(toast.error).not.toHaveBeenCalledWith(toastStrings.historiaMissingSections)
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

  it('toasts an error when the ensure request fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useEnsureRecord(), { wrapper })
    result.current.mutate('c1')
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith(toastStrings.errorHistoriaSave)
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

  it('toasts an error when the update request fails', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useUpdateRecordSections('c1'), { wrapper })
    result.current.mutate({ sections: [{ key: 'diagnosticos' as const, content: 'Updated' }] })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith(toastStrings.errorHistoriaSave)
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

  it('toasts an error when the regenerate request fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useRegenerateRecord('c1'), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith(toastStrings.errorHistoriaSave)
  })

  it('invalidates the versions list on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'rec1', status: 'draft' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const regenerateWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useRegenerateRecord('c1'), { wrapper: regenerateWrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['consultation-record', 'c1', 'versions'] })
  })
})

describe('useRecordVersions', () => {
  it('fetches the version list', async () => {
    const versions = [
      { id: 'v2', versionNumber: 2, kind: 'evolution', status: 'signed', generatedAt: 't2', signedAt: 't2' },
      { id: 'v1', versionNumber: 1, kind: 'evolution', status: 'signed', generatedAt: 't1', signedAt: 't1' },
    ]
    vi.mocked(apiClient.get).mockResolvedValue(versions)
    const { result } = renderHook(() => useRecordVersions('c1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations/c1/record/versions')
    expect(result.current.data).toEqual(versions)
  })

  it('is disabled without a consultation id', () => {
    const { result } = renderHook(() => useRecordVersions(null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useRecordVersion', () => {
  it('fetches a specific version', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ id: 'rec1', versionNumber: 1, status: 'signed' })
    const { result } = renderHook(() => useRecordVersion('c1', 1), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations/c1/record/versions/1')
    expect(result.current.data).toMatchObject({ id: 'rec1', versionNumber: 1 })
  })

  it('is disabled when the version number is null', () => {
    const { result } = renderHook(() => useRecordVersion('c1', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled without a consultation id', () => {
    const { result } = renderHook(() => useRecordVersion(null, 1), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
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

  it('appends the version query param and versioned filename when given a version number', async () => {
    const blob = new Blob(['pdf content'], { type: 'application/pdf' })
    vi.mocked(apiClient.download).mockResolvedValue(blob)

    await downloadRecordPdf('c1', 2)

    expect(apiClient.download).toHaveBeenCalledWith('/v1/consultations/c1/record/pdf?version=2')
    expect(triggerDownload).toHaveBeenCalledWith(blob, 'historia-c1-v2.pdf')
  })
})
