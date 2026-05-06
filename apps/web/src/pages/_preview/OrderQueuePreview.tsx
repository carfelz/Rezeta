import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderQueuePanel } from '@/components/consultations/OrderQueuePanel'
import { useOrderQueueStore } from '@/store/order-queue.store'

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function installMockFetch(): () => void {
  const original = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (
      url.includes('/prescriptions') ||
      url.includes('/imaging-orders') ||
      url.includes('/lab-orders')
    ) {
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return original(input, init)
  }
  return () => {
    window.fetch = original
  }
}

function Inner(): JSX.Element {
  const { queueMedication } = useOrderQueueStore()

  useEffect(() => {
    queueMedication({
      drug: 'Amlodipino',
      dose: '5 mg',
      route: 'Oral',
      frequency: '1 vez al día',
      duration: '30 días',
      notes: 'Tomar por la noche',
    })
    queueMedication({
      drug: 'Losartán',
      dose: '50 mg',
      route: 'Oral',
      frequency: '1 vez al día',
      duration: '30 días',
    })
  }, [queueMedication])

  return (
    <div className="max-w-md mx-auto p-6 bg-n-25 min-h-screen">
      <OrderQueuePanel consultationId="preview-consult" isSigned={false} />
    </div>
  )
}

export function OrderQueuePreview(): JSX.Element {
  useEffect(() => {
    const restore = installMockFetch()
    return restore
  }, [])

  return (
    <QueryClientProvider client={client}>
      <Inner />
    </QueryClientProvider>
  )
}
