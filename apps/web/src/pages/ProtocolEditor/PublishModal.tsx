import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
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
            <Input
              type="text"
              value={changeSummary}
              onChange={(e) => onChangeSummary(e.target.value)}
              placeholder={protocolEditorStrings.publishModalPlaceholder}
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
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
                <i className="ph ph-spinner animate-spin mr-2" />
                {protocolEditorStrings.saving}
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
