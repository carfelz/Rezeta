import {
  Button,
  Textarea,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@/components/ui'
import { protocolEditorStrings } from './strings'

export interface SaveModalProps {
  open: boolean
  changeSummary: string
  onChangeSummary: (v: string) => void
  onClose: () => void
  onSaveDraft: () => void
  onPublish: () => void
  isSaving: boolean
}

export function SaveModal({
  open,
  changeSummary,
  onChangeSummary,
  onClose,
  onSaveDraft,
  onPublish,
  isSaving,
}: SaveModalProps): JSX.Element {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalContent className="w-auto">
        <ModalHeader
          title={protocolEditorStrings.saveModalTitle}
          subtitle={protocolEditorStrings.saveModalSubtitle}
        />
        <ModalBody>
          <div className="flex flex-col gap-2">
            <label className="text-[12.5px] font-sans font-medium text-n-700">
              {protocolEditorStrings.saveModalLabel}
            </label>
            <Textarea
              rows={3}
              cols={3}
              className="w-auto resize-none"
              value={changeSummary}
              onChange={(e) => onChangeSummary(e.target.value)}
              placeholder={protocolEditorStrings.saveModalPlaceholder}
              autoFocus
              disabled={isSaving}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {protocolEditorStrings.saveModalCancel}
          </Button>
          <Button variant="secondary" onClick={onSaveDraft} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner className="mr-2" decorative size="sm" />
                {protocolEditorStrings.saving}
              </>
            ) : (
              protocolEditorStrings.saveModalSaveDraft
            )}
          </Button>
          <Button variant="primary" onClick={onPublish} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner className="mr-2" decorative size="sm" />
                {protocolEditorStrings.saving}
              </>
            ) : (
              <>
                <i className="ph ph-check mr-2" />
                {protocolEditorStrings.saveModalPublish}
              </>
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
