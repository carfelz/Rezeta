import { useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalClose,
  Button,
  Field,
  Input,
} from '@/components/ui'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import type { ProtocolTemplateDto } from '@rezeta/shared'

interface CreateProtocolDialogProps {
  template: ProtocolTemplateDto | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (id: string) => void
}

export function CreateProtocolDialog({
  template,
  isOpen,
  onClose,
  onSuccess,
}: CreateProtocolDialogProps) {
  const [title, setTitle] = useState('')
  const { useCreateProtocol } = useProtocols()
  const { mutate, isPending } = useCreateProtocol()

  const handleCreate = () => {
    if (!title.trim()) return

    mutate(
      {
        title,
        tags: [],
        templateId: template?.id,
        specialty: template?.suggestedSpecialty,
      },
      {
        onSuccess: (data) => {
          onClose()
          setTitle('')
          onSuccess(data.id)
        },
      }
    )
  }

  if (!template && isOpen) return null

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="sm:max-w-[480px]">
        <ModalHeader
          title="Crear nuevo protocolo"
          {...(template
            ? { subtitle: `Personaliza el nombre de tu protocolo basado en ${template.name}.` }
            : {})}
        />

        <ModalBody className="py-6">
          <Field label="Nombre del protocolo" required>
            <Input
              placeholder="Ej. Mi Protocolo de Anafilaxia"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </Field>
        </ModalBody>

        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary" disabled={isPending}>
              Cancelar
            </Button>
          </ModalClose>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!title.trim() || isPending}
          >
            {isPending ? (
              <>
                <i className="ph ph-spinner animate-spin mr-2" />
                Creando...
              </>
            ) : (
              'Crear protocolo'
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
