/**
 * Public, auth-free preview page for the consultation gate.
 * For pixel-comparison against the design source. Dev-only — never linked.
 */
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConsultHeader } from '@/components/consultations/ConsultHeader'
import { ConsultationGate } from '@/components/consultations/ConsultationGate'

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

const monthsAgo = (n: number): string =>
  new Date(Date.now() - n * 30 * 24 * 60 * 60 * 1000).toISOString()

const MOCK_PROTOCOLS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Seguimiento HTA',
    typeId: 't1',
    typeName: 'Cardiovascular',
    status: 'active',
    isFavorite: false,
    currentVersionNumber: 2,
    updatedAt: monthsAgo(3),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Control DM tipo 2',
    typeId: 't2',
    typeName: 'Endocrinología',
    status: 'active',
    isFavorite: false,
    currentVersionNumber: 1,
    updatedAt: monthsAgo(6),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    title: 'Consulta general',
    typeId: 't3',
    typeName: 'Diagnóstico',
    status: 'active',
    isFavorite: false,
    currentVersionNumber: null as number | null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    title: 'Asma agudo',
    typeId: 't4',
    typeName: 'Respiratorio',
    status: 'active',
    isFavorite: false,
    currentVersionNumber: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    title: 'Ansiedad inicial',
    typeId: 't5',
    typeName: 'Salud mental',
    status: 'active',
    isFavorite: false,
    currentVersionNumber: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    title: 'Fiebre pediátrica',
    typeId: 't6',
    typeName: 'Pediatría',
    status: 'active',
    isFavorite: false,
    currentVersionNumber: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    title: 'Trauma menor',
    typeId: 't7',
    typeName: 'Urgencias',
    status: 'active',
    isFavorite: false,
    currentVersionNumber: 1,
    updatedAt: new Date().toISOString(),
  },
]

// Monkey-patch fetch in this preview only
function installMockFetch(): () => void {
  const originalFetch = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('/v1/protocols')) {
      return new Response(JSON.stringify({ data: MOCK_PROTOCOLS }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return originalFetch(input, init)
  }
  return () => {
    window.fetch = originalFetch
  }
}

export function GatePreview(): JSX.Element {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const restore = installMockFetch()
    setReady(true)
    return restore
  }, [])

  if (!ready) return <div />

  return (
    <QueryClientProvider client={client}>
      <div className="min-h-screen bg-n-25 font-sans">
        <div className="max-w-[1440px] mx-auto py-8 px-12">
          <ConsultHeader
            breadcrumbs={[
              { label: 'Pacientes', to: '/pacientes' },
              { label: 'Isabel Cristina Cruz', to: '/pacientes/p1' },
              { label: 'Consulta · 2 may de 2026' },
            ]}
            datetimeOverline="SÁBADO, 2 DE MAYO DE 2026 · 02:29 A.M. · CONSULTORIO PRIVADO DR. GARCÍA"
            title="Nueva consulta"
            subtitle="Isabel Cristina Cruz · Dr. Test García"
            rightSlot={
              <button
                type="button"
                className="px-3 py-2 text-[12px] text-n-600 bg-transparent border border-n-200 rounded-sm hover:bg-n-25 transition-colors"
              >
                Saltar y abrir consulta vacía
              </button>
            }
          />
          <ConsultationGate
            patientId="p1"
            patientFirstName="Isabel"
            locationId="loc1"
            onSelect={() => undefined}
            isCreating={false}
          />
        </div>
      </div>
    </QueryClientProvider>
  )
}
