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
import { useProtocolCategories } from '@/hooks/protocol-categories/use-protocol-categories'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { blockEditorStrings } from './strings'
interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
}

interface CategoryCardProps {
  id: string
  name: string
  color: string
  selected: boolean
  onSelect: () => void
}

function CategoryCard({ name, color, selected, onSelect }: CategoryCardProps): JSX.Element {
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
          style={{ backgroundColor: color }}
        />
        <span className="block text-[13.5px] font-semibold text-n-800 leading-snug">{name}</span>
      </div>
    </SelectableCard>
  )
}

export function TemplatePickerModal({ isOpen, onClose }: TemplatePickerModalProps): JSX.Element {
  const navigate = useNavigate()
  const { data: categories, isLoading: categoriesLoading } = useProtocolCategories()
  const { useCreateProtocol } = useProtocols()
  const { mutate: createProtocol, isPending } = useCreateProtocol()

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [scratchMode, setScratchMode] = useState(false)
  const [title, setTitle] = useState('')

  const canSubmit = (!!selectedCategoryId || scratchMode) && title.trim().length >= 2 && !isPending

  const handleClose = () => {
    setSelectedCategoryId(null)
    setScratchMode(false)
    setTitle('')
    onClose()
  }

  const handleCreate = () => {
    if (!canSubmit) return
    const dto = {
      title: title.trim(),
      ...(selectedCategoryId !== null && { categoryId: selectedCategoryId }),
    }
    createProtocol(dto, {
      onSuccess: (data) => {
        handleClose()
        void navigate(`/protocolos/${data.id}/edit`)
      },
    })
  }

  const handleSelectCategory = (id: string) => {
    setSelectedCategoryId(id)
    setScratchMode(false)
  }

  const handleSelectScratch = () => {
    setScratchMode(true)
    setSelectedCategoryId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) handleCreate()
  }

  const hasNoCategories = !categoriesLoading && (!categories || categories.length === 0)

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalContent size="lg">
        <ModalHeader
          title={blockEditorStrings.typePickerTitle}
          subtitle={blockEditorStrings.typePickerSubtitle}
        />

        <ModalBody>
          {categoriesLoading ? (
            <div className="flex justify-center py-8">
              <i className="ph ph-spinner animate-spin text-[24px] text-n-400" />
            </div>
          ) : hasNoCategories ? (
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
                {(categories ?? []).map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    id={cat.id}
                    name={cat.name}
                    color={cat.color}
                    selected={selectedCategoryId === cat.id}
                    onSelect={() => handleSelectCategory(cat.id)}
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
          {!hasNoCategories && (
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
