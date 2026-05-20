import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import {
  Button,
  Caption,
  Modal,
  ModalContent,
  Row,
  SearchInput,
  SelectableCard,
} from '@/components/ui'
import type { ProtocolListItem } from '@rezeta/shared'
import { protocolPickerModalStrings } from './strings'

interface ProtocolPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (protocol: ProtocolListItem) => void
  /** Optional protocol IDs to exclude from the picker (e.g. already attached). */
  excludeIds?: string[]
  isPending?: boolean
}

export function ProtocolPickerModal({
  open,
  onOpenChange,
  onSelect,
  excludeIds = [],
  isPending = false,
}: ProtocolPickerModalProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { useGetProtocols } = useProtocols()
  const { data: protocols = [], isLoading } = useGetProtocols({ status: 'active' })

  const visible = excludeIds.length
    ? protocols.filter((p) => !excludeIds.includes(p.id))
    : protocols
  const filtered = search.trim()
    ? visible.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : visible

  const selectedProtocol = filtered.find((p) => p.id === selectedId) ?? null

  function handleConfirm(): void {
    if (!selectedProtocol) return
    onSelect(selectedProtocol)
    onOpenChange(false)
    setSelectedId(null)
    setSearch('')
  }

  function handleOpenChange(next: boolean): void {
    if (!next) {
      setSelectedId(null)
      setSearch('')
    }
    onOpenChange(next)
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent>
        <div className="px-6 pt-6 pb-3 border-b border-n-200">
          <Dialog.Title className="text-h3 text-n-800 mb-1">
            {protocolPickerModalStrings.title}
          </Dialog.Title>
          <Dialog.Description className="text-[13px] text-n-500">
            {protocolPickerModalStrings.description}
          </Dialog.Description>
          <div className="mt-4">
            <SearchInput
              size="sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={protocolPickerModalStrings.searchPlaceholder}
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[320px]">
          {isLoading && (
            <Caption tone="muted" size="lg" as="div" className="text-center py-12">
              {protocolPickerModalStrings.loading}
            </Caption>
          )}
          {!isLoading && filtered.length === 0 && (
            <Caption tone="muted" size="lg" as="div" className="text-center py-12">
              {protocolPickerModalStrings.noResults}
            </Caption>
          )}
          {!isLoading &&
            filtered.map((protocol) => {
              const selected = protocol.id === selectedId
              return (
                <SelectableCard
                  key={protocol.id}
                  density="standard"
                  state={selected ? 'selected' : 'default'}
                  onClick={() => setSelectedId(selected ? null : protocol.id)}
                  className="border-x-0 border-t-0 rounded-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-n-800 truncate">
                      {protocol.title}
                    </div>
                    <Caption tone="neutral" size="md" as="div" className="mt-1">
                      {protocol.typeName}
                    </Caption>
                  </div>
                  {protocol.isFavorite && (
                    <i className="ph-fill ph-star text-warning-text text-[14px] shrink-0" />
                  )}
                </SelectableCard>
              )
            })}
        </div>

        <Row gap={3} justify="end" className="px-6 py-4 border-t border-n-200">
          <Button variant="secondary" size="md" onClick={() => handleOpenChange(false)}>
            {protocolPickerModalStrings.cancelButton}
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={!selectedProtocol || isPending}
            onClick={handleConfirm}
          >
            {isPending
              ? protocolPickerModalStrings.applyingButton
              : protocolPickerModalStrings.applyButton}
          </Button>
        </Row>
      </ModalContent>
    </Modal>
  )
}
