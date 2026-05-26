import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Caption,
  Field,
  Input,
  SelectableCard,
  Stack,
} from '@/components/ui'
import { useProtocolTypes } from '@/hooks/protocol-types/use-protocol-types'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { blockEditorStrings } from './strings'
interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ProtocolTypeInfo {
  id: string
  name: string
  templateName?: string
}

interface TypeCardProps {
  type: ProtocolTypeInfo
  selected: boolean
  onSelect: () => void
}

function TypeCard({ type, selected, onSelect }: TypeCardProps): JSX.Element {
  return (
    <SelectableCard
      density="large"
      state={selected ? 'selected' : 'default'}
      onClick={onSelect}
      className="flex-col items-start"
    >
      <span className="block text-[13.5px] font-semibold text-n-800 leading-snug">{type.name}</span>
      {type.templateName && (
        <Caption tone="muted" size="sm" as="span" className="block mt-1 truncate">
          {type.templateName}
        </Caption>
      )}
    </SelectableCard>
  )
}

export function TemplatePickerModal({ isOpen, onClose }: TemplatePickerModalProps): JSX.Element {
  const navigate = useNavigate()
  const { data: types, isLoading: typesLoading } = useProtocolTypes()
  const { useCreateProtocol } = useProtocols()
  const { mutate: createProtocol, isPending } = useCreateProtocol()

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [scratchMode, setScratchMode] = useState(false)
  const [title, setTitle] = useState('')

  const canSubmit = (!!selectedTypeId || scratchMode) && title.trim().length >= 2 && !isPending

  const handleClose = () => {
    setSelectedTypeId(null)
    setScratchMode(false)
    setTitle('')
    onClose()
  }

  const handleCreate = () => {
    if (!canSubmit) return
    const dto = { title: title.trim() }
    createProtocol(dto, {
      onSuccess: (data) => {
        handleClose()
        void navigate(`/protocolos/${data.id}/edit`)
      },
    })
  }

  const handleSelectType = (id: string) => {
    setSelectedTypeId(id)
    setScratchMode(false)
  }

  const handleSelectScratch = () => {
    setScratchMode(true)
    setSelectedTypeId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) handleCreate()
  }

  const hasNoTypes = !typesLoading && (!types || types.length === 0)

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalContent size="lg">
        <ModalHeader
          title={blockEditorStrings.typePickerTitle}
          subtitle={blockEditorStrings.typePickerSubtitle}
        />

        <ModalBody>
          {typesLoading ? (
            <div className="flex justify-center py-8">
              <i className="ph ph-spinner animate-spin text-[24px] text-n-400" />
            </div>
          ) : hasNoTypes ? (
            <Stack gap={3} align="center" className="py-8 text-center">
              <i className="ph ph-stack text-[32px] text-n-300" />
              <Caption tone="neutral" size="lg" as="p">
                {blockEditorStrings.typePickerNoTypes}
              </Caption>
              <Link
                to="/ajustes/tipos"
                onClick={handleClose}
                className="text-[13px] text-p-500 hover:text-p-700 transition-colors"
              >
                {blockEditorStrings.typePickerNoTypesCta} →
              </Link>
            </Stack>
          ) : (
            <Stack gap={5}>
              <div className="grid grid-cols-2 gap-2">
                {(types ?? []).map((type) => (
                  <TypeCard
                    key={type.id}
                    type={type}
                    selected={selectedTypeId === type.id}
                    onSelect={() => handleSelectType(type.id)}
                  />
                ))}
                <SelectableCard
                  density="large"
                  state={scratchMode ? 'selected' : 'default'}
                  onClick={handleSelectScratch}
                  className="flex-col items-start"
                >
                  <span className="block text-[13.5px] font-semibold text-n-800 leading-snug">
                    {blockEditorStrings.typePickerScratch}
                  </span>
                  <Caption tone="muted" size="sm" as="span" className="block mt-1">
                    {blockEditorStrings.typePickerScratchDescription}
                  </Caption>
                </SelectableCard>
              </div>
              <Field label={blockEditorStrings.typePickerNameLabel} required>
                <Input
                  placeholder={blockEditorStrings.typePickerNamePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus={false}
                  disabled={isPending}
                />
              </Field>
            </Stack>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>
            {blockEditorStrings.typePickerCancel}
          </Button>
          {!hasNoTypes && (
            <Button variant="primary" onClick={handleCreate} disabled={!canSubmit}>
              {isPending ? (
                <>
                  <i className="ph ph-spinner animate-spin mr-2" />
                  {blockEditorStrings.typePickerCreating}
                </>
              ) : (
                blockEditorStrings.typePickerSubmit
              )}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
