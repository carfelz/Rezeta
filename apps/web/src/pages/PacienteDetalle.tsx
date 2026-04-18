import { useParams, Link } from 'react-router-dom'
import { usePatient } from '@/hooks/patients/use-patients'

export function PacienteDetalle(): JSX.Element {
  const { patientId } = useParams<{ patientId: string }>()
  const { data: patient, isLoading, isError } = usePatient(patientId ?? '')

  if (isLoading) {
    return <div style={{ color: 'var(--color-n-400)' }}>Cargando...</div>
  }

  if (isError || !patient) {
    return (
      <div className="callout callout--danger">
        <i className="ph ph-warning-circle" />
        <div className="callout__body">Paciente no encontrado.</div>
      </div>
    )
  }

  const name = `${patient.firstName} ${patient.lastName}`

  return (
    <div>
      <div className="row" style={{ marginBottom: 'var(--space-6)', gap: 'var(--space-3)' }}>
        <Link to="/pacientes" className="btn btn--ghost btn--sm">
          <i className="ph ph-arrow-left" />
        </Link>
        <h1 className="text-h1" style={{ flex: 1 }}>{name}</h1>
        <button className="btn btn--secondary">
          <i className="ph ph-pencil-simple" />
          Editar
        </button>
        <button className="btn btn--primary">
          <i className="ph ph-notepad" />
          Nueva consulta
        </button>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card__title">Información general</div>
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {patient.documentNumber && (
              <div>
                <span className="text-overline">Documento</span>
                <div className="text-body">{patient.documentType?.toUpperCase()} · {patient.documentNumber}</div>
              </div>
            )}
            {patient.dateOfBirth && (
              <div>
                <span className="text-overline">Fecha de nacimiento</span>
                <div className="text-body">{new Date(patient.dateOfBirth).toLocaleDateString('es-DO')}</div>
              </div>
            )}
            {patient.phone && (
              <div>
                <span className="text-overline">Teléfono</span>
                <div className="text-body">{patient.phone}</div>
              </div>
            )}
            {patient.email && (
              <div>
                <span className="text-overline">Correo</span>
                <div className="text-body">{patient.email}</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__title">Historia clínica</div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            {(patient.allergies).length > 0 && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <span className="text-overline">Alergias</span>
                <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 4 }}>
                  {(patient.allergies).map((a) => (
                    <span key={a} className="badge badge--overdue">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {(patient.chronicConditions).length > 0 && (
              <div>
                <span className="text-overline">Condiciones crónicas</span>
                <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 4 }}>
                  {(patient.chronicConditions).map((c) => (
                    <span key={c} className="badge badge--review">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {(patient.allergies).length === 0 &&
              (patient.chronicConditions).length === 0 && (
              <p className="text-body-sm" style={{ color: 'var(--color-n-400)' }}>
                Sin antecedentes registrados.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
