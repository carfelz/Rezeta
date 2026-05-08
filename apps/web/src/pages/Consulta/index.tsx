import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useAddOffProtocolNote,
  useAddProtocolUsage,
  useConsultation,
  usePatientConsultations,
  useSkipStep,
  useUpdateCheckedState,
  useUpdateConsultation,
} from '@/hooks/consultations/use-consultations'
import { usePatient } from '@/hooks/patients/use-patients'
import { useConsultationViewMode } from '@/hooks/consultations/use-consultation-view-mode'
import { Button } from '@/components/ui'
import { CanvasView } from '@/components/consultations/CanvasView'
import {
  MissingFieldsPanel,
  computeMissingFields,
} from '@/components/consultations/MissingFieldsPanel'
import { SoapView } from '@/components/consultations/SoapView'
import { ConsultationSidebar } from '@/components/consultations/ConsultationSidebar'
import { Breadcrumb } from './Breadcrumb'
import { PageHeader } from './PageHeader'
import { SignedBanner } from './SignedBanner'
import { AmendmentsBanner } from './AmendmentsBanner'
import { ProtocolBar } from './ProtocolBar'
import { ConsultaModals } from './ConsultaModals'
import { useSoapState } from './use-soap-state'
import { formatDate } from './helpers'

export function Consulta(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: consultation, isLoading, isError } = useConsultation(id!)
  const updateMutation = useUpdateConsultation(id!)
  const addUsageMutation = useAddProtocolUsage(id ?? '')

  const soap = useSoapState(consultation, updateMutation)

  const { data: patient } = usePatient(consultation?.patientId ?? '')
  const { data: prevConsultations = [] } = usePatientConsultations(consultation?.patientId ?? '')
  const prevList = prevConsultations.filter((c) => c.id !== id).slice(0, 4)

  const hasProtocol = Boolean(consultation?.protocolUsages?.length)
  const { viewMode, setViewMode } = useConsultationViewMode(hasProtocol)

  const [activeUsageId, setActiveUsageId] = useState<string | null>(null)
  const activeUsage =
    (activeUsageId && consultation?.protocolUsages?.find((u) => u.id === activeUsageId)) ||
    consultation?.protocolUsages?.[0]
  const updateCheckedState = useUpdateCheckedState(id!, activeUsage?.id ?? '')

  function handleToggleStep(stepId: string, checked: boolean): void {
    if (!activeUsage) return
    const next = { ...activeUsage.checkedState, [stepId]: checked }
    updateCheckedState.mutate({ checkedState: next })
  }

  const [showMissingFields, setShowMissingFields] = useState(false)
  const missingFields = computeMissingFields({
    chiefComplaint: soap.chiefComplaint,
    subjective: soap.subjective,
    objective: soap.objective,
    assessment: soap.assessment,
    plan: soap.plan,
    diagnoses: soap.diagnoses,
  })

  const [showSign, setShowSign] = useState(false)
  const [showAmend, setShowAmend] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showSwitch, setShowSwitch] = useState(false)
  const [skipStepTarget, setSkipStepTarget] = useState<{ id: string; title: string } | null>(null)
  const [showOffProtocolNote, setShowOffProtocolNote] = useState(false)

  const skipStepMutation = useSkipStep(id ?? '', activeUsage?.id ?? '')
  const offProtocolNoteMutation = useAddOffProtocolNote(id ?? '', activeUsage?.id ?? '')

  function handleSignClick(): void {
    if (missingFields.length > 0) {
      setShowMissingFields(true)
      return
    }
    setShowSign(true)
  }

  function handleConfirmSkipStep(reason: string): void {
    if (!skipStepTarget || !activeUsage) return
    skipStepMutation.mutate(
      {
        stepId: skipStepTarget.id,
        reason,
        existingSkipped: activeUsage.modifications?.steps_skipped ?? [],
      },
      { onSuccess: () => setSkipStepTarget(null) },
    )
  }

  function handleSaveOffProtocolNote(args: {
    title: string
    body: string
    promoteTo: 'subjective' | 'objective' | 'assessment' | 'plan' | null
  }): void {
    if (!activeUsage) return
    const fieldMap = {
      subjective: soap.subjective,
      objective: soap.objective,
      assessment: soap.assessment,
      plan: soap.plan,
    } as const
    offProtocolNoteMutation.mutate(
      {
        ...(args.title ? { title: args.title } : {}),
        note: args.body,
        ...(args.promoteTo ? { promoteTo: args.promoteTo } : {}),
        existingNotes: activeUsage.modifications?.off_protocol_notes ?? [],
        existingSoapValue: args.promoteTo ? (fieldMap[args.promoteTo] ?? '') : '',
      },
      { onSuccess: () => setShowOffProtocolNote(false) },
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-[13px] text-n-500 flex items-center gap-2">
          <i className="ph ph-spinner animate-spin" /> Cargando consulta…
        </div>
      </div>
    )
  }

  if (isError || !consultation) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <i className="ph ph-warning text-[32px] text-n-300 mb-3" />
        <p className="text-[14px] text-n-600 mb-4">No se pudo cargar la consulta.</p>
        <Button variant="secondary" onClick={() => void navigate(-1)}>
          Volver
        </Button>
      </div>
    )
  }

  const isSigned = consultation.status === 'signed'
  const protocolIds = consultation.protocolUsages.map((u) => u.protocolId)
  const hasContent = Boolean(
    soap.chiefComplaint.trim() ||
    soap.subjective.trim() ||
    soap.objective.trim() ||
    soap.assessment.trim() ||
    soap.plan.trim() ||
    soap.diagnoses.length > 0,
  )
  const dateShort = formatDate(consultation.consultedAt)
  const pageTitle = isSigned
    ? `Consulta del ${dateShort} · firmada`
    : hasContent
      ? soap.chiefComplaint.trim() || `Consulta del ${dateShort}`
      : 'Nueva consulta'

  return (
    <div className="py-8 px-8 max-w-[1440px]">
      <Breadcrumb patientName={consultation.patientName} consultedAt={consultation.consultedAt} />

      <PageHeader
        consultedAt={consultation.consultedAt}
        locationName={consultation.locationName}
        patientName={consultation.patientName}
        doctorName={consultation.doctorName}
        pageTitle={pageTitle}
        saveStatus={soap.saveStatus}
        isSigned={isSigned}
        isSaving={updateMutation.isPending}
        onAmend={() => setShowAmend(true)}
        onSaveDraft={soap.saveNow}
        onSignClick={handleSignClick}
      />

      {isSigned && consultation.signedAt && (
        <SignedBanner signedAt={consultation.signedAt} doctorName={consultation.doctorName} />
      )}

      <AmendmentsBanner amendments={consultation.amendments} />

      <ProtocolBar
        consultation={consultation}
        activeUsage={activeUsage}
        isSigned={isSigned}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSelectUsage={setActiveUsageId}
        onAddProtocol={() => setShowPicker(true)}
        onSwitchProtocol={() => setShowSwitch(true)}
        onAddOffProtocolNote={() => setShowOffProtocolNote(true)}
      />

      {showMissingFields && (
        <div className="mb-5">
          <MissingFieldsPanel
            fields={missingFields}
            onFieldClick={(fieldId) => {
              setShowMissingFields(false)
              document.getElementById(`field-${fieldId}`)?.scrollIntoView({ behavior: 'smooth' })
            }}
            onDismiss={() => setShowMissingFields(false)}
          />
        </div>
      )}

      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 360px' }}>
        <div className="min-w-0">
          {viewMode === 'canvas' && activeUsage ? (
            <CanvasView
              usage={activeUsage}
              soap={{
                chiefComplaint: soap.chiefComplaint,
                subjective: soap.subjective,
                objective: soap.objective,
                assessment: soap.assessment,
                plan: soap.plan,
              }}
              onSoapChange={(field, value) => {
                const setters: Record<string, (v: string) => void> = {
                  chiefComplaint: soap.setChiefComplaint,
                  subjective: soap.setSubjective,
                  objective: soap.setObjective,
                  assessment: soap.setAssessment,
                  plan: soap.setPlan,
                }
                setters[field]?.(value)
              }}
              onToggleStep={handleToggleStep}
              onSkipStep={(step) => setSkipStepTarget(step)}
              isSigned={isSigned}
            />
          ) : (
            <SoapView
              chiefComplaint={soap.chiefComplaint}
              onChiefComplaintChange={soap.setChiefComplaint}
              subjective={soap.subjective}
              onSubjectiveChange={soap.setSubjective}
              objective={soap.objective}
              onObjectiveChange={soap.setObjective}
              assessment={soap.assessment}
              onAssessmentChange={soap.setAssessment}
              plan={soap.plan}
              onPlanChange={soap.setPlan}
              vitals={soap.vitals}
              onVitalsChange={soap.setVitals}
              diagnoses={soap.diagnoses}
              onDiagnosesChange={soap.setDiagnoses}
              isSigned={isSigned}
            />
          )}
        </div>

        <aside
          className="self-start sticky top-[80px] max-h-[calc(100vh-100px)] overflow-y-auto"
          aria-label="Información complementaria"
        >
          <ConsultationSidebar
            consultationId={consultation.id}
            isSigned={isSigned}
            hasProtocols={consultation.protocolUsages.length > 0}
            patient={patient ?? null}
            prevList={prevList.map((c) => ({
              id: c.id,
              consultedAt: c.consultedAt,
              chiefComplaint: c.chiefComplaint,
            }))}
            onAddProtocol={() => setShowPicker(true)}
            onPrevClick={(prevId) => void navigate(`/consultas/${prevId}`)}
            formatDate={formatDate}
          />
        </aside>
      </div>

      <ConsultaModals
        consultationId={consultation.id}
        activeUsage={activeUsage}
        protocolIds={protocolIds}
        showSign={showSign}
        onShowSignChange={setShowSign}
        showAmend={showAmend}
        onShowAmendChange={setShowAmend}
        showPicker={showPicker}
        onShowPickerChange={setShowPicker}
        showSwitch={showSwitch}
        onShowSwitchChange={setShowSwitch}
        skipStepTarget={skipStepTarget}
        onSkipStepTargetChange={setSkipStepTarget}
        showOffProtocolNote={showOffProtocolNote}
        onShowOffProtocolNoteChange={setShowOffProtocolNote}
        isAddingProtocol={addUsageMutation.isPending}
        isSkippingStep={skipStepMutation.isPending}
        isSavingOffProtocolNote={offProtocolNoteMutation.isPending}
        onAddProtocol={(protocolId) =>
          addUsageMutation.mutate({ protocolId }, { onSuccess: () => setShowPicker(false) })
        }
        onConfirmSkipStep={handleConfirmSkipStep}
        onSaveOffProtocolNote={handleSaveOffProtocolNote}
      />
    </div>
  )
}
