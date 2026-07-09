import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { apiClient } from '@/lib/api-client'
import { Modal } from '@/components/ui'
import { SignModal } from '../SignModal'
import { useFlushOrderQueue } from '@/hooks/consultations/use-flush-order-queue'
import { useOrderQueueStore } from '@/store/order-queue.store'

const CONSULT_ID = 'cons-1'

function SignHarness(): JSX.Element {
  const { flush } = useFlushOrderQueue(CONSULT_ID)
  return (
    <Modal open onOpenChange={() => undefined}>
      <SignModal
        consultationId={CONSULT_ID}
        onBeforeSign={flush}
        onClose={() => undefined}
        onSigned={() => undefined}
      />
    </Modal>
  )
}

function renderSignModal(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    React.createElement(QueryClientProvider, { client }, React.createElement(SignHarness)),
  )
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function renderWithBeforeSign(onBeforeSign: () => Promise<boolean>): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Modal open onOpenChange={() => undefined}>
        <SignModal
          consultationId={CONSULT_ID}
          onBeforeSign={onBeforeSign}
          onClose={() => undefined}
          onSigned={() => undefined}
        />
      </Modal>
    </QueryClientProvider>,
  )
}

function queueOneMedication(): void {
  act(() => {
    const store = useOrderQueueStore.getState()
    store.reset()
    store.queueMedication({
      drug: 'Amoxicilina',
      dose: '500mg',
      route: 'oral',
      frequency: 'cada 8h',
      duration: '7 días',
    })
  })
}

describe('SignModal — order queue flush on sign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    act(() => useOrderQueueStore.getState().reset())
  })

  it('POSTs queued prescriptions before the sign PATCH, then signs', async () => {
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ invoiceOutcome: null })
    queueOneMedication()

    renderSignModal()
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y cerrar' }))

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled())

    const postCall = (apiClient.post as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(postCall![0]).toBe(`/v1/consultations/${CONSULT_ID}/prescriptions`)
    const signCall = (apiClient.patch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(signCall![0]).toBe(`/v1/consultations/${CONSULT_ID}/sign`)

    const postOrder = (apiClient.post as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    const patchOrder = (apiClient.patch as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    expect(postOrder!).toBeLessThan(patchOrder!)
  })

  it('aborts the sign (no PATCH) when the prescription POST fails', async () => {
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'))
    ;(apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({})
    queueOneMedication()

    renderSignModal()
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y cerrar' }))

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled())
    // Give any pending microtasks a chance to (wrongly) fire the sign PATCH.
    await act(async () => {
      await Promise.resolve()
    })
    expect(apiClient.patch).not.toHaveBeenCalled()
    // Queue stays intact for retry.
    expect(useOrderQueueStore.getState().medications).toHaveLength(1)
  })
})

describe('SignModal — confirm disabled while the pre-sign flush runs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    act(() => useOrderQueueStore.getState().reset())
  })

  it('does not double-POST or double-sign when the button is clicked repeatedly during flush', async () => {
    // Hold the prescription POST open so the real flush stays mid-flight while
    // we hammer the confirm button.
    const postDeferred = deferred<unknown>()
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(postDeferred.promise)
    ;(apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ invoiceOutcome: null })
    queueOneMedication()

    renderSignModal()
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y cerrar' }))

    // First click snapshots the queue and fires exactly one POST; the button
    // now shows the pending label and is disabled.
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1))
    const pendingButton = screen.getByRole('button', { name: 'Firmando…' })
    expect(pendingButton).toBeDisabled()

    // Extra clicks during the flush window must be no-ops — a second flush would
    // re-snapshot the still-unremoved queue and persist a duplicate prescription.
    fireEvent.click(pendingButton)
    fireEvent.click(pendingButton)
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    expect(apiClient.patch).not.toHaveBeenCalled()

    // Resolve the flush; the sign proceeds exactly once.
    await act(async () => {
      postDeferred.resolve({})
      await Promise.resolve()
    })
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledTimes(1))
    expect(apiClient.post).toHaveBeenCalledTimes(1)
  })

  it('re-enables the confirm button after onBeforeSign resolves false', async () => {
    ;(apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const gate = deferred<boolean>()
    const onBeforeSign = vi.fn(() => gate.promise)

    renderWithBeforeSign(onBeforeSign)
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y cerrar' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Firmando…' })).toBeDisabled(),
    )
    expect(onBeforeSign).toHaveBeenCalledTimes(1)

    await act(async () => {
      gate.resolve(false)
      await Promise.resolve()
    })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Firmar y cerrar' })).not.toBeDisabled(),
    )
    expect(apiClient.patch).not.toHaveBeenCalled()
  })

  it('proceeds with the sign once onBeforeSign resolves true', async () => {
    ;(apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ invoiceOutcome: null })
    const gate = deferred<boolean>()
    const onBeforeSign = vi.fn(() => gate.promise)

    renderWithBeforeSign(onBeforeSign)
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y cerrar' }))

    await waitFor(() => expect(onBeforeSign).toHaveBeenCalledTimes(1))
    expect(apiClient.patch).not.toHaveBeenCalled()

    await act(async () => {
      gate.resolve(true)
      await Promise.resolve()
    })

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledTimes(1))
    expect(onBeforeSign).toHaveBeenCalledTimes(1)
  })
})
