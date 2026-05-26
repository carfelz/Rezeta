import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SkipStepDialog } from '@/components/consultations/SkipStepDialog'
import { OffProtocolNote } from '@/components/consultations/OffProtocolNote'
import { ResumeBanner } from '@/components/consultations/ResumeBanner'
import {
  MissingFieldsCallout,
  MissingFieldsPanel,
} from '@/components/consultations/MissingFieldsPanel'
import type { ConsultationProtocolUsage } from '@rezeta/shared'

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const usage: ConsultationProtocolUsage = {
  id: 'usage-1',
  tenantId: 'tenant-1',
  consultationId: 'consult-1',
  protocolId: 'proto-1',
  protocolVersionId: 'ver-1',
  protocolTitle: 'HTA — Seguimiento',
  protocolTypeName: 'Cardiovascular',
  versionNumber: 2,
  status: 'in_progress',
  depth: 0,
  parentUsageId: null,
  triggerBlockId: null,
  completedAt: null,
  notes: null,
  appliedAt: new Date().toISOString(),
  modificationSummary: null,
  modifications: {},
  content: { version: '1.0', blocks: [] },
}

export function EdgePreview(): JSX.Element {
  return (
    <QueryClientProvider client={client}>
      <div className="min-h-screen bg-n-25 font-sans p-8 grid grid-cols-2 gap-8 max-w-[1440px] mx-auto">
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-n-400 mb-3">
            01 · Skip step dialog
          </h3>
          <SkipStepDialog
            stepTitle="Examen físico"
            onConfirm={() => undefined}
            onClose={() => undefined}
          />
        </section>

        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-n-400 mb-3">
            02 · Off-protocol note
          </h3>
          <OffProtocolNote onSave={() => undefined} onCancel={() => undefined} />
        </section>

        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-n-400 mb-3">
            03 · Resume banner
          </h3>
          <ResumeBanner
            usage={usage}
            patientName="Isabel Cristina Cruz"
            patientAge={52}
            currentStep={{ number: 4, title: 'Examen físico' }}
            totalSteps={8}
            completedSteps={3}
            lastEditField="Examen físico"
            lastEditTime="09:55 a.m."
            elapsedMinutes={47}
            onResume={() => undefined}
            onStartNew={() => undefined}
          />
        </section>

        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-n-400 mb-3">
            04 · Missing fields callout + right-rail panel
          </h3>
          <div className="flex flex-col gap-4">
            <MissingFieldsCallout
              count={3}
              onJumpFirst={() => undefined}
              onShowList={() => undefined}
            />
            <div className="w-[260px]">
              <MissingFieldsPanel
                fields={[
                  { id: 'temp', label: 'Temperatura' },
                  { id: 'peso', label: 'Peso' },
                  { id: 'fecha', label: 'Fecha de seguimiento' },
                ]}
                onFieldClick={() => undefined}
                onDismiss={() => undefined}
              />
            </div>
          </div>
        </section>
      </div>
    </QueryClientProvider>
  )
}
