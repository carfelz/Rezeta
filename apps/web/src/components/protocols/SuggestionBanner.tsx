import { useProtocols } from '@/hooks/protocols/use-protocols'
import type { ProtocolSuggestion } from '@rezeta/shared'
import type { UseMutationResult } from '@tanstack/react-query'
import { Button, Caption, Callout, Row, Stack, TextLink } from '@/components/ui'
import { suggestionBannerStrings } from './strings'

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
    <Callout tone="warning" icon="ph ph-lightbulb" title={suggestionBannerStrings.calloutTitle}>
      <Stack gap={2}>
        <p className="text-xs text-n-700 leading-[1.45]">{suggestion.impactSummary}</p>
        <Caption tone="muted" size="sm" className="font-mono">
          {suggestionBannerStrings.detectedIn(
            suggestion.occurrenceCount,
            suggestion.totalUses,
            pct,
          )}
        </Caption>
        <Row gap={2} wrap className="mt-1">
          <Button
            variant="primary"
            size="sm"
            disabled={apply.isPending}
            onClick={() => apply.mutate(suggestion.id)}
          >
            {apply.isPending
              ? suggestionBannerStrings.applyingButton
              : suggestionBannerStrings.applyButton}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={createVariant.isPending}
            onClick={() => createVariant.mutate(suggestion.id)}
          >
            {createVariant.isPending
              ? suggestionBannerStrings.creatingButton
              : suggestionBannerStrings.createVariantButton}
          </Button>
          <TextLink
            tone="neutral"
            size="md"
            disabled={dismiss.isPending}
            onClick={() => dismiss.mutate(suggestion.id)}
          >
            {suggestionBannerStrings.dismissButton}
          </TextLink>
        </Row>
      </Stack>
    </Callout>
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
    <Stack gap={3}>
      {pending.map((s: ProtocolSuggestion) => (
        <SuggestionCard key={s.id} suggestion={s} actions={actions} />
      ))}
    </Stack>
  )
}
