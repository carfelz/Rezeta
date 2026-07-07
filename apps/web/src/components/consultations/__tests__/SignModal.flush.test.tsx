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
    expect(postCall[0]).toBe(`/v1/consultations/${CONSULT_ID}/prescriptions`)
    const signCall = (apiClient.patch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(signCall[0]).toBe(`/v1/consultations/${CONSULT_ID}/sign`)

    const postOrder = (apiClient.post as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    const patchOrder = (apiClient.patch as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    expect(postOrder).toBeLessThan(patchOrder)
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
