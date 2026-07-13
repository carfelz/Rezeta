import { useNavigate } from 'react-router-dom'
import { Spinner, TextLink } from '@/components/ui'
import { usePatientConsultations } from '@/hooks/consultations/use-consultations'
import { ConsultationListItem } from './ConsultationListItem'

export function ClinicalHistory({
  patientId,
  locationId,
}: {
  patientId: string
  locationId?: string
}): JSX.Element {
  const navigate = useNavigate()
  const { data: consultations = [], isLoading } = usePatientConsultations(patientId)

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-sans font-semibold text-n-800 uppercase tracking-[0.06em]">
            Historia clínica
          </h3>
          {!isLoading && (
            <span className="text-overline font-mono text-n-400 border border-n-200 rounded px-2 py-1">
              {consultations.length}
            </span>
          )}
        </div>
        <TextLink
          tone="primary"
          size="sm"
          onClick={() =>
            void navigate(
              `/consultas/nueva?patientId=${patientId}${locationId ? `&locationId=${locationId}` : ''}`,
            )
          }
        >
          <i className="ph ph-plus text-xs" />
          Nueva consulta
        </TextLink>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-xs text-n-400 justify-center">
          <Spinner size="sm" decorative /> Cargando…
        </div>
      ) : consultations.length === 0 ? (
        <div className="flex flex-col items-center py-8 border border-dashed border-n-200 rounded-md">
          <i className="ph ph-notepad text-h2 text-n-300 mb-2" />
          <p className="text-sm text-n-400">No hay consultas registradas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {consultations.map((c) => (
            <ConsultationListItem
              key={c.id}
              consultation={c}
              onClick={() => void navigate(`/consultas/${c.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
