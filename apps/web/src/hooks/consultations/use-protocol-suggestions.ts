import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ProtocolRecommendation } from '@rezeta/shared'

const MAX_SUGGESTIONS = 4

/**
 * Patient-scoped protocol recommendations for the consultation gate.
 *
 * Calls `/v1/patients/:patientId/protocol-suggestions`, which ranks protocols
 * based on this doctor's prior usage with this specific patient (recency +
 * frequency) and the doctor's overall usage. The first item carries
 * `isMostProbable: true` when the backend has enough signal to flag one.
 */
export function useProtocolSuggestions(
  patientId: string | null,
  enabled: boolean,
): { suggestions: ProtocolRecommendation[]; isLoading: boolean } {
  const { data = [], isLoading } = useQuery({
    queryKey: ['protocol-recommendations', patientId],
    queryFn: () =>
      apiClient.get<ProtocolRecommendation[]>(
        `/v1/patients/${patientId}/protocol-suggestions?limit=${MAX_SUGGESTIONS}`,
      ),
    enabled: enabled && Boolean(patientId),
  })

  const suggestions = data.slice(0, MAX_SUGGESTIONS)
  return {
    suggestions: enabled && patientId ? suggestions : [],
    isLoading: enabled && Boolean(patientId) && isLoading,
  }
}
