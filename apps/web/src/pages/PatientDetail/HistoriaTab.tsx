import { useState } from 'react'
import { Badge, Overline, Spinner } from '@/components/ui'
import { usePatientConsultations } from '@/hooks/consultations/use-consultations'
import { RecordDocument } from './RecordDocument'
import { patientDetailStrings as s } from './strings'

export interface HistoriaTabProps {
  patientId: string
}

export function HistoriaTab({ patientId }: HistoriaTabProps): JSX.Element {
  const { data: consultations, isLoading } = usePatientConsultations(patientId)
  const list = consultations ?? []
  const signed = list.filter((c) => c.status === 'signed' || c.status === 'amended')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Spinner size="md" className="text-n-400" />
      </div>
    )
  }

  if (list.length === 0) {
    return <p className="text-[13px] text-n-500 p-5">{s.historiaEmpty}</p>
  }

  // list is non-empty here, so activeId always resolves to an id present in list,
  // and the lookup below always succeeds.
  const activeId = selectedId ?? signed[0]?.id ?? list[0]!.id
  const active = list.find((c) => c.id === activeId) as (typeof list)[number]

  return (
    <div className="grid grid-cols-[280px_1fr] min-h-[400px] -m-5">
      <div className="border-r border-n-200 bg-n-25" data-testid="historia-consultation-list">
        <div className="px-4 py-3 border-b border-n-100">
          <Overline size="sm" tone="neutral">
            {s.historiaListTitle}
          </Overline>
        </div>
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            aria-current={c.id === activeId ? true : undefined}
            className={`block w-full text-left px-4 py-3 border-b border-n-100 border-l-2 ${
              c.id === activeId ? 'border-l-p-500 bg-n-0' : 'border-l-transparent'
            }`}
          >
            <div className="flex items-center gap-2 text-[13px] font-semibold text-n-800">
              {new Date(c.startedAt).toLocaleDateString('es-DO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {c.status === 'open' && (
                <Badge variant="draft" showDot={false}>
                  {s.historiaChipNone}
                </Badge>
              )}
            </div>
            <div className="text-[12px] text-n-500">
              {c.locationName} · {c.doctorName}
            </div>
          </button>
        ))}
      </div>
      <div>
        <RecordDocument
          key={active.id}
          consultationId={active.id}
          consultationStatus={active.status}
        />
      </div>
    </div>
  )
}
