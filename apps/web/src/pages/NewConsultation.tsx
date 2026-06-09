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
import { ResumeBanner } from '@/components/consultations/ResumeBanner'
import { Button } from '@/components/ui'
import { formatConsultationOverline, formatBreadcrumbDate } from '@/lib/format/dates'
import { formatDoctorName } from '@/lib/format/names'
import { logger } from '@/lib/logger'
import { newConsultationStrings } from './Consultation/strings'

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

  async function handleCreate(): Promise<void> {
    if (!ready) {
      setError(newConsultationStrings.selectPatientLocationError)
      return
    }
    setError(null)
    setIsCreating(true)
    try {
      const consultation = await createMutation.mutateAsync({
        patientId,
        locationId,
      })
      void navigate(`/consultas/${consultation.id}`, { replace: true })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'NewConsultation.create' })
      setError(newConsultationStrings.createError)
    } finally {
      setIsCreating(false)
    }
  }

  const patientFullName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : null
  const breadcrumbs = patient
    ? [
        { label: newConsultationStrings.breadcrumbPatients, to: '/pacientes' },
        { label: patientFullName ?? '', to: `/pacientes/${patient.id}` },
        { label: `${newConsultationStrings.breadcrumbDatePrefix} · ${formatBreadcrumbDate(now)}` },
      ]
    : [
        { label: newConsultationStrings.breadcrumbPatients, to: '/pacientes' },
        {
          label: `${newConsultationStrings.breadcrumbNewConsultation} · ${formatBreadcrumbDate(now)}`,
        },
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
        title={newConsultationStrings.pageTitle}
        subtitle={subtitle}
        rightSlot={
          <Button
            variant="primary"
            size="sm"
            disabled={isCreating || !ready}
            onClick={() => void handleCreate()}
          >
            {isCreating ? newConsultationStrings.creatingButton : newConsultationStrings.openEmptyButton}
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

      {ready && (!resumable || resumeDismissed || !resumable.protocolUsage) && (
        <div className="max-w-[880px] mx-auto pt-8">
          <div className="flex flex-col items-center gap-4 py-16 border border-dashed border-n-200 rounded-md text-center">
            <i className="ph ph-stethoscope text-[32px] text-n-400" />
            <div>
              <p className="text-[15px] font-medium text-n-800 mb-1">
                {newConsultationStrings.readyTitle}
              </p>
              <p className="text-[13px] text-n-500">
                {newConsultationStrings.readyDescription}
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              disabled={isCreating}
              onClick={() => void handleCreate()}
            >
              {isCreating ? newConsultationStrings.creatingButton : newConsultationStrings.openEmptyButton}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
