import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useCreateConsultation,
  useResumableForPatient,
} from '@/hooks/consultations/use-consultations'
import { useLocations } from '@/hooks/locations/use-locations'
import { usePatients } from '@/hooks/patients/use-patients'
import { ConsultHeader } from '@/components/consultations/ConsultHeader'
import { ConsultationGate } from '@/components/consultations/ConsultationGate'
import { ResumeBanner } from '@/components/consultations/ResumeBanner'
import { apiClient } from '@/lib/api-client'
import {
  Button,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

const SPANISH_DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']
const SPANISH_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const SPANISH_MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

function formatHeader(now: Date, locationName: string): string {
  const day = SPANISH_DAYS[now.getDay()] ?? ''
  const date = now.getDate()
  const month = (SPANISH_MONTHS[now.getMonth()] ?? '').toUpperCase()
  const year = now.getFullYear()
  let h = now.getHours()
  const min = now.getMinutes()
  const isPm = h >= 12
  h = h % 12 || 12
  const time = `${h}:${min.toString().padStart(2, '0')} ${isPm ? 'P.M.' : 'A.M.'}`
  return `${day}, ${date} DE ${month} DE ${year} · ${time} · ${locationName.toUpperCase()}`
}

function formatBreadcrumbDate(now: Date): string {
  return `${now.getDate()} ${SPANISH_MONTHS_SHORT[now.getMonth()] ?? ''} de ${now.getFullYear()}`
}

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
  const [isCreating, setIsCreating] = useState(false)

  // ── Gate mode: both patient + location are known ──────────────────────────────
  const showGate = Boolean(patientId && locationId)
  const patient = patients.find((p) => p.id === patientId)
  const location = locations.find((l) => l.id === locationId)
  const now = new Date()
  const [resumeDismissed, setResumeDismissed] = useState(false)
  const { data: resumable } = useResumableForPatient(showGate ? patientId : null)

  async function handleGateSelect(protocolId: string | null): Promise<void> {
    setError(null)
    setIsCreating(true)
    try {
      const consultation = await apiClient.post<{ id: string }>('/v1/consultations', {
        patientId,
        locationId,
        diagnoses: [],
      })
      if (protocolId) {
        try {
          await apiClient.post(`/v1/consultations/${consultation.id}/protocols`, { protocolId })
        } catch {
          // Non-fatal: consultation was created; protocol can be added from inside
        }
      }
      void navigate(`/consultas/${consultation.id}`, { replace: true })
    } catch {
      setError('No se pudo crear la consulta. Inténtalo de nuevo.')
    } finally {
      setIsCreating(false)
    }
  }

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

  // Show gate when both patient + location are present
  if (showGate && patient && location) {
    const patientFullName = `${patient.firstName} ${patient.lastName}`.trim()
    const datetimeOverline = formatHeader(now, location.name)

    return (
      <div>
        <ConsultHeader
          breadcrumbs={[
            { label: 'Pacientes', to: '/pacientes' },
            { label: patientFullName, to: `/pacientes/${patient.id}` },
            { label: `Consulta · ${formatBreadcrumbDate(now)}` },
          ]}
          datetimeOverline={datetimeOverline}
          title="Nueva consulta"
          subtitle={`${patientFullName} · Dr. Test García`}
          rightSlot={
            <Button
              variant="secondary"
              size="sm"
              disabled={isCreating}
              onClick={() => void handleGateSelect(null)}
            >
              Saltar y abrir consulta vacía
            </Button>
          }
        />
        {error && (
          <div className="mx-auto max-w-[880px] mt-6">
            <div className="text-[12.5px] text-danger-text bg-danger-bg border border-danger-border rounded-sm px-3 py-2">
              {error}
            </div>
          </div>
        )}
        {resumable && !resumeDismissed && resumable.protocolUsage && (
          <div className="mx-auto mt-8">
            <ResumeBanner
              usage={resumable.protocolUsage}
              patientName={resumable.patientName}
              {...(resumable.patientAge != null ? { patientAge: resumable.patientAge } : {})}
              {...(resumable.currentStepNumber != null && resumable.currentStepTitle
                ? {
                    currentStep: {
                      number: resumable.currentStepNumber,
                      title: resumable.currentStepTitle,
                    },
                  }
                : {})}
              {...(resumable.totalSteps != null ? { totalSteps: resumable.totalSteps } : {})}
              {...(resumable.completedSteps != null
                ? { completedSteps: resumable.completedSteps }
                : {})}
              {...(resumable.lastEditField ? { lastEditField: resumable.lastEditField } : {})}
              lastEditTime={new Date(resumable.lastEditTime).toLocaleTimeString('es-DO', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              elapsedMinutes={resumable.elapsedMinutes}
              onResume={() =>
                void navigate(`/consultas/${resumable.consultationId}`, { replace: true })
              }
              onStartNew={() => setResumeDismissed(true)}
            />
          </div>
        )}
        <ConsultationGate
          patientId={patientId}
          patientFirstName={patient.firstName}
          locationId={locationId}
          onSelect={(id) => void handleGateSelect(id)}
          isCreating={isCreating}
        />
      </div>
    )
  }

  // ── Fallback: pick patient + location ─────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-n-0 border border-n-200 rounded-md p-6">
        <h1 className="text-[20px] font-serif font-medium text-n-900 mb-1">Nueva consulta</h1>
        <p className="text-[13px] text-n-500 mb-6">Selecciona el paciente y la ubicación.</p>

        {error && (
          <div className="mb-4 text-[12.5px] text-danger-text bg-danger-bg border border-danger-border rounded-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Field label="Paciente">
            <Select
              value={patientId}
              onValueChange={(v) => {
                setPatientId(v)
                setError(null)
              }}
            >
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
            <Select
              value={locationId}
              onValueChange={(v) => {
                setLocationId(v)
                setError(null)
              }}
            >
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
