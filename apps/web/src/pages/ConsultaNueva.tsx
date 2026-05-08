import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useCreateConsultation,
  useResumableForPatient,
} from '@/hooks/consultations/use-consultations'
import { useLocations } from '@/hooks/locations/use-locations'
import { usePatients } from '@/hooks/patients/use-patients'
import { useAuth } from '@/hooks/use-auth'
import { ConsultHeader } from '@/components/consultations/ConsultHeader'
import { ConsultationGate } from '@/components/consultations/ConsultationGate'
import { ResumeBanner } from '@/components/consultations/ResumeBanner'
import {
  Button,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { formatConsultationOverline, formatBreadcrumbDate } from '@/lib/format/dates'

export function ConsultaNueva(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedPatientId = searchParams.get('patientId') ?? ''
  const preselectedLocationId = searchParams.get('locationId') ?? ''

  const { user } = useAuth()
  const { data: patientsData } = usePatients()
  const patients = patientsData?.items ?? []
  const { data: locations = [] } = useLocations()
  const createMutation = useCreateConsultation()

  const [patientId, setPatientId] = useState(preselectedPatientId)
  const [locationId, setLocationId] = useState(preselectedLocationId)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [resumeDismissed, setResumeDismissed] = useState(false)

  // Auto-default location to first owned location (or first location) when not
  // pre-filled from URL. Doctors typically have one primary working location.
  const defaultLocationId = useMemo(() => {
    if (locations.length === 0) return ''
    const owned = locations.find((l) => l.isOwned)
    return (owned ?? locations[0])?.id ?? ''
  }, [locations])

  useEffect(() => {
    if (!locationId && defaultLocationId) {
      setLocationId(defaultLocationId)
    }
  }, [defaultLocationId, locationId])

  const patient = patients.find((p) => p.id === patientId) ?? null
  const location = locations.find((l) => l.id === locationId) ?? null
  const ready = Boolean(patientId && locationId)
  const now = new Date()
  const { data: resumable } = useResumableForPatient(ready ? patientId : null)

  const doctorDisplayName = user?.fullName?.trim() ? `Dr. ${user.fullName}` : 'Doctor(a)'

  async function handleGateSelect(protocolId: string | null): Promise<void> {
    if (!ready) {
      setError('Selecciona paciente y ubicación antes de continuar.')
      return
    }
    setError(null)
    setIsCreating(true)
    try {
      const consultation = await createMutation.mutateAsync({
        patientId,
        locationId,
        diagnoses: [],
        ...(protocolId ? { protocolId } : {}),
      })
      void navigate(`/consultas/${consultation.id}`, { replace: true })
    } catch {
      setError('No se pudo crear la consulta. Inténtalo de nuevo.')
    } finally {
      setIsCreating(false)
    }
  }

  const patientFullName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : null
  const breadcrumbs = patient
    ? [
        { label: 'Pacientes', to: '/pacientes' },
        { label: patientFullName ?? '', to: `/pacientes/${patient.id}` },
        { label: `Consulta · ${formatBreadcrumbDate(now)}` },
      ]
    : [
        { label: 'Pacientes', to: '/pacientes' },
        { label: `Nueva consulta · ${formatBreadcrumbDate(now)}` },
      ]

  const datetimeOverline = location
    ? formatConsultationOverline(now, location.name)
    : formatConsultationOverline(now, '')

  const subtitle = patient ? `${patientFullName} · ${doctorDisplayName}` : doctorDisplayName

  const showInlinePickers = !patient || !location

  return (
    <div>
      <ConsultHeader
        breadcrumbs={breadcrumbs}
        datetimeOverline={datetimeOverline}
        title="Nueva consulta"
        subtitle={subtitle}
        rightSlot={
          <Button
            variant="secondary"
            size="sm"
            disabled={isCreating || !ready}
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

      {showInlinePickers && (
        <div className="max-w-[880px] mx-auto mt-6 px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!patient && (
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
            )}
            {!location && (
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
            )}
          </div>
        </div>
      )}

      {ready && resumable && !resumeDismissed && resumable.protocolUsage && (
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
        {...(patient?.firstName ? { patientFirstName: patient.firstName } : {})}
        locationId={locationId}
        onSelect={(id) => void handleGateSelect(id)}
        isCreating={isCreating}
        disabled={!ready}
      />
    </div>
  )
}
