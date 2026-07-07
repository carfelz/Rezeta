import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  triggerDownload: vi.fn(),
}))

import { apiClient } from '@/lib/api-client'
import { OrderQueuePanel } from '../OrderQueuePanel'
import { useOrderQueueStore } from '@/store/order-queue.store'

const CONSULT_ID = 'cons-1'

function renderPanel(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(OrderQueuePanel, { consultationId: CONSULT_ID, isSigned: false }),
    ),
  )
}

describe('OrderQueuePanel — medication source caption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([])
    act(() => useOrderQueueStore.getState().reset())
  })

  it('shows a friendly label for a medication queued from a protocol, never the raw source id', () => {
    act(() => {
      const store = useOrderQueueStore.getState()
      store.queueMedication({
        drug: 'Amoxicilina',
        dose: '500mg',
        route: 'oral',
        frequency: 'cada 8h',
        duration: '7 días',
        source: 'protocol:row_e2e_1',
      })
    })

    renderPanel()

    expect(screen.getByText('Desde protocolo')).toBeInTheDocument()
    expect(screen.queryByText('protocol:row_e2e_1')).not.toBeInTheDocument()
  })

  it('shows nothing for a medication with a non-protocol source', () => {
    act(() => {
      const store = useOrderQueueStore.getState()
      store.queueMedication({
        drug: 'Ibuprofeno',
        dose: '400mg',
        route: 'oral',
        frequency: 'cada 8h',
        duration: '5 días',
        source: 'manual:xyz',
      })
    })

    renderPanel()

    expect(screen.queryByText('Desde protocolo')).not.toBeInTheDocument()
    expect(screen.queryByText('manual:xyz')).not.toBeInTheDocument()
  })

  it('shows nothing when a medication has no source at all', () => {
    act(() => {
      const store = useOrderQueueStore.getState()
      store.queueMedication({
        drug: 'Paracetamol',
        dose: '500mg',
        route: 'oral',
        frequency: 'cada 6h',
        duration: '3 días',
      })
    })

    renderPanel()

    expect(screen.queryByText('Desde protocolo')).not.toBeInTheDocument()
  })
})
