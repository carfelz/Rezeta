/**
 * STUB — Slice A compile placeholder.
 *
 * This component will be rewritten in Slice 2+3 to use ProtocolTypes (not
 * ProtocolTemplates) as the user-facing category for protocol creation.
 * The old template-picker flow is incompatible with the new three-layer model
 * (ProtocolTemplate → ProtocolType → Protocol).
 */

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalClose, Button } from '@/components/ui'

interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TemplatePickerModal({ isOpen, onClose }: TemplatePickerModalProps): JSX.Element {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="lg">
        <ModalHeader
          title="Nuevo protocolo"
          subtitle="La selección de tipos estará disponible próximamente."
        />
        <ModalBody>
          <div className="flex items-center justify-center py-12 text-n-400">
            <i className="ph ph-spinner animate-spin text-[24px]" />
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </ModalClose>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
