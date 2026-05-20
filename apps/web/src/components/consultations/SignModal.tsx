import {
  Button,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@/components/ui'
import { useSignConsultation } from '@/hooks/consultations/use-consultations'
import { signModalStrings } from './strings'

export interface SignModalProps {
  consultationId: string
  onClose: () => void
}

export function SignModal({ consultationId, onClose }: SignModalProps): JSX.Element {
  const signMutation = useSignConsultation(consultationId)
  return (
    <ModalContent>
      <ModalHeader title={signModalStrings.title} subtitle={signModalStrings.subtitle} />
      <ModalBody>
        <div className="flex items-start gap-3 bg-warning-bg border border-warning-border rounded-md px-4 py-3">
          <i className="ph ph-warning text-[18px] text-warning-text shrink-0 mt-1" />
          <p className="text-[13px] text-warning-text leading-[1.45]">
            {signModalStrings.warningMessage}
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalClose asChild>
          <Button variant="secondary" onClick={onClose}>
            {signModalStrings.cancelButton}
          </Button>
        </ModalClose>
        <Button
          variant="primary"
          onClick={() => signMutation.mutate(undefined, { onSuccess: onClose })}
          disabled={signMutation.isPending}
        >
          {signMutation.isPending ? signModalStrings.signingButton : signModalStrings.signButton}
        </Button>
      </ModalFooter>
    </ModalContent>
  )
}
