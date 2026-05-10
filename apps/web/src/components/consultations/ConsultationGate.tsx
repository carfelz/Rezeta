import { useMemo, useState } from 'react'
import { useProtocolSuggestions } from '@/hooks/consultations/use-protocol-suggestions'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import {
  Button,
  Caption,
  Chip,
  DashedButton,
  Overline,
  SearchInput,
  SelectableCard,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ProtocolRecommendation } from '@rezeta/shared'

export interface ConsultationGateProps {
  patientId: string
  patientFirstName?: string
  locationId: string
  onSelect: (protocolId: string | null) => void
  isCreating: boolean
  /** When true, all selection actions are blocked (e.g. patient/location not yet picked). */
  disabled?: boolean
}

const TYPE_ICON_MAP: Record<string, string> = {
  cardiovascular: 'ph-heart',
  cardiología: 'ph-heart',
  endocrinología: 'ph-pulse',
  endocrinologia: 'ph-pulse',
  respiratorio: 'ph-lungs',
  neumología: 'ph-lungs',
  'salud mental': 'ph-brain',
  psiquiatría: 'ph-brain',
  pediatría: 'ph-baby',
  pediatria: 'ph-baby',
  urgencias: 'ph-first-aid',
  emergencia: 'ph-first-aid',
  diagnóstico: 'ph-stethoscope',
  procedimiento: 'ph-syringe',
  medicación: 'ph-pill',
  fisioterapia: 'ph-person-simple',
}

function iconForType(typeName: string): string {
  return TYPE_ICON_MAP[typeName.toLowerCase()] ?? 'ph-stack'
}

export function ConsultationGate({
  patientId,
  patientFirstName,
  locationId,
  onSelect,
  isCreating,
  disabled = false,
}: ConsultationGateProps): JSX.Element {
  const blocked = isCreating || disabled
  const [search, setSearch] = useState('')

  const { suggestions, isLoading: loadingSuggestions } = useProtocolSuggestions(patientId, true)
  const { useGetProtocols } = useProtocols()
  const { data: allProtocols = [], isLoading: loadingAll } = useGetProtocols({
    status: 'active',
    sort: 'title_asc',
  })

  void locationId

  const recent = suggestions.slice(0, 3)
  const recentEmpty = !loadingSuggestions && recent.length === 0

  // Empty/draft protocols are filtered from suggestion buckets — they shouldn't
  // be offered as starting points — but they remain searchable by name below.
  const populatedProtocols = useMemo(
    () => allProtocols.filter((p) => p.blockCount > 0),
    [allProtocols],
  )
  const emptyProtocolCount = allProtocols.length - populatedProtocols.length

  const buckets = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of populatedProtocols) {
      map.set(p.typeName, (map.get(p.typeName) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [populatedProtocols])

  const searchResults = useMemo(() => {
    if (search.trim().length < 2) return []
    const q = search.toLowerCase()
    return allProtocols.filter(
      (p) => p.title.toLowerCase().includes(q) || p.typeName.toLowerCase().includes(q),
    )
  }, [search, allProtocols])

  const showSearchResults = search.trim().length >= 2

  return (
    <div className="max-w-[880px] mx-auto pt-8">
      <Overline tone="neutral" size="md" className="mb-2">
        Paso 1 de 2 · ¿Qué traes hoy?
      </Overline>

      <h2 className="font-serif font-medium text-[26px] text-n-900 leading-tight tracking-[-0.01em] mb-2">
        Comencemos con el motivo
      </h2>

      <Caption tone="neutral" size="lg" as="p" className="max-w-[580px] mb-6 block">
        {allProtocols.length === 0
          ? 'Todavía no tienes protocolos en tu biblioteca. Puedes iniciar la consulta sin guía o instalar uno desde la biblioteca de plantillas.'
          : 'Elige un motivo o protocolo. La consulta se abrirá pre-armada y los campos SOAP se llenarán automáticamente. Tarda 2 segundos.'}
      </Caption>

      {!loadingAll && allProtocols.length === 0 && <EmptyProtocolsCard />}

      {allProtocols.length > 0 && !recentEmpty && (
        <div className="mb-6">
          <Overline tone="neutral" size="sm" className="mb-3">
            {patientFirstName ? `Para ${patientFirstName} · ` : ''}sus consultas anteriores
          </Overline>
          {loadingSuggestions ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[88px] bg-n-50 border border-n-200 rounded-md animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {recent.map((p) => (
                <RecentProtocolCard
                  key={p.protocolId}
                  protocol={p}
                  primary={p.isMostProbable}
                  isCreating={blocked}
                  onSelect={() => onSelect(p.protocolId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className={cn('mb-5', allProtocols.length === 0 && 'hidden')}>
        <Overline tone="neutral" size="sm" className="mb-3">
          O elige otro protocolo
        </Overline>

        <div className="mb-3">
          <SearchInput
            placeholder={`Buscar entre tus ${allProtocols.length} protocolos…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {emptyProtocolCount > 0 && (
            <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-n-400 mt-2">
              + {emptyProtocolCount} protocolo{emptyProtocolCount === 1 ? '' : 's'} en borrador no
              se sugieren. Búscalos por nombre.
            </p>
          )}
        </div>

        {showSearchResults ? (
          <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto bg-n-0 border border-n-200 rounded-md">
            {searchResults.length === 0 ? (
              <Caption tone="muted" size="lg" as="p" className="text-center py-4 block">
                Sin resultados.
              </Caption>
            ) : (
              searchResults.map((p) => (
                <SelectableCard
                  key={p.id}
                  density="compact"
                  disabled={blocked}
                  onClick={() => onSelect(p.id)}
                >
                  <i
                    className={cn('ph text-[14px] text-n-500 shrink-0', iconForType(p.typeName))}
                  />
                  <span className="text-[13px] text-n-800 flex-1 truncate">{p.title}</span>
                  <span className="font-mono text-[11px] text-n-400">{p.typeName}</span>
                </SelectableCard>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {loadingAll ? (
              [0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-[44px] bg-n-50 border border-n-200 rounded animate-pulse"
                />
              ))
            ) : buckets.length === 0 ? (
              <Caption tone="muted" size="lg" as="div" className="col-span-2 text-center py-6">
                No hay protocolos activos.
              </Caption>
            ) : (
              buckets.map((b) => (
                <SelectableCard
                  key={b.name}
                  density="compact"
                  disabled={blocked}
                  onClick={() => setSearch(b.name)}
                >
                  <i className={cn('ph text-[14px] text-n-500', iconForType(b.name))} />
                  <span className="text-[12.5px] text-n-700 flex-1">{b.name}</span>
                  <span className="font-mono text-[11px] text-n-400">{b.count}</span>
                </SelectableCard>
              ))
            )}
          </div>
        )}
      </div>

      <DashedButton
        tone="neutral"
        size="md"
        disabled={blocked}
        onClick={() => onSelect(null)}
        className="!justify-between !gap-3 !px-4"
      >
        <span className="flex items-center gap-3">
          <i className="ph ph-arrow-bend-up-right text-[16px] text-n-400" />
          <span className="text-left">
            <span className="text-[12.5px] text-n-700 block">¿No encaja ningún protocolo?</span>
            <Caption tone="neutral" size="sm" as="span">
              Abre la consulta en blanco. Podrás añadir protocolo después.
            </Caption>
          </span>
        </span>
        <span className="text-[12px] text-n-700 px-3 py-1 bg-n-0 border border-n-200 rounded-sm">
          {isCreating ? 'Creando…' : 'Continuar sin protocolo'}
        </span>
      </DashedButton>
    </div>
  )
}

function RecentProtocolCard({
  protocol,
  primary,
  isCreating,
  onSelect,
}: {
  protocol: ProtocolRecommendation
  primary: boolean
  isCreating: boolean
  onSelect: () => void
}): JSX.Element {
  return (
    <SelectableCard
      density="large"
      state={primary ? 'primary' : 'default'}
      disabled={isCreating}
      onClick={onSelect}
      className="flex-col items-start"
    >
      {primary && (
        <div className="absolute top-2 right-2">
          <Chip tone="primarySolid" size="xs">
            Más probable
          </Chip>
        </div>
      )}
      <i
        className={cn(
          'ph text-[20px]',
          iconForType(protocol.typeName),
          primary ? 'text-p-500' : 'text-n-500',
        )}
      />
      <div className="text-[13.5px] font-medium text-n-900 mt-2 leading-tight">
        {protocol.title}
      </div>
      <Caption tone="neutral" size="sm" as="div" className="mt-1">
        {formatRecentSubtitle(protocol)}
      </Caption>
    </SelectableCard>
  )
}

function formatRecentSubtitle(protocol: ProtocolRecommendation): string {
  const versionLabel =
    protocol.currentVersionNumber != null ? ` · v${protocol.currentVersionNumber}` : ''
  if (!protocol.lastUsedAt || protocol.usageCount === 0) {
    return `Sin uso previo${versionLabel}`
  }
  const last = new Date(protocol.lastUsedAt)
  const monthsAgo = Math.floor((Date.now() - last.getTime()) / (30 * 24 * 60 * 60 * 1000))
  const ago =
    monthsAgo < 1 ? 'reciente' : monthsAgo === 1 ? 'hace 1 mes' : `hace ${monthsAgo} meses`
  return `Última: ${ago}${versionLabel}`
}

function EmptyProtocolsCard(): JSX.Element {
  return (
    <div className="mb-5 px-6 py-10 border border-dashed border-n-200 rounded-md text-center">
      <div className="w-14 h-14 rounded-full bg-n-50 mx-auto mb-4" />
      <h3 className="font-serif font-medium text-[18px] text-n-900 mb-2">
        Sin protocolos configurados
      </h3>
      <Caption
        tone="neutral"
        size="lg"
        as="p"
        className="max-w-[420px] mx-auto leading-snug mb-4 block"
      >
        Los protocolos guían tus consultas paso a paso y aceleran la documentación.
      </Caption>
      <div className="flex items-center justify-center gap-2">
        <Button asChild variant="primary" size="sm">
          <a href="/protocolos">Explorar biblioteca de protocolos</a>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <a href="/protocolos">Crear protocolo nuevo</a>
        </Button>
      </div>
    </div>
  )
}
