import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ProtocolTemplateDto } from '@rezeta/shared'
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
  Spinner,
  Stack,
} from '@/components/ui'
import { useProtocolTemplates } from '@/hooks/protocol-templates/use-protocol-templates'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { blockEditorStrings } from './strings'

interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
}

interface TemplateCardProps {
  template: ProtocolTemplateDto
  selected: boolean
  onSelect: () => void
}

function TemplateCard({ template, selected, onSelect }: TemplateCardProps): JSX.Element {
  return (
    <SelectableCard
      density="large"
      state={selected ? 'selected' : 'default'}
      onClick={onSelect}
      className="flex-col items-start"
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: template.category.color }}
        />
        <span className="block text-sm font-semibold text-n-800 leading-snug">
          {template.name}
        </span>
      </div>
      <span className="block text-caption text-n-500 mt-1">{template.category.name}</span>
    </SelectableCard>
  )
}

export function TemplatePickerModal({ isOpen, onClose }: TemplatePickerModalProps): JSX.Element {
  const navigate = useNavigate()
  const { data: templates, isLoading: templatesLoading } = useProtocolTemplates()
  const { useCreateProtocol } = useProtocols()
  const { mutate: createProtocol, isPending } = useCreateProtocol()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [title, setTitle] = useState('')

  const canSubmit = !!selectedTemplateId && title.trim().length >= 2 && !isPending

  const handleClose = () => {
    setSelectedTemplateId(null)
    setTitle('')
    onClose()
  }

  const handleCreate = () => {
    if (!canSubmit || !selectedTemplateId) return
    const dto = { templateId: selectedTemplateId, title: title.trim() }
    createProtocol(dto, {
      onSuccess: (data) => {
        handleClose()
        void navigate(`/protocolos/${data.id}/edit`)
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) handleCreate()
  }

  const hasNoTemplates = !templatesLoading && (!templates || templates.length === 0)

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalContent size="lg">
        <ModalHeader
          title={blockEditorStrings.typePickerTitle}
          subtitle={blockEditorStrings.typePickerSubtitle}
        />

        <ModalBody>
          {templatesLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" className="text-n-400" />
            </div>
          ) : hasNoTemplates ? (
            <Stack gap={3} align="center" className="py-8 text-center">
              <i className="ph ph-stack text-h2 text-n-300" />
              <Caption tone="neutral" size="lg" as="p">
                {blockEditorStrings.templatePickerEmpty}
              </Caption>
              <Link
                to="/ajustes/plantillas/new"
                onClick={handleClose}
                className="text-sm text-p-500 hover:text-p-700 transition-colors"
              >
                {blockEditorStrings.templatePickerEmptyCta} →
              </Link>
            </Stack>
          ) : (
            <Stack gap={5}>
              <div className="grid grid-cols-2 gap-2">
                {(templates ?? []).map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    selected={selectedTemplateId === template.id}
                    onSelect={() => setSelectedTemplateId(template.id)}
                  />
                ))}
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
          {!hasNoTemplates && (
            <Button variant="primary" onClick={handleCreate} disabled={!canSubmit}>
              {isPending ? (
                <>
                  <Spinner className="mr-2" decorative size="sm" />
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
