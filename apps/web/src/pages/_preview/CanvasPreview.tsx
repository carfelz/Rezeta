import { useState } from 'react'
import { ProtocolStrip } from '@/components/consultations/ProtocolStrip'
import { ProtocolPills } from '@/components/consultations/ProtocolPills'
import { CanvasView } from '@/components/consultations/CanvasView'
import { RightRail } from '@/components/consultations/RightRail'
import type { ConsultationProtocolUsage } from '@rezeta/shared'
import type { ConsultationViewMode } from '@/store/ui.store'

const usage: ConsultationProtocolUsage = {
  id: 'u1',
  tenantId: 't1',
  consultationId: 'c1',
  protocolId: 'p1',
  protocolVersionId: 'v1',
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
  checkedState: { motivo: true, vitales: true, subjetivo: true, examen: true },
  modifications: {},
  content: {
    version: '1.0',
    blocks: [
      {
        id: 'sec1',
        type: 'section',
        title: 'Anamnesis y exploración',
        blocks: [
          {
            id: 'stp1',
            type: 'steps',
            steps: [
              {
                id: 'motivo',
                order: 1,
                title: 'Motivo de consulta',
                detail: 'Seguimiento HTA. Cefaleas, PA casa 145/92.',
              },
              {
                id: 'vitales',
                order: 2,
                title: 'Signos vitales',
                detail: 'PA 148/94, FC 78, T 36.8, SatO₂ 98',
              },
              {
                id: 'subjetivo',
                order: 3,
                title: 'Subjetivo',
                detail: 'Cefaleas 2 sem. Adherencia parcial.',
              },
              {
                id: 'examen',
                order: 4,
                title: 'Examen físico',
                detail: 'RsCs rítmicos. MV conservado. Sin edema.',
              },
              {
                id: 'decision',
                order: 5,
                title: 'Decisión clínica',
                detail: 'Algoritmo · ¿Alcanza meta PA <130/80?',
              },
              {
                id: 'tratamiento',
                order: 6,
                title: 'Tratamiento',
                detail: 'Tabla de dosificación',
              },
              { id: 'educacion', order: 7, title: 'Educación', detail: 'DASH + adherencia' },
              { id: 'cierre', order: 8, title: 'Cierre', detail: 'Próximo control 4 semanas' },
            ],
          },
        ],
      },
    ],
  },
}

export function CanvasPreview(): JSX.Element {
  const [viewMode, setViewMode] = useState<ConsultationViewMode>('canvas')
  const [activeId, setActiveId] = useState('p1')

  return (
    <div className="min-h-screen bg-n-25 font-sans">
      <ProtocolPills
        pills={[
          {
            id: 'p1',
            title: 'HTA — Seguimiento',
            completed: 4,
            total: 8,
            isActive: activeId === 'p1',
          },
          { id: 'p2', title: 'DM2 — Control', completed: 2, total: 6, isActive: activeId === 'p2' },
        ]}
        onSelect={setActiveId}
        onAdd={() => undefined}
      />
      <ProtocolStrip
        usage={usage}
        isSigned={false}
        onChangePicker={() => undefined}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="grid gap-5 px-7 py-5" style={{ gridTemplateColumns: '1fr 320px' }}>
        <CanvasView
          usage={usage}
          soap={{ chiefComplaint: '', subjective: '', objective: '', assessment: '', plan: '' }}
          onSoapChange={() => undefined}
          onToggleStep={() => undefined}
          isSigned={false}
        />

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
