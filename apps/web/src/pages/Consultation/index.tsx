import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useAddOffProtocolNote,
  useAddProtocolUsage,
  useConsultation,
  usePatientConsultations,
  useRemoveProtocolUsage,
  useSkipStep,
  useUpdateCheckedState,
  useUpdateConsultation,
} from '@/hooks/consultations/use-consultations'
import { usePatient } from '@/hooks/patients/use-patients'
import { useConsultationViewMode } from '@/hooks/consultations/use-consultation-view-mode'
import { Button } from '@/components/ui'
import { CanvasView, type SoapField } from '@/components/consultations/CanvasView'
import { useOrderQueueStore } from '@/store/order-queue.store'
import { useOrderQueueSession } from '@/hooks/consultations/use-order-queue-session'
import { useBeforeUnloadGuard } from '@/hooks/use-before-unload-guard'
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
import { ConsultationModals } from './ConsultationModals'
import { useSoapState } from './use-soap-state'
import { formatDate } from './helpers'
import { formatBreadcrumbDate } from '@/lib/format/dates'
import { consultationPageStrings } from './strings'
import { chainBreadcrumbStrings } from '@/components/consultations/strings'

export function Consultation(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: consultation, isLoading, isError } = useConsultation(id!)
  const updateMutation = useUpdateConsultation(id!)
  const addUsageMutation = useAddProtocolUsage(id ?? '')
  const removeUsageMutation = useRemoveProtocolUsage(id ?? '')

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

  const [usageIdStack, setUsageIdStack] = useState<string[]>([])

  function handleCheck(id: string, checked: boolean): void {
    if (!activeUsage) return
    const next = { ...activeUsage.checkedState, [id]: checked }
    updateCheckedState.mutate({ checkedState: next })
  }

  function handleAutoPopulate(field: SoapField, text: string): void {
    const current: Record<string, string> = {
      objective: soap.objective,
      assessment: soap.assessment,
      plan: soap.plan,
    }
    const setters: Record<string, (v: string) => void> = {
      objective: soap.setObjective,
      assessment: soap.setAssessment,
      plan: soap.setPlan,
    }
    const existing = current[field] ?? ''
    setters[field]?.(existing ? `${existing}\n${text}` : text)
  }

  function handleLaunchLinkedProtocol(protocolId: string, triggerBlockId: string): void {
    if (!activeUsage) return
    const parentId = activeUsage.id
    setUsageIdStack((prev) => [...prev, parentId])
    addUsageMutation.mutate(
      { protocolId, parentUsageId: parentId, triggerBlockId },
      {
        onSuccess: (newUsage) => setActiveUsageId(newUsage.id),
        onError: () => setUsageIdStack((prev) => prev.slice(0, -1)),
      },
    )
  }

  function handleBackInChain(): void {
    const prevId = usageIdStack[usageIdStack.length - 1] ?? null
    setActiveUsageId(prevId)
    setUsageIdStack((prev) => prev.slice(0, -1))
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

  const consultationSigned = consultation?.status === 'signed'
  const hasUnsavedOrders = useOrderQueueStore(
    (s) => s.medications.length > 0 || s.imagingOrders.length > 0 || s.labOrders.length > 0,
  )
  useOrderQueueSession(id ?? '', consultationSigned)
  useBeforeUnloadGuard(hasUnsavedOrders && !consultationSigned)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-[13px] text-n-500 flex items-center gap-2">
          <i className="ph ph-spinner animate-spin" /> {consultationPageStrings.loading}
        </div>
      </div>
    )
  }

  if (isError || !consultation) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <i className="ph ph-warning text-[32px] text-n-300 mb-3" />
        <p className="text-[14px] text-n-600 mb-4">{consultationPageStrings.loadError}</p>
        <Button variant="secondary" onClick={() => void navigate(-1)}>
          {consultationPageStrings.backButton}
        </Button>
      </div>
    )
  }

  const isSigned = consultationSigned
  const protocolIds = consultation.protocolUsages.map((u) => u.protocolId)
  // Derive from server record + live soap state. Server values cover first
  // render (soap state hydrates one tick later); soap values cover live edits.
  const hasContent = Boolean(
    soap.chiefComplaint.trim() ||
    (consultation.chiefComplaint ?? '').trim() ||
    (consultation.subjective ?? '').trim() ||
    (consultation.objective ?? '').trim() ||
    (consultation.assessment ?? '').trim() ||
    (consultation.plan ?? '').trim() ||
    consultation.diagnoses.length > 0 ||
    soap.subjective.trim() ||
    soap.objective.trim() ||
    soap.assessment.trim() ||
    soap.plan.trim() ||
    soap.diagnoses.length > 0,
  )
  const dateShort = formatBreadcrumbDate(new Date(consultation.consultedAt))
  const pageTitle = isSigned
    ? `Consulta del ${dateShort} · firmada`
    : hasContent
      ? `Consulta del ${dateShort}`
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
        {...(soap.savedAt !== undefined ? { savedAt: soap.savedAt } : {})}
        isSigned={isSigned}
        onAmend={() => setShowAmend(true)}
        onRetry={soap.saveNow}
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
            isSigned={isSigned}
            onFieldClick={(fieldId) => {
              setShowMissingFields(false)
              document.getElementById(`field-${fieldId}`)?.scrollIntoView({ behavior: 'smooth' })
            }}
            onDismiss={() => setShowMissingFields(false)}
            onSign={() => {
              setShowMissingFields(false)
              setShowSign(true)
            }}
          />
        </div>
      )}

      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 360px' }}>
        <div className="min-w-0">
          {viewMode === 'canvas' && activeUsage && usageIdStack.length > 0 && (
            <div className="flex items-center gap-3 mb-3 py-2">
              <Button variant="ghost" size="sm" onClick={handleBackInChain}>
                ← {chainBreadcrumbStrings.backButton}
              </Button>
              <div className="flex items-center gap-1 text-[12px] font-mono text-n-500 flex-wrap">
                {[...usageIdStack, activeUsage.id].map((uid, i) => {
                  const isActive = uid === activeUsage.id
                  const title = isActive
                    ? activeUsage.protocolTitle
                    : (consultation.protocolUsages.find((u) => u.id === uid)?.protocolTitle ?? '…')
                  return (
                    <span key={uid} className="flex items-center gap-1">
                      {i > 0 && <span className="text-n-300">→</span>}
                      <span className={isActive ? 'text-n-800 font-semibold' : 'text-n-400'}>
                        {title}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
          {viewMode === 'canvas' && activeUsage ? (
            <CanvasView
              usage={activeUsage}
              onCheck={handleCheck}
              onAutoPopulate={handleAutoPopulate}
              onLaunchLinkedProtocol={handleLaunchLinkedProtocol}
              isSigned={isSigned}
              onContinueWithoutProtocol={() => {
                if (activeUsage) {
                  removeUsageMutation.mutate(activeUsage.id, {
                    onSuccess: () => setActiveUsageId(null),
                  })
                }
              }}
              onEditProtocol={() => void navigate(`/protocolos/${activeUsage.protocolId}/edit`)}
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
          className="self-start sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto"
          aria-label={consultationPageStrings.complementaryInfoLabel}
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
            viewMode={viewMode}
          />
        </aside>
      </div>

      <ConsultationModals
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
