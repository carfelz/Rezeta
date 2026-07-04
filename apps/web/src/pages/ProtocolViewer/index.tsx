import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Spinner } from '@/components/ui'
import { ProtocolContainer } from '@/components/ui/ProtocolBlock'
import { BlockRenderer } from '@/components/protocols/BlockRenderer'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'
import { SuggestionBanner } from '@/components/protocols/SuggestionBanner'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { protocolStatusLabel } from '@/lib/protocol-status'
import { protocolViewerStrings } from './strings'

function statusVariant(status: string): 'draft' | 'active' | 'archived' {
  if (status === 'active') return 'active'
  if (status === 'archived') return 'archived'
  return 'draft'
}

export function ProtocolViewer(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { useGetProtocol } = useProtocols()
  const { data: protocol, isLoading, error } = useGetProtocol(id ?? '')

  if (!id) {
    void navigate('/protocolos', { replace: true })
    return <></>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[256px]">
        <Spinner size="lg" className="text-n-400" />
      </div>
    )
  }

  if (error || !protocol) {
    return (
      <div className="flex flex-col items-center justify-center h-[256px] gap-4">
        <p className="text-[14px] font-sans text-n-600">{protocolViewerStrings.notFound}</p>
        <Link to="/protocolos" className="text-[13px] font-sans text-p-500 hover:text-p-700">
          ← {protocolViewerStrings.back}
        </Link>
      </div>
    )
  }

  const blocks = (protocol.currentVersion?.content?.blocks ?? []) as ProtocolBlock[]
  const versionNumber = protocol.currentVersion?.versionNumber ?? 1

  const updatedDate = new Date(protocol.updatedAt).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="max-w-[800px] m-auto">
      {/* Back nav */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/protocolos"
          className="flex items-center gap-2 text-[12.5px] font-sans text-n-500 hover:text-n-800 transition-colors duration-[100ms]"
        >
          <i className="ph ph-arrow-left text-[14px]" />
          {protocolViewerStrings.back}
        </Link>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigate(`/protocolos/${id}/edit`)
          }}
        >
          <i className="ph ph-pencil-simple mr-2 text-[14px]" />
          {protocolViewerStrings.editButton}
        </Button>
      </div>

      <SuggestionBanner protocolId={id} />

      <ProtocolContainer
        {...(protocol.categoryName ? { kicker: protocol.categoryName } : {})}
        title={protocol.title}
        meta={`${protocolViewerStrings.updated} ${updatedDate} · ${protocolViewerStrings.version(versionNumber)}`}
        badge={
          <Badge variant={statusVariant(protocol.status)} showDot>
            {protocolStatusLabel(protocol.status)}
          </Badge>
        }
      >
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2 text-center">
            <i className="ph ph-file-text text-[32px] text-n-300" />
            <p className="text-[13px] font-sans text-n-400">{protocolViewerStrings.noContent}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-4">
            {blocks.map((block) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
          </div>
        )}
      </ProtocolContainer>
    </div>
  )
}
