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

export interface PublishModalProps {
  open: boolean
  changeSummary: string
  onChangeSummary: (v: string) => void
  onClose: () => void
  onConfirm: () => void
  isSaving: boolean
  nextPublishVersion: number
}

export function PublishModal({
  open,
  changeSummary,
  onChangeSummary,
  onClose,
  onConfirm,
  isSaving,
  nextPublishVersion,
}: PublishModalProps): JSX.Element {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalContent>
        <ModalHeader
          title={protocolEditorStrings.publishModalTitle}
          subtitle={protocolEditorStrings.publishModalSubtitle}
        />
        <ModalBody>
          <div className="flex flex-col gap-2">
            <label className="text-[12.5px] font-sans font-medium text-n-700">
              {protocolEditorStrings.publishModalLabel}
            </label>
            <Textarea
              rows={3}
              cols={3}
              className="w-auto resize-none"
              value={changeSummary}
              onChange={(e) => onChangeSummary(e.target.value)}
              placeholder={protocolEditorStrings.publishModalPlaceholder}
              autoFocus
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {protocolEditorStrings.publishModalCancel}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner className="mr-2" decorative size="sm" />
                {protocolEditorStrings.publishing}
              </>
            ) : (
              <>
                <i className="ph ph-check mr-2" />
                {protocolEditorStrings.publish(nextPublishVersion)}
              </>
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
