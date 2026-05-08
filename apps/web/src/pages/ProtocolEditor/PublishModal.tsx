import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui'
import { strings } from '@/lib/strings'

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
          title={strings.EDITOR_PUBLISH_MODAL_TITLE}
          subtitle={strings.EDITOR_PUBLISH_MODAL_SUBTITLE}
        />
        <ModalBody>
          <div className="flex flex-col gap-2">
            <label className="text-[12.5px] font-sans font-medium text-n-700">
              {strings.EDITOR_PUBLISH_MODAL_LABEL}
            </label>
            <input
              type="text"
              value={changeSummary}
              onChange={(e) => onChangeSummary(e.target.value)}
              placeholder={strings.EDITOR_PUBLISH_MODAL_PLACEHOLDER}
              className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)] transition-all duration-[100ms]"
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
              autoFocus
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {strings.EDITOR_PUBLISH_MODAL_CANCEL}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? (
              <>
                <i className="ph ph-spinner animate-spin mr-2" />
                {strings.EDITOR_SAVING}
              </>
            ) : (
              <>
                <i className="ph ph-check mr-2" />
                {strings.EDITOR_PUBLICAR(nextPublishVersion)}
              </>
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
