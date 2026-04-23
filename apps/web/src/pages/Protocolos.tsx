import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState } from '@/components/ui'
import { TemplatePickerModal } from '@/components/protocols/TemplatePickerModal'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { strings } from '@/lib/strings'
import type { ProtocolListItem } from '@rezeta/shared'

function statusVariant(status: string): 'draft' | 'active' | 'archived' {
  if (status === 'active') return 'active'
  if (status === 'archived') return 'archived'
  return 'draft'
}

function RelativeDate({ iso }: { iso: string }): JSX.Element {
  const date = new Date(iso)
  const formatted = date.toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return <>{formatted}</>
}

interface ProtocolRowProps {
  protocol: ProtocolListItem
  onClick: () => void
}

function ProtocolRow({ protocol, onClick }: ProtocolRowProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 w-full px-5 py-3.5 bg-n-0 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms] text-left group"
    >
      {/* Icon */}
      <div className="w-9 h-9 rounded bg-n-50 flex items-center justify-center text-n-500 shrink-0 group-hover:bg-p-50 group-hover:text-p-700 transition-colors duration-[100ms]">
        <i className="ph ph-stack text-[16px]" />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-sans font-semibold text-n-800 truncate">
            {protocol.title}
          </span>
          {protocol.typeName && (
            <span className="text-[11px] font-mono text-n-400 truncate hidden sm:block">
              {protocol.typeName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <Badge variant={statusVariant(protocol.status)} showDot>
            {protocol.status === 'draft' ? strings.EDITOR_STATUS_DRAFT : protocol.status}
          </Badge>
          {protocol.currentVersionNumber !== null && (
            <span className="text-[11.5px] font-mono text-n-400">
              {strings.PROTOCOLS_LIST_VERSION(protocol.currentVersionNumber)}
            </span>
          )}
        </div>
      </div>

      {/* Updated at */}
      <span className="text-[12px] font-sans text-n-400 shrink-0 hidden md:block">
        <RelativeDate iso={protocol.updatedAt} />
      </span>

      <i className="ph ph-arrow-right text-n-300 group-hover:text-n-600 transition-colors duration-[100ms] shrink-0" />
    </button>
  )
}

export function Protocolos(): JSX.Element {
  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)
  const { useGetProtocols } = useProtocols()
  const { data: protocols, isLoading, error } = useGetProtocols()

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[28px] font-serif font-medium text-n-900 leading-tight">
          {strings.PROTOCOLS_PAGE_TITLE}
        </h1>
        <Button variant="primary" onClick={() => setPickerOpen(true)}>
          <i className="ph ph-plus mr-1.5" />
          {strings.PROTOCOLS_NEW_BUTTON}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <i className="ph ph-spinner animate-spin text-[32px] text-n-400" />
        </div>
      ) : error ? (
        <EmptyState
          icon={<i className="ph ph-warning-circle text-danger-solid" />}
          title="Error al cargar protocolos"
          description={strings.PROTOCOLS_ERROR}
          action={
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          }
        />
      ) : protocols && protocols.length > 0 ? (
        <div className="bg-n-0 border border-n-200 rounded overflow-hidden">
          {protocols.map((p) => (
            <ProtocolRow
              key={p.id}
              protocol={p}
              onClick={() => {
                void navigate(`/protocolos/${p.id}`)
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<i className="ph ph-stack" />}
          title={strings.PROTOCOLS_EMPTY_TITLE}
          description={strings.PROTOCOLS_EMPTY_DESCRIPTION}
          action={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              {strings.PROTOCOLS_EMPTY_CTA}
            </Button>
          }
        />
      )}

      <TemplatePickerModal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  )
}
