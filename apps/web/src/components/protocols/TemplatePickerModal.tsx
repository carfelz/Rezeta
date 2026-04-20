import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalClose,
  Button,
} from '@/components/ui'
import { useProtocolTemplates } from '@/hooks/protocol-templates/use-protocol-templates'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { strings } from '@/lib/strings'
import { useNavigate } from 'react-router-dom'

interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TemplatePickerModal({ isOpen, onClose }: TemplatePickerModalProps): JSX.Element {
  const navigate = useNavigate()
  const { data: templates, isLoading } = useProtocolTemplates()
  const { useCreateProtocol } = useProtocols()
  const { mutate: createProtocol, isPending } = useCreateProtocol()

  const handlePick = (templateId?: string) => {
    createProtocol(
      { tags: [], ...(templateId ? { templateId } : {}) },
      {
        onSuccess: (protocol) => {
          onClose()
          void navigate(`/protocolos/${protocol.id}/edit`)
        },
      },
    )
  }

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="lg">
        <ModalHeader
          title={strings.TEMPLATE_PICKER_TITLE}
          subtitle={strings.TEMPLATE_PICKER_SUBTITLE}
        />

        <ModalBody>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <i className="ph ph-spinner animate-spin text-[24px] text-n-400" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* System templates */}
              {templates && templates.length > 0 && (
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.10em] text-n-400 mb-3">
                    {strings.TEMPLATE_PICKER_SYSTEM_LABEL}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handlePick(t.id)}
                        disabled={isPending}
                        className="flex items-start gap-4 p-4 border border-n-200 rounded hover:bg-n-25 hover:border-n-300 transition-colors duration-[100ms] text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        <div className="w-9 h-9 rounded bg-p-50 flex items-center justify-center text-p-700 shrink-0 group-hover:bg-p-100 transition-colors duration-[100ms]">
                          <i className={`ph ph-${t.icon || 'stack'} text-[18px]`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-sans font-semibold text-n-800 leading-snug">
                            {t.name}
                          </div>
                          {t.description && (
                            <div className="text-[12px] font-sans text-n-500 mt-0.5 leading-snug">
                              {t.description}
                            </div>
                          )}
                        </div>
                        <i className="ph ph-arrow-right text-n-400 mt-1 shrink-0 group-hover:text-n-700 transition-colors duration-[100ms]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Blank */}
              <button
                onClick={() => handlePick()}
                disabled={isPending}
                className="flex items-start gap-4 p-4 border border-dashed border-n-200 rounded hover:bg-n-25 hover:border-n-400 transition-colors duration-[100ms] text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="w-9 h-9 rounded bg-n-50 flex items-center justify-center text-n-500 shrink-0">
                  <i className="ph ph-file-text text-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-sans font-semibold text-n-700 leading-snug">
                    {strings.TEMPLATE_PICKER_BLANK_LABEL}
                  </div>
                  <div className="text-[12px] font-sans text-n-500 mt-0.5 leading-snug">
                    {strings.TEMPLATE_PICKER_BLANK_DESC}
                  </div>
                </div>
                <i className="ph ph-arrow-right text-n-400 mt-1 shrink-0 group-hover:text-n-700 transition-colors duration-[100ms]" />
              </button>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary" disabled={isPending}>
              {strings.TEMPLATE_PICKER_CANCEL}
            </Button>
          </ModalClose>
          {isPending && (
            <div className="flex items-center gap-2 text-[13px] font-sans text-n-500">
              <i className="ph ph-spinner animate-spin" />
              {strings.TEMPLATE_PICKER_CREATING}
            </div>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
