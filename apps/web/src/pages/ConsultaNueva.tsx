import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCreateConsultation } from '@/hooks/consultations/use-consultations'
import { useLocations } from '@/hooks/locations/use-locations'
import { usePatients } from '@/hooks/patients/use-patients'
import {
  Button,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

export function ConsultaNueva(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedPatientId = searchParams.get('patientId') ?? ''
  const preselectedLocationId = searchParams.get('locationId') ?? ''

  const { data: patientsData } = usePatients()
  const patients = patientsData?.items ?? []
  const { data: locations = [] } = useLocations()
  const createMutation = useCreateConsultation()

  const [patientId, setPatientId] = useState(preselectedPatientId)
  const [locationId, setLocationId] = useState(preselectedLocationId)
  const [error, setError] = useState<string | null>(null)

  // Auto-create if both pre-selected
  useEffect(() => {
    if (
      preselectedPatientId &&
      preselectedLocationId &&
      !createMutation.isPending &&
      !createMutation.isSuccess
    ) {
      createMutation.mutate(
        { patientId: preselectedPatientId, locationId: preselectedLocationId, diagnoses: [] },
        {
          onSuccess: (consultation) => {
            void navigate(`/consultas/${consultation.id}`, { replace: true })
          },
          onError: () => {
            setError('No se pudo crear la consulta. Inténtalo de nuevo.')
          },
        },
      )
    }
  }, []) // intentionally empty: run once on mount

  function handleCreate(): void {
    if (!patientId || !locationId) return
    setError(null)
    createMutation.mutate(
      { patientId, locationId, diagnoses: [] },
      {
        onSuccess: (consultation) => {
          void navigate(`/consultas/${consultation.id}`, { replace: true })
        },
        onError: () => {
          setError('No se pudo crear la consulta. Inténtalo de nuevo.')
        },
      },
    )
  }

  // If both pre-selected, show loading
  if (preselectedPatientId && preselectedLocationId) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-[13px] text-n-500 flex items-center gap-2">
          <i className="ph ph-spinner animate-spin text-[16px]" />
          Creando consulta…
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-n-0 border border-n-200 rounded-md p-6">
        <h1 className="text-[20px] font-serif font-medium text-n-900 mb-1">Nueva consulta</h1>
        <p className="text-[13px] text-n-500 mb-6">Selecciona el paciente y la ubicación.</p>

        {error && (
          <div className="mb-4 text-[12.5px] text-danger-text bg-danger-bg border border-danger-border rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Field label="Paciente">
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar paciente…" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Ubicación">
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar ubicación…" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => void navigate(-1)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!patientId || !locationId || createMutation.isPending}
            onClick={handleCreate}
          >
            {createMutation.isPending ? 'Creando…' : 'Crear consulta'}
          </Button>
        </div>
      </div>
    </div>
  )
}
