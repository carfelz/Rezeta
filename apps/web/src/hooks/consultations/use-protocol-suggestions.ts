import { useProtocols } from '@/hooks/protocols/use-protocols'
import type { ProtocolListItem } from '@rezeta/shared'

const MAX_SUGGESTIONS = 4

export function useProtocolSuggestions(enabled: boolean): {
  suggestions: ProtocolListItem[]
  isLoading: boolean
} {
  const { useGetProtocols } = useProtocols()
  const { data = [], isLoading } = useGetProtocols({
    status: 'active',
    sort: 'updatedAt_desc',
  })

  const suggestions = data.slice(0, MAX_SUGGESTIONS)

  return { suggestions: enabled ? suggestions : [], isLoading: enabled && isLoading }
}
