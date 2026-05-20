import { useNavigate } from 'react-router-dom'
import { Badge, Caption, TextLink } from '@/components/ui'
import type { ProtocolListItem } from '@rezeta/shared'
import { labelForProtocolStatus, statusToBadgeVariant } from './helpers'
import { dashboardStrings } from './strings'

export interface RecentProtocolsProps {
  protocols: ProtocolListItem[]
}

export function RecentProtocols({ protocols }: RecentProtocolsProps): JSX.Element {
  const navigate = useNavigate()
  const visible = protocols.slice(0, 3)

  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-5">
      <div className="flex items-center justify-between mb-[14px]">
        <h3 className="font-serif font-medium text-[18px] text-n-900 m-0 tracking-[-0.005em]">
          {dashboardStrings.recentProtocolsTitle}
        </h3>
        <TextLink tone="neutral" size="md" onClick={() => void navigate('/protocolos')}>
          {dashboardStrings.recentProtocolsViewAll}
        </TextLink>
      </div>
      {visible.length === 0 ? (
        <Caption tone="muted" size="lg" as="p" className="py-2 block">
          {dashboardStrings.recentProtocolsEmpty}
        </Caption>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((proto, idx) => (
            <button
              key={proto.id}
              type="button"
              onClick={() => void navigate(`/protocolos/${proto.id}`)}
              className={`flex items-center justify-between text-left hover:bg-n-25 -mx-1 px-1 py-1 rounded transition-colors ${
                idx < visible.length - 1 ? 'pb-[10px] border-b border-n-100' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-n-900 truncate">{proto.title}</div>
                <Caption tone="neutral" size="sm" as="div" className="mt-1">
                  {proto.currentVersionNumber !== null ? `v${proto.currentVersionNumber} · ` : ''}
                  {dashboardStrings.recentProtocolsUpdated}{' '}
                  {new Date(proto.updatedAt).toLocaleDateString('es-DO', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Caption>
              </div>
              <Badge variant={statusToBadgeVariant(proto.status)} showDot>
                {labelForProtocolStatus(proto.status)}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
