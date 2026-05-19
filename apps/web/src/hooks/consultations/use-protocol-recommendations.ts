import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ProtocolRecommendation } from '@rezeta/shared'

const MAX_RECOMMENDATIONS = 4

/**
 * Patient-scoped protocol recommendations for the consultation gate.
 *
 * Calls `/v1/patients/:patientId/protocol-recommendations`, which ranks
 * protocols based on this doctor's prior usage with this specific patient
 * (recency + frequency) and the doctor's overall usage. The first item
 * carries `isMostProbable: true` when the backend has enough signal.
 */
export function useProtocolRecommendations(
  patientId: string | null,
  enabled: boolean,
): { suggestions: ProtocolRecommendation[]; isLoading: boolean } {
  const { data = [], isLoading } = useQuery({
    queryKey: ['protocol-recommendations', patientId],
    queryFn: () =>
      apiClient.get<ProtocolRecommendation[]>(
        `/v1/patients/${patientId}/protocol-recommendations?limit=${MAX_RECOMMENDATIONS}`,
      ),
    enabled: enabled && Boolean(patientId),
  })

  const suggestions = data.slice(0, MAX_RECOMMENDATIONS)
  return {
    suggestions: enabled && patientId ? suggestions : [],
    isLoading: enabled && Boolean(patientId) && isLoading,
  }
}
