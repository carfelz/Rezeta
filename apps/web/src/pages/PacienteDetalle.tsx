import { useParams, Link } from 'react-router-dom'
import { usePatient } from '@/hooks/patients/use-patients'
import { Button, Card, CardTitle, Badge, Callout } from '@/components/ui'

export function PacienteDetalle(): JSX.Element {
  const { patientId } = useParams<{ patientId: string }>()
  const { data: patient, isLoading, isError } = usePatient(patientId ?? '')

  if (isLoading) {
    return <div className="text-n-400">Cargando...</div>
  }

  if (isError || !patient) {
    return (
      <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
        Paciente no encontrado.
      </Callout>
    )
  }

  const name = `${patient.firstName} ${patient.lastName}`

  return (
    <div>
      <div className="flex items-center mb-6 gap-3">
        <Link
          to="/pacientes"
          className="inline-flex items-center justify-center h-btn-sm w-btn-sm rounded-sm text-n-700 hover:bg-n-100 transition-colors duration-[100ms]"
          aria-label="Volver"
        >
          <i className="ph ph-arrow-left text-[16px]" />
        </Link>
        <h1 className="text-h1 flex-1">{name}</h1>
        <Button variant="secondary">
          <i className="ph ph-pencil-simple mr-1.5" />
          Editar
        </Button>
        <Button variant="primary">
          <i className="ph ph-notepad mr-1.5" />
          Nueva consulta
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardTitle>Información general</CardTitle>
          <div className="mt-4 flex flex-col gap-3">
            {patient.documentNumber && (
              <div>
                <span className="text-overline">Documento</span>
                <div className="text-body">
                  {patient.documentType?.toUpperCase()} · {patient.documentNumber}
                </div>
              </div>
            )}
            {patient.dateOfBirth && (
              <div>
                <span className="text-overline">Fecha de nacimiento</span>
                <div className="text-body">
                  {new Date(patient.dateOfBirth).toLocaleDateString('es-DO')}
                </div>
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
        </Card>

        <Card>
          <CardTitle>Historia clínica</CardTitle>
          <div className="mt-4">
            {patient.allergies.length > 0 && (
              <div className="mb-3">
                <span className="text-overline">Alergias</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {patient.allergies.map((a) => (
                    <Badge key={a} variant="overdue">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {patient.chronicConditions.length > 0 && (
              <div>
                <span className="text-overline">Condiciones crónicas</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {patient.chronicConditions.map((c) => (
                    <Badge key={c} variant="review">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {patient.allergies.length === 0 && patient.chronicConditions.length === 0 && (
              <p className="text-body-sm text-n-400">Sin antecedentes registrados.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
