import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useCreateConsultation,
  useResumableForPatient,
} from '@/hooks/consultations/use-consultations'
import { useLocations } from '@/hooks/locations/use-locations'
import { usePatients } from '@/hooks/patients/use-patients'
import { useAuth } from '@/hooks/use-auth'
import { useUiStore } from '@/store/ui.store'
import { ConsultHeader } from '@/components/consultations/ConsultHeader'
import { ConsultationGate } from '@/components/consultations/ConsultationGate'
import { ResumeBanner } from '@/components/consultations/ResumeBanner'
import { Button } from '@/components/ui'
import { formatConsultationOverline, formatBreadcrumbDate } from '@/lib/format/dates'
import { formatDoctorName } from '@/lib/format/names'

export function NewConsultation(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedPatientId = searchParams.get('patientId') ?? ''
  const preselectedLocationId = searchParams.get('locationId') ?? ''

  const { user } = useAuth()
  const { data: patientsData } = usePatients()
  const patients = patientsData?.items ?? []
  const { data: locations = [] } = useLocations()
  const activeLocationId = useUiStore((s) => s.activeLocationId)
  const createMutation = useCreateConsultation()

  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [resumeDismissed, setResumeDismissed] = useState(false)

  // Direction B: gate requires both patientId and locationId. If patientId is
  // missing, the user is redirected to /pacientes. If locationId is missing,
  // we fall back to the active or primary owned location and emit a telemetry
  // log so any unfixed entry point is discoverable.
  const primaryLocationId = user?.preferences?.primaryLocationId
  const fallbackLocationId = useMemo(() => {
    if (locations.length === 0) return ''
    if (activeLocationId && locations.some((l) => l.id === activeLocationId)) {
      return activeLocationId
    }
    if (primaryLocationId && locations.some((l) => l.id === primaryLocationId)) {
      return primaryLocationId
    }
    const owned = locations.find((l) => l.isOwned)
    return (owned ?? locations[0])?.id ?? ''
  }, [locations, activeLocationId, primaryLocationId])

  const patientId = preselectedPatientId
  const locationId = preselectedLocationId || fallbackLocationId

  // Redirect to /pacientes if the URL lacks patientId.
  useEffect(() => {
    if (!preselectedPatientId) {
      void navigate('/pacientes', { replace: true })
    }
  }, [preselectedPatientId, navigate])

  // Telemetry: emit once when an entry point lands on the gate without
  // locationId in the URL and we substitute a fallback.
  const telemetryEmittedRef = useRef(false)
  useEffect(() => {
    if (!preselectedLocationId && fallbackLocationId && !telemetryEmittedRef.current) {
      telemetryEmittedRef.current = true
      console.warn('[telemetry] gate_location_fallback', {
        patientId: preselectedPatientId,
        fallbackLocationId,
        path:
          typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
      })
    }
  }, [preselectedLocationId, fallbackLocationId, preselectedPatientId])

  const patient = patients.find((p) => p.id === patientId) ?? null
  const location = locations.find((l) => l.id === locationId) ?? null
  const ready = Boolean(patientId && locationId)
  const now = new Date()
  const { data: resumable } = useResumableForPatient(ready ? patientId : null)

  const doctorDisplayName = formatDoctorName(user?.fullName)

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
            Abrir consulta vacía
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
