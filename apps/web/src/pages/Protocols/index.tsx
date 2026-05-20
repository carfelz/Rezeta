import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Caption,
  Chip,
  EmptyState,
  IconButton,
  Row,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { TemplatePickerModal } from '@/components/protocols/TemplatePickerModal'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import type { ProtocolListFilters } from '@/hooks/protocols/use-protocols'
import { useProtocolTypes } from '@/hooks/protocol-types/use-protocol-types'
import { protocolStatusLabel } from '@/lib/protocol-status'
import { protocolsStrings } from './strings'
import { cn } from '@/lib/utils'
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
  onToggleFavorite: (id: string, current: boolean) => void
}

function ProtocolRow({ protocol, onClick, onToggleFavorite }: ProtocolRowProps): JSX.Element {
  return (
    <Button
      variant="item"
      size="sm"
      onClick={onClick}
      className="flex items-center gap-4 w-full px-5 py-4 border-b border-n-100 text-left group"
    >
      <div className="w-[36px] h-[36px] rounded bg-n-50 flex items-center justify-center text-n-500 shrink-0 group-hover:bg-p-50 group-hover:text-p-700 transition-colors">
        <i className="ph ph-stack text-[16px]" />
      </div>

      <div className="flex-1 min-w-0">
        <Row gap={2}>
          <span className="text-[13.5px] font-semibold text-n-800 truncate">{protocol.title}</span>
          {protocol.typeName && (
            <Caption tone="muted" size="xs" className="font-mono truncate hidden sm:block">
              {protocol.typeName}
            </Caption>
          )}
        </Row>
        <Row gap={3} className="mt-1">
          <Badge variant={statusVariant(protocol.status)} showDot>
            {protocolStatusLabel(protocol.status)}
          </Badge>
          {protocol.currentVersionNumber !== null && (
            <Caption tone="muted" size="sm" className="font-mono">
              {protocolsStrings.listVersion(protocol.currentVersionNumber)}
            </Caption>
          )}
        </Row>
      </div>

      <Caption tone="muted" size="md" className="shrink-0 hidden md:block">
        <RelativeDate iso={protocol.updatedAt} />
      </Caption>

      <IconButton
        icon={protocol.isFavorite ? 'ph-fill ph-star' : 'ph ph-star'}
        aria-label={
          protocol.isFavorite ? protocolsStrings.favoriteRemove : protocolsStrings.favoriteAdd
        }
        tone="warning"
        size="md"
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite(protocol.id, protocol.isFavorite)
        }}
      />

      <i className="ph ph-arrow-right text-n-300 group-hover:text-n-600 transition-colors shrink-0" />
    </Button>
  )
}

const SORT_OPTIONS: Array<{ value: NonNullable<ProtocolListFilters['sort']>; label: string }> = [
  { value: 'updatedAt_desc', label: protocolsStrings.sortUpdatedDesc },
  { value: 'updatedAt_asc', label: protocolsStrings.sortUpdatedAsc },
  { value: 'title_asc', label: protocolsStrings.sortTitleAsc },
  { value: 'title_desc', label: protocolsStrings.sortTitleDesc },
]

export function Protocols(): JSX.Element {
  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState<string | undefined>(undefined)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<NonNullable<ProtocolListFilters['sort']>>('updatedAt_desc')

  const filters: ProtocolListFilters = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(typeId ? { typeId } : {}),
    ...(favoritesOnly ? { favoritesOnly: true } : {}),
    sort,
  }

  const { useGetProtocols } = useProtocols()
  const { data: protocols, isLoading, error } = useGetProtocols(filters)
  const { data: types } = useProtocolTypes()

  return (
    <div>
      <Row justify="between" align="center" className="mb-6">
        <h1 className="text-[28px] font-serif font-medium text-n-900 leading-tight">
          {protocolsStrings.pageTitle}
        </h1>
        <Button variant="primary" onClick={() => setPickerOpen(true)}>
          <i className="ph ph-plus mr-2" />
          {protocolsStrings.newButton}
        </Button>
      </Row>

      <Row gap={3} wrap className="mb-5">
        <div className="flex-1 min-w-[180px] max-w-[320px]">
          <SearchInput
            size="sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={protocolsStrings.searchPlaceholder}
          />
        </div>

        <Row gap={2} wrap>
          <FilterChip active={!typeId} onClick={() => setTypeId(undefined)}>
            {protocolsStrings.filterAllTypes}
          </FilterChip>
          {types?.map((t) => (
            <FilterChip
              key={t.id}
              active={typeId === t.id}
              onClick={() => setTypeId(typeId === t.id ? undefined : t.id)}
            >
              {t.name}
            </FilterChip>
          ))}
        </Row>

        <Row gap={2} className="ml-auto">
          <Button
            variant={favoritesOnly ? 'warning' : 'secondary'}
            size="sm"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            title={protocolsStrings.filterFavorites}
          >
            <i className={cn(favoritesOnly ? 'ph-fill ph-star' : 'ph ph-star', 'text-[13px]')} />
            {protocolsStrings.filterFavorites}
          </Button>

          <Select
            value={sort}
            onValueChange={(v) => setSort(v as NonNullable<ProtocolListFilters['sort']>)}
          >
            <SelectTrigger className="h-[32px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </Row>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <i className="ph ph-spinner animate-spin text-[32px] text-n-400" />
        </div>
      ) : error ? (
        <EmptyState
          icon={<i className="ph ph-warning-circle text-danger-solid" />}
          title={protocolsStrings.errorTitle}
          description={protocolsStrings.error}
          action={
            <Button variant="secondary" onClick={() => window.location.reload()}>
              {protocolsStrings.retryButton}
            </Button>
          }
        />
      ) : protocols && protocols.length > 0 ? (
        <div className="bg-n-0 border border-n-200 rounded overflow-hidden">
          {protocols.map((p) => (
            <ProtocolRowWithFavorite
              key={p.id}
              protocol={p}
              onClick={() => void navigate(`/protocolos/${p.id}`)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<i className="ph ph-stack" />}
          title={
            search || typeId || favoritesOnly
              ? protocolsStrings.emptySearch
              : protocolsStrings.emptyTitle
          }
          {...(!(search || typeId || favoritesOnly)
            ? { description: protocolsStrings.emptyDescription }
            : {})}
          {...(!search && !typeId && !favoritesOnly
            ? {
                action: (
                  <Button variant="primary" onClick={() => setPickerOpen(true)}>
                    {protocolsStrings.emptyCta}
                  </Button>
                ),
              }
            : {})}
        />
      )}

      <TemplatePickerModal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <Chip
      tone={active ? 'primarySolid' : 'neutral'}
      size="md"
      format="sentence"
      asButton
      onClick={onClick}
      className={cn(
        active ? 'bg-p-500 border-p-500 text-n-0 hover:bg-p-700' : 'hover:border-n-400',
        'h-[28px]',
      )}
    >
      {children}
    </Chip>
  )
}

function ProtocolRowWithFavorite({
  protocol,
  onClick,
}: {
  protocol: ProtocolListItem
  onClick: () => void
}): JSX.Element {
  const { useToggleFavorite } = useProtocols()
  const { mutate } = useToggleFavorite(protocol.id)

  return (
    <ProtocolRow
      protocol={protocol}
      onClick={onClick}
      onToggleFavorite={(_id, current) => mutate(!current)}
    />
  )
}
