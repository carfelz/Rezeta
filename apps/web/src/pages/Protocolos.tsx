import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, EmptyState } from '@/components/ui'
import { TemplatePickerModal } from '@/components/protocols/TemplatePickerModal'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import type { ProtocolListFilters } from '@/hooks/protocols/use-protocols'
import { useProtocolTypes } from '@/hooks/protocol-types/use-protocol-types'
import { strings } from '@/lib/strings'
import type { ProtocolListItem } from '@rezeta/shared'

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Protocol row ──────────────────────────────────────────────────────────────

interface ProtocolRowProps {
  protocol: ProtocolListItem
  onClick: () => void
  onToggleFavorite: (id: string, current: boolean) => void
}

function ProtocolRow({ protocol, onClick, onToggleFavorite }: ProtocolRowProps): JSX.Element {
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

      {/* Favorite toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite(protocol.id, protocol.isFavorite)
        }}
        title={
          protocol.isFavorite ? strings.PROTOCOLS_FAVORITE_REMOVE : strings.PROTOCOLS_FAVORITE_ADD
        }
        className="w-7 h-7 flex items-center justify-center rounded text-n-300 hover:text-warning-text transition-colors duration-[100ms] shrink-0"
        aria-label={
          protocol.isFavorite ? strings.PROTOCOLS_FAVORITE_REMOVE : strings.PROTOCOLS_FAVORITE_ADD
        }
      >
        <i
          className={`${protocol.isFavorite ? 'ph-fill ph-star text-warning-text' : 'ph ph-star'} text-[15px]`}
        />
      </button>

      <i className="ph ph-arrow-right text-n-300 group-hover:text-n-600 transition-colors duration-[100ms] shrink-0" />
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS: Array<{ value: ProtocolListFilters['sort']; label: string }> = [
  { value: 'updatedAt_desc', label: strings.PROTOCOLS_SORT_UPDATED_DESC },
  { value: 'updatedAt_asc', label: strings.PROTOCOLS_SORT_UPDATED_ASC },
  { value: 'title_asc', label: strings.PROTOCOLS_SORT_TITLE_ASC },
  { value: 'title_desc', label: strings.PROTOCOLS_SORT_TITLE_DESC },
]

export function Protocolos(): JSX.Element {
  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState<string | undefined>(undefined)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<ProtocolListFilters['sort']>('updatedAt_desc')

  const filters: ProtocolListFilters = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(typeId ? { typeId } : {}),
    ...(favoritesOnly ? { favoritesOnly: true } : {}),
    ...(sort ? { sort } : {}),
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const { useGetProtocols } = useProtocols()
  const { data: protocols, isLoading, error } = useGetProtocols(filters)
  const { data: types } = useProtocolTypes()

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] font-serif font-medium text-n-900 leading-tight">
          {strings.PROTOCOLS_PAGE_TITLE}
        </h1>
        <Button variant="primary" onClick={() => setPickerOpen(true)}>
          <i className="ph ph-plus mr-1.5" />
          {strings.PROTOCOLS_NEW_BUTTON}
        </Button>
      </div>

      {/* ── Filters bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[320px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-n-400 pointer-events-none">
            <i className="ph ph-magnifying-glass text-[14px]" />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={strings.PROTOCOLS_SEARCH_PLACEHOLDER}
            className="w-full h-[32px] pl-8 pr-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)] transition-all duration-[100ms]"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeId(undefined)}
            className={`h-[28px] px-3 text-[12px] font-sans rounded-sm border transition-colors duration-[100ms] ${
              !typeId
                ? 'bg-p-500 border-p-500 text-white'
                : 'bg-n-0 border-n-300 text-n-600 hover:border-n-400 hover:text-n-800'
            }`}
          >
            {strings.PROTOCOLS_FILTER_ALL_TYPES}
          </button>
          {types?.map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeId(typeId === t.id ? undefined : t.id)}
              className={`h-[28px] px-3 text-[12px] font-sans rounded-sm border transition-colors duration-[100ms] ${
                typeId === t.id
                  ? 'bg-p-500 border-p-500 text-white'
                  : 'bg-n-0 border-n-300 text-n-600 hover:border-n-400 hover:text-n-800'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Favorites toggle */}
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            title={strings.PROTOCOLS_FILTER_FAVORITES}
            className={`h-[32px] px-3 text-[12px] font-sans rounded-sm border flex items-center gap-1.5 transition-colors duration-[100ms] ${
              favoritesOnly
                ? 'bg-warning-bg border-warning-border text-warning-text'
                : 'bg-n-0 border-n-300 text-n-600 hover:border-n-400 hover:text-n-800'
            }`}
          >
            <i className={`${favoritesOnly ? 'ph-fill ph-star' : 'ph ph-star'} text-[13px]`} />
            {strings.PROTOCOLS_FILTER_FAVORITES}
          </button>

          {/* Sort dropdown */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ProtocolListFilters['sort'])}
            className="h-[32px] px-2 pr-7 text-[12px] font-sans border border-n-300 rounded-sm bg-n-0 text-n-700 focus:outline-none focus:border-p-500 cursor-pointer transition-colors duration-[100ms]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
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
            <ProtocolRowWithFavorite
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
          title={
            search || typeId || favoritesOnly
              ? strings.PROTOCOLS_EMPTY_SEARCH
              : strings.PROTOCOLS_EMPTY_TITLE
          }
          {...(!(search || typeId || favoritesOnly)
            ? { description: strings.PROTOCOLS_EMPTY_DESCRIPTION }
            : {})}
          {...(!search && !typeId && !favoritesOnly
            ? {
                action: (
                  <Button variant="primary" onClick={() => setPickerOpen(true)}>
                    {strings.PROTOCOLS_EMPTY_CTA}
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

// ── Favorite-aware row (self-contained hook call) ─────────────────────────────

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
