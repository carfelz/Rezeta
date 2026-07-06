import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { CanvasView, type BlockModificationEvent } from '@/components/consultations/CanvasView'
import { ProtocolPickerModal } from '@/components/protocols/ProtocolPickerModal'
import { ProtocolBar } from './ProtocolBar'
import {
  useAddProtocolUsage,
  useRemoveProtocolUsage,
  useSkipStep,
  useAddOffProtocolNote,
} from '@/hooks/consultations/use-consultations'
import type { ConsultationWithDetails, SignConsultationResponse } from '@rezeta/shared'
import { chainBreadcrumbStrings } from '@/components/consultations/strings'
import { ConsultationModals } from './ConsultationModals'
import { protocolPanelStrings } from './strings'

interface ProtocolPanelProps {
  consultation: ConsultationWithDetails
  readOnly: boolean
  /** Buffers a block modification locally; persisted on sign or page change. */
  onRecordModification: (usageId: string, event: BlockModificationEvent) => void
  /** Persists buffered modifications; resolves false if any PATCH failed. */
  onFlushPending: () => Promise<boolean>
  showSign: boolean
  onShowSignChange: (open: boolean) => void
  onSigned?: ((result: SignConsultationResponse) => void) | undefined
  showAmend: boolean
  onShowAmendChange: (open: boolean) => void
  showPicker: boolean
  onShowPickerChange: (open: boolean) => void
}

export function ProtocolPanel({
  consultation,
  readOnly,
  onRecordModification,
  onFlushPending,
  showSign,
  onShowSignChange,
  onSigned,
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

  const [usageIdStack, setUsageIdStack] = useState<string[]>([])

  const [skipStepTarget, setSkipStepTarget] = useState<{ id: string; title: string } | null>(null)
  const [showOffProtocolNote, setShowOffProtocolNote] = useState(false)

  const skipStepMutation = useSkipStep(id, activeUsage?.id ?? '')
  const offProtocolNoteMutation = useAddOffProtocolNote(id, activeUsage?.id ?? '')

  const protocolIds = consultation.protocolUsages.map((u) => u.protocolId)

  function handleModification(event: BlockModificationEvent): void {
    if (!activeUsage) return
    onRecordModification(activeUsage.id, event)
  }

  function handleCheck(checkId: string, checked: boolean): void {
    handleModification({ type: 'checklist_item', item_id: checkId, checked })
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
      { stepId: skipStepTarget.id, reason },
      { onSuccess: () => setSkipStepTarget(null) },
    )
  }

  function handleSaveOffProtocolNote(args: { title: string; body: string }): void {
    if (!activeUsage) return
    offProtocolNoteMutation.mutate(
      {
        ...(args.title ? { title: args.title } : {}),
        note: args.body,
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
        !readOnly && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <i className="ph ph-clipboard-text text-[32px] text-n-300" />
            <p className="text-body text-n-500 m-0">{protocolPanelStrings.noProtocolTitle}</p>
            <Button variant="primary" onClick={() => onShowPickerChange(true)}>
              <i className="ph ph-plus mr-2" />
              {protocolPanelStrings.addProtocol}
            </Button>
          </div>
        )
      )}

      {!readOnly && activeUsage && (
        <div className="mt-4 flex justify-center">
          <button
            className="flex items-center gap-2 w-full max-w-xl py-4 border-2 border-dashed border-n-200 rounded-md text-n-400 hover:border-p-400 hover:text-p-600 transition-colors justify-center text-[13px]"
            onClick={() => onShowPickerChange(true)}
          >
            <i className="ph ph-plus text-[15px]" />
            {protocolPanelStrings.addProtocol}
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
        onBeforeSign={onFlushPending}
        onShowSignChange={onShowSignChange}
        onSigned={onSigned}
        showAmend={showAmend}
        onShowAmendChange={onShowAmendChange}
        showPicker={showPicker}
        onShowPickerChange={onShowPickerChange}
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
