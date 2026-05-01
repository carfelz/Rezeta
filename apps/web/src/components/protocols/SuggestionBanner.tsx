import { useProtocols } from '@/hooks/protocols/use-protocols'
import type { ProtocolSuggestion } from '@rezeta/shared'
import type { UseMutationResult } from '@tanstack/react-query'

interface MutationActions {
  apply: UseMutationResult<void, Error, string>
  createVariant: UseMutationResult<void, Error, string>
  dismiss: UseMutationResult<void, Error, string>
}

function SuggestionCard({
  suggestion,
  actions,
}: {
  suggestion: ProtocolSuggestion
  actions: MutationActions
}): JSX.Element {
  const { apply, createVariant, dismiss } = actions
  const pct = Math.round(suggestion.occurrencePercentage)

  return (
    <div className="border border-warning-border bg-warning-bg rounded-md p-4">
      <div className="flex items-start gap-3">
        <i className="ph ph-lightbulb text-warning-text text-[18px] shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-sans font-semibold text-n-800 mb-1">
            Sugerencia de optimización
          </div>
          <p className="text-[12.5px] font-sans text-n-700 leading-[1.45]">
            {suggestion.impactSummary}
          </p>
          <p className="text-[11.5px] font-mono text-n-500 mt-1">
            Detectado en {suggestion.occurrenceCount}/{suggestion.totalUses} usos ({pct}%)
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              type="button"
              onClick={() => apply.mutate(suggestion.id)}
              disabled={apply.isPending}
              className="h-7 px-3 text-[12px] font-sans font-medium text-white bg-p-500 hover:bg-p-700 disabled:bg-n-200 disabled:text-n-400 rounded-sm transition-colors"
            >
              {apply.isPending ? 'Aplicando…' : 'Aplicar cambio'}
            </button>
            <button
              type="button"
              onClick={() => createVariant.mutate(suggestion.id)}
              disabled={createVariant.isPending}
              className="h-7 px-3 text-[12px] font-sans font-medium text-n-700 border border-n-200 bg-n-0 hover:bg-n-50 disabled:bg-n-50 disabled:text-n-400 rounded-sm transition-colors"
            >
              {createVariant.isPending ? 'Creando…' : 'Crear variante'}
            </button>
            <button
              type="button"
              onClick={() => dismiss.mutate(suggestion.id)}
              disabled={dismiss.isPending}
              className="h-7 px-3 text-[12px] font-sans text-n-400 hover:text-n-600 transition-colors"
            >
              Ignorar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SuggestionBannerProps {
  protocolId: string
}

export function SuggestionBanner({ protocolId }: SuggestionBannerProps): JSX.Element | null {
  const {
    useGetSuggestions,
    useApplySuggestion,
    useCreateVariantFromSuggestion,
    useDismissSuggestion,
  } = useProtocols()

  const { data: suggestions = [] } = useGetSuggestions(protocolId)
  const apply = useApplySuggestion(protocolId)
  const createVariant = useCreateVariantFromSuggestion(protocolId)
  const dismiss = useDismissSuggestion(protocolId)

  const pending = suggestions.filter((s: ProtocolSuggestion) => s.status === 'pending')

  if (pending.length === 0) return null

  const actions: MutationActions = { apply, createVariant, dismiss }

  return (
    <div className="flex flex-col gap-3">
      {pending.map((s: ProtocolSuggestion) => (
        <SuggestionCard key={s.id} suggestion={s} actions={actions} />
      ))}
    </div>
  )
}
