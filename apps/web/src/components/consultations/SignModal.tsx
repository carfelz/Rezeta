import { useState } from 'react'
import {
  Button,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@/components/ui'
import { useSignConsultation } from '@/hooks/consultations/use-consultations'
import type { SignConsultationResponse } from '@rezeta/shared'
import { signModalStrings } from './strings'

export interface SignModalProps {
  consultationId: string
  /**
   * Persists any locally-buffered protocol modifications before the sign
   * request fires. Resolving false aborts the sign so an immutable record is
   * never created from partially-saved content.
   */
  onBeforeSign?: (() => Promise<boolean>) | undefined
  onClose: () => void
  /** Fires with the sign response (incl. invoice outcome) once signing succeeds. */
  onSigned?: ((result: SignConsultationResponse) => void) | undefined
}

export function SignModal({
  consultationId,
  onBeforeSign,
  onClose,
  onSigned,
}: SignModalProps): JSX.Element {
  const signMutation = useSignConsultation(consultationId)
  // `onBeforeSign` (persist buffered modifications + flush the order queue) can
  // take seconds and its network calls each carry a multi-second budget. Track
  // that window explicitly so the confirm button is disabled the moment it
  // starts — a double-click during it would spawn a second flush that
  // re-snapshots the same queue and persists duplicate orders.
  const [preparing, setPreparing] = useState(false)
  const busy = preparing || signMutation.isPending
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
          onClick={() => {
            void (async () => {
              setPreparing(true)
              try {
                if (onBeforeSign && !(await onBeforeSign())) return
                signMutation.mutate(undefined, {
                  onSuccess: (result) => {
                    onSigned?.(result)
                    onClose()
                  },
                })
              } finally {
                setPreparing(false)
              }
            })()
          }}
          disabled={busy}
        >
          {busy ? signModalStrings.signingButton : signModalStrings.signButton}
        </Button>
      </ModalFooter>
    </ModalContent>
  )
}
