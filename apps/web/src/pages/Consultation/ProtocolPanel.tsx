import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { CanvasView, type SoapField, type BlockModificationEvent } from '@/components/consultations/CanvasView'
import { SoapView } from '@/components/consultations/SoapView'
import { ProtocolPickerModal } from '@/components/protocols/ProtocolPickerModal'
import { ProtocolBar } from './ProtocolBar'
import { appendModification } from '@/lib/consultation/modifications'
import {
  useAddProtocolUsage,
  useRemoveProtocolUsage,
  useUpdateProtocolUsage,
  useSkipStep,
  useAddOffProtocolNote,
} from '@/hooks/consultations/use-consultations'
import type { ConsultationWithDetails, UpdateProtocolUsageDto } from '@rezeta/shared'
import type { useSoapState } from './use-soap-state'
import { chainBreadcrumbStrings } from '@/components/consultations/strings'
import { ConsultationModals } from './ConsultationModals'

interface ProtocolPanelProps {
  consultation: ConsultationWithDetails
  readOnly: boolean
  soap: ReturnType<typeof useSoapState>
  showSign: boolean
  onShowSignChange: (open: boolean) => void
  showAmend: boolean
  onShowAmendChange: (open: boolean) => void
  showPicker: boolean
  onShowPickerChange: (open: boolean) => void
}

export function ProtocolPanel({
  consultation,
  readOnly,
  soap,
  showSign,
  onShowSignChange,
  showAmend,
  onShowAmendChange,
  showPicker,
  onShowPickerChange,
}: ProtocolPanelProps): JSX.Element {
  const navigate = useNavigate()
  const id = consultation.id
  const addUsageMutation = useAddProtocolUsage(id)
  const removeUsageMutation = useRemoveProtocolUsage(id)

  const [activeUsageId, setActiveUsageId] = useState<string | null>(null)
  const activeUsage =
    (activeUsageId && consultation.protocolUsages?.find((u) => u.id === activeUsageId)) ||
    consultation.protocolUsages?.[0]

  const updateProtocolUsage = useUpdateProtocolUsage(id, activeUsage?.id ?? '')
  const [usageIdStack, setUsageIdStack] = useState<string[]>([])

  const [showSwitch, setShowSwitch] = useState(false)
  const [skipStepTarget, setSkipStepTarget] = useState<{ id: string; title: string } | null>(null)
  const [showOffProtocolNote, setShowOffProtocolNote] = useState(false)

  const skipStepMutation = useSkipStep(id, activeUsage?.id ?? '')
  const offProtocolNoteMutation = useAddOffProtocolNote(id, activeUsage?.id ?? '')

  const protocolIds = consultation.protocolUsages.map((u) => u.protocolId)

  function handleModification(event: BlockModificationEvent): void {
    if (!activeUsage) return
    const next = appendModification(activeUsage.modifications ?? {}, event)
    updateProtocolUsage.mutate({
      modifications: next as unknown as UpdateProtocolUsageDto['modifications'],
    })
  }

  function handleCheck(checkId: string, checked: boolean): void {
    handleModification({ type: 'checklist_item', item_id: checkId, checked })
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

  return (
    <>
      <ProtocolBar
        consultation={consultation}
        activeUsage={activeUsage}
        isSigned={readOnly}
        onSelectUsage={setActiveUsageId}
        onAddProtocol={() => onShowPickerChange(true)}
        onSwitchProtocol={() => setShowSwitch(true)}
        onAddOffProtocolNote={() => setShowOffProtocolNote(true)}
      />

      {activeUsage && usageIdStack.length > 0 && (
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

      {activeUsage ? (
        <CanvasView
          usage={activeUsage}
          onCheck={handleCheck}
          onAutoPopulate={handleAutoPopulate}
          onLaunchLinkedProtocol={handleLaunchLinkedProtocol}
          onModification={handleModification}
          isSigned={readOnly}
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
          isSigned={readOnly}
        />
      )}

      {!readOnly && (
        <div className="mt-4 flex justify-center">
          <button
            className="flex items-center gap-2 w-full max-w-xl py-4 border-2 border-dashed border-n-200 rounded-md text-n-400 hover:border-p-400 hover:text-p-600 transition-colors justify-center text-[13px]"
            onClick={() => onShowPickerChange(true)}
          >
            <i className="ph ph-plus text-[15px]" />
            Agregar protocolo
          </button>
        </div>
      )}

      <ProtocolPickerModal
        open={showPicker}
        onOpenChange={onShowPickerChange}
        onSelect={(protocol) => {
          addUsageMutation.mutate(
            { protocolId: protocol.id },
            { onSuccess: () => onShowPickerChange(false) },
          )
        }}
        excludeIds={protocolIds}
        isPending={addUsageMutation.isPending}
      />

      <ConsultationModals
        consultationId={id}
        activeUsage={activeUsage}
        protocolIds={protocolIds}
        showSign={showSign}
        onShowSignChange={onShowSignChange}
        showAmend={showAmend}
        onShowAmendChange={onShowAmendChange}
        showPicker={showPicker}
        onShowPickerChange={onShowPickerChange}
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
          addUsageMutation.mutate({ protocolId }, { onSuccess: () => onShowPickerChange(false) })
        }
        onConfirmSkipStep={handleConfirmSkipStep}
        onSaveOffProtocolNote={handleSaveOffProtocolNote}
      />
    </>
  )
}
