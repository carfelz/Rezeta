import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Field,
  Input,
} from '@/components/ui'
import { useProtocolTypes } from '@/hooks/protocol-types/use-protocol-types'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { strings } from '@/lib/strings'
import type { ProtocolTypeDto } from '@rezeta/shared'

interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
}

interface TypeCardProps {
  type: ProtocolTypeDto
  selected: boolean
  onSelect: () => void
}

function TypeCard({ type, selected, onSelect }: TypeCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'relative text-left w-full px-4 py-4 rounded border transition-all duration-[100ms] focus:outline-none focus:shadow-[0_0_0_2px_white,0_0_0_4px_#6A8B91]',
        selected ? 'border-p-500 bg-p-50' : 'border-n-200 bg-n-0 hover:border-n-300 hover:bg-n-25',
      ].join(' ')}
    >
      {/* Active teal rule */}
      {selected && (
        <span className="absolute left-0 top-3 bottom-3 w-[2px] bg-p-500 rounded-full" />
      )}
      <span className="block text-[13.5px] font-sans font-semibold text-n-800 leading-snug">
        {type.name}
      </span>
      {type.templateName && (
        <span className="block text-[11.5px] font-sans text-n-400 mt-1 truncate">
          {type.templateName}
        </span>
      )}
    </button>
  )
}

export function TemplatePickerModal({ isOpen, onClose }: TemplatePickerModalProps): JSX.Element {
  const navigate = useNavigate()
  const { data: types, isLoading: typesLoading } = useProtocolTypes()
  const { useCreateProtocol } = useProtocols()
  const { mutate: createProtocol, isPending } = useCreateProtocol()

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [title, setTitle] = useState('')

  const canSubmit = !!selectedTypeId && title.trim().length >= 2 && !isPending

  const handleClose = () => {
    setSelectedTypeId(null)
    setTitle('')
    onClose()
  }

  const handleCreate = () => {
    if (!canSubmit || !selectedTypeId) return
    createProtocol(
      { typeId: selectedTypeId, title: title.trim() },
      {
        onSuccess: (data) => {
          handleClose()
          void navigate(`/protocolos/${data.id}/edit`)
        },
      },
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) handleCreate()
  }

  const hasNoTypes = !typesLoading && (!types || types.length === 0)

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalContent size="lg">
        <ModalHeader title={strings.TYPE_PICKER_TITLE} subtitle={strings.TYPE_PICKER_SUBTITLE} />

        <ModalBody>
          {typesLoading ? (
            <div className="flex justify-center py-8">
              <i className="ph ph-spinner animate-spin text-[24px] text-n-400" />
            </div>
          ) : hasNoTypes ? (
            /* Empty state — no types exist */
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <i className="ph ph-stack text-[32px] text-n-300" />
              <p className="text-[13px] font-sans text-n-500">{strings.TYPE_PICKER_NO_TYPES}</p>
              <Link
                to="/ajustes/tipos"
                onClick={handleClose}
                className="text-[13px] font-sans text-p-500 hover:text-p-700 transition-colors duration-[100ms]"
              >
                {strings.TYPE_PICKER_NO_TYPES_CTA} →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Type grid */}
              <div className="grid grid-cols-2 gap-2">
                {(types ?? []).map((type) => (
                  <TypeCard
                    key={type.id}
                    type={type}
                    selected={selectedTypeId === type.id}
                    onSelect={() => setSelectedTypeId(type.id)}
                  />
                ))}
              </div>

              {/* Protocol name input */}
              <Field label={strings.TYPE_PICKER_NAME_LABEL} required>
                <Input
                  placeholder={strings.TYPE_PICKER_NAME_PLACEHOLDER}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus={false}
                  disabled={isPending}
                />
              </Field>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>
            {strings.TYPE_PICKER_CANCEL}
          </Button>
          {!hasNoTypes && (
            <Button variant="primary" onClick={handleCreate} disabled={!canSubmit}>
              {isPending ? (
                <>
                  <i className="ph ph-spinner animate-spin mr-2" />
                  {strings.TYPE_PICKER_CREATING}
                </>
              ) : (
                strings.TYPE_PICKER_SUBMIT
              )}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
