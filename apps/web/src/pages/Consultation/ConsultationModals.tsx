import { Modal } from '@/components/ui'
import { AmendmentModal } from '@/components/consultations/AmendmentModal'
import { OffProtocolNote } from '@/components/consultations/OffProtocolNote'
import { ProtocolPickerModal } from '@/components/protocols/ProtocolPickerModal'
import { SignModal } from '@/components/consultations/SignModal'
import { SkipStepDialog } from '@/components/consultations/SkipStepDialog'
import { SwitchProtocolDialog } from '@/components/consultations/SwitchProtocolDialog'
import type { ConsultationProtocolUsage } from '@rezeta/shared'

type SoapField = 'subjective' | 'objective' | 'assessment' | 'plan'

export interface ConsultationModalsProps {
  consultationId: string
  activeUsage: ConsultationProtocolUsage | undefined
  protocolIds: string[]
  showSign: boolean
  onShowSignChange: (open: boolean) => void
  showAmend: boolean
  onShowAmendChange: (open: boolean) => void
  showPicker: boolean
  onShowPickerChange: (open: boolean) => void
  showSwitch: boolean
  onShowSwitchChange: (open: boolean) => void
  skipStepTarget: { id: string; title: string } | null
  onSkipStepTargetChange: (t: { id: string; title: string } | null) => void
  showOffProtocolNote: boolean
  onShowOffProtocolNoteChange: (open: boolean) => void
  isAddingProtocol: boolean
  isSkippingStep: boolean
  isSavingOffProtocolNote: boolean
  onAddProtocol: (protocolId: string) => void
  onConfirmSkipStep: (reason: string) => void
  onSaveOffProtocolNote: (args: {
    title: string
    body: string
    promoteTo: SoapField | null
  }) => void
}

export function ConsultationModals({
  consultationId,
  activeUsage,
  protocolIds,
  showSign,
  onShowSignChange,
  showAmend,
  onShowAmendChange,
  showPicker,
  onShowPickerChange,
  showSwitch,
  onShowSwitchChange,
  skipStepTarget,
  onSkipStepTargetChange,
  showOffProtocolNote,
  onShowOffProtocolNoteChange,
  isAddingProtocol,
  isSkippingStep,
  isSavingOffProtocolNote,
  onAddProtocol,
  onConfirmSkipStep,
  onSaveOffProtocolNote,
}: ConsultationModalsProps): JSX.Element {
  return (
    <>
      <Modal open={showSign} onOpenChange={onShowSignChange}>
        {showSign && (
          <SignModal consultationId={consultationId} onClose={() => onShowSignChange(false)} />
        )}
      </Modal>
      <Modal open={showAmend} onOpenChange={onShowAmendChange}>
        {showAmend && (
          <AmendmentModal
            consultationId={consultationId}
            onClose={() => onShowAmendChange(false)}
          />
        )}
      </Modal>
      <ProtocolPickerModal
        open={showPicker}
        onOpenChange={onShowPickerChange}
        excludeIds={protocolIds}
        isPending={isAddingProtocol}
        onSelect={(p) => onAddProtocol(p.id)}
      />
      <Modal open={showSwitch} onOpenChange={onShowSwitchChange}>
        {showSwitch && activeUsage && (
          <SwitchProtocolDialog
            consultationId={consultationId}
            currentUsageId={activeUsage.id}
            currentProtocolId={activeUsage.protocolId}
            currentProtocolTitle={activeUsage.protocolTitle}
            completedSteps={0}
            totalSteps={0}
            onClose={() => onShowSwitchChange(false)}
          />
        )}
      </Modal>
      <Modal
        open={skipStepTarget !== null}
        onOpenChange={(o) => {
          if (!o) onSkipStepTargetChange(null)
        }}
      >
        {skipStepTarget && (
          <SkipStepDialog
            stepTitle={skipStepTarget.title}
            onConfirm={onConfirmSkipStep}
            onClose={() => onSkipStepTargetChange(null)}
            isPending={isSkippingStep}
          />
        )}
      </Modal>
      <Modal open={showOffProtocolNote} onOpenChange={onShowOffProtocolNoteChange}>
        {showOffProtocolNote && activeUsage && (
          <OffProtocolNote
            onSave={onSaveOffProtocolNote}
            onCancel={() => onShowOffProtocolNoteChange(false)}
            isPending={isSavingOffProtocolNote}
          />
        )}
      </Modal>
    </>
  )
}
