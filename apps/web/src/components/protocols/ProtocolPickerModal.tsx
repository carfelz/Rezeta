import { useState } from 'react'
import { Modal, ModalContent } from '@/components/ui/Modal'
import * as Dialog from '@radix-ui/react-dialog'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { cn } from '@/lib/utils'
import type { ProtocolListItem } from '@rezeta/shared'

interface ProtocolPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (protocol: ProtocolListItem) => void
}

export function ProtocolPickerModal({
  open,
  onOpenChange,
  onSelect,
}: ProtocolPickerModalProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { useGetProtocols } = useProtocols()
  const { data: protocols = [], isLoading } = useGetProtocols({ status: 'active' })

  const filtered = search.trim()
    ? protocols.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : protocols

  const selectedProtocol = filtered.find((p) => p.id === selectedId) ?? null

  function handleConfirm() {
    if (!selectedProtocol) return
    onSelect(selectedProtocol)
    onOpenChange(false)
    setSelectedId(null)
    setSearch('')
  }

  function handleOpenChange(next: boolean) {
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
          <Dialog.Title className="text-h3 text-n-800 mb-1">Seleccionar protocolo</Dialog.Title>
          <Dialog.Description className="text-[13px] font-sans text-n-500">
            Elige un protocolo para aplicarlo en esta consulta.
          </Dialog.Description>
          <div className="relative mt-4">
            <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-n-400 text-[15px]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar protocolo…"
              className="w-full pl-9 pr-3 h-[34px] text-[13px] font-sans border border-n-300 rounded-sm bg-n-0 text-n-800 placeholder-n-400 focus:outline-none focus:border-p-500"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[320px]">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-[13px] font-sans text-n-400">
              Cargando protocolos…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="flex items-center justify-center py-12 text-[13px] font-sans text-n-400">
              No se encontraron protocolos.
            </div>
          )}
          {!isLoading &&
            filtered.map((protocol) => {
              const selected = protocol.id === selectedId
              return (
                <button
                  key={protocol.id}
                  type="button"
                  onClick={() => setSelectedId(selected ? null : protocol.id)}
                  className={cn(
                    'relative w-full flex items-center gap-3 px-5 py-3 border-b border-n-100 text-left transition-colors',
                    selected
                      ? 'bg-p-50 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-p-500'
                      : 'bg-n-0 hover:bg-n-25',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-sans font-semibold text-n-800 truncate">
                      {protocol.title}
                    </div>
                    <div className="text-[12px] font-sans text-n-500 mt-1">{protocol.typeName}</div>
                  </div>
                  {protocol.isFavorite && (
                    <i className="ph-fill ph-star text-warning-text text-[14px] shrink-0" />
                  )}
                </button>
              )
            })}
        </div>

        <div className="px-6 py-4 border-t border-n-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="h-8 px-4 text-[13px] font-sans font-medium text-n-700 border border-n-200 rounded-sm bg-n-0 hover:bg-n-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedProtocol}
            className="h-8 px-4 text-[13px] font-sans font-medium text-white bg-p-500 rounded-sm hover:bg-p-700 disabled:bg-n-200 disabled:text-n-400 disabled:cursor-not-allowed transition-colors"
          >
            Aplicar protocolo
          </button>
        </div>
      </ModalContent>
    </Modal>
  )
}
