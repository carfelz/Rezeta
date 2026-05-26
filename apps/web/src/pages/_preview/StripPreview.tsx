import { useState } from 'react'
import { ProtocolStrip } from '@/components/consultations/ProtocolStrip'
import { RightRail } from '@/components/consultations/RightRail'
import type { ConsultationProtocolUsage } from '@rezeta/shared'
import type { ConsultationViewMode } from '@/store/ui.store'

const mockUsage: ConsultationProtocolUsage = {
  id: 'usage-1',
  tenantId: 'tenant-1',
  consultationId: 'consult-1',
  protocolId: 'protocol-1',
  protocolVersionId: 'version-1',
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
  modifications: {
    checklist_items: [
      { item_id: 'itm_1', checked: true, timestamp: new Date().toISOString() },
      { item_id: 'itm_2', checked: true, timestamp: new Date().toISOString() },
      { item_id: 'itm_3', checked: true, timestamp: new Date().toISOString() },
      { item_id: 'itm_4', checked: true, timestamp: new Date().toISOString() },
    ],
  },
  content: {
    version: '1.0',
    blocks: [
      {
        id: 'sec_1',
        type: 'section',
        title: 'Anamnesis',
        blocks: [
          {
            id: 'chk_1',
            type: 'checklist',
            title: 'Síntomas',
            items: [
              { id: 'itm_1', text: 'Cefalea' },
              { id: 'itm_2', text: 'Mareo' },
              { id: 'itm_3', text: 'Dolor torácico' },
              { id: 'itm_4', text: 'Disnea' },
              { id: 'itm_5', text: 'Edema' },
              { id: 'itm_6', text: 'Palpitaciones' },
              { id: 'itm_7', text: 'Síncope' },
              { id: 'itm_8', text: 'Tos crónica' },
            ],
          },
        ],
      },
    ],
  },
}

export function StripPreview(): JSX.Element {
  const [viewMode, setViewMode] = useState<ConsultationViewMode>('soap')

  return (
    <div className="min-h-screen bg-n-25 font-sans">
      {/* Strip */}
      <ProtocolStrip
        usage={mockUsage}
        isSigned={false}
        onChangePicker={() => undefined}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Body 2-col grid */}
      <div className="grid gap-5 px-7 py-5" style={{ gridTemplateColumns: '1fr 320px' }}>
        <div className="bg-n-0 border border-n-200 rounded-md p-5">
          <h2 className="font-serif text-[18px] text-n-800 mb-3">SOAP body placeholder</h2>
          <p className="text-[13px] text-n-500">
            Current view mode: <strong>{viewMode}</strong>
          </p>
        </div>

        <RightRail
          alerts={[
            { id: '1', tone: 'danger', icon: 'ph-warning-circle', label: 'Alergia · Metformina' },
            { id: '2', tone: 'warn', icon: 'ph-info', label: 'HTA esencial · 4 años' },
          ]}
          steps={[
            { n: 1, label: 'Motivo', done: true, active: false },
            { n: 2, label: 'Vitales', done: true, active: false },
            { n: 3, label: 'Subjetivo', done: true, active: false },
            { n: 4, label: 'Examen', done: true, active: false },
            { n: 5, label: 'Decisión', done: false, active: true },
            { n: 6, label: 'Tratamiento', done: false, active: false },
            { n: 7, label: 'Educación', done: false, active: false },
            { n: 8, label: 'Cierre', done: false, active: false },
          ]}
          orders={[
            { label: 'Receta', count: 0 },
            { label: 'Laboratorio', count: 0 },
          ]}
        />
      </div>
    </div>
  )
}
