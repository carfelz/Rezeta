import {
  Button,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@/components/ui'
import { useSignConsultation } from '@/hooks/consultations/use-consultations'

export interface SignModalProps {
  consultationId: string
  onClose: () => void
}

export function SignModal({ consultationId, onClose }: SignModalProps): JSX.Element {
  const signMutation = useSignConsultation(consultationId)
  return (
    <ModalContent>
      <ModalHeader
        title="Firmar consulta"
        subtitle="Al firmar, la consulta quedará bloqueada. Solo podrá editarse mediante enmiendas."
      />
      <ModalBody>
        <div className="flex items-start gap-3 bg-warning-bg border border-warning-border rounded-md px-4 py-3">
          <i className="ph ph-warning text-[18px] text-warning-text shrink-0 mt-1" />
          <p className="text-[13px] text-warning-text leading-[1.45]">
            Esta acción es irreversible. Verifica que todos los datos sean correctos antes de
            continuar.
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalClose asChild>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </ModalClose>
        <Button
          variant="primary"
          onClick={() => signMutation.mutate(undefined, { onSuccess: onClose })}
          disabled={signMutation.isPending}
        >
          {signMutation.isPending ? 'Firmando…' : 'Firmar y cerrar'}
        </Button>
      </ModalFooter>
    </ModalContent>
  )
}
