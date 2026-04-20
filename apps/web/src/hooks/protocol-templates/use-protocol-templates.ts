import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ProtocolTemplateDto } from '@rezeta/shared'

const PROTOCOL_TEMPLATES_KEY = 'protocol-templates'

export function useProtocolTemplates(): UseQueryResult<ProtocolTemplateDto[], Error> {
  return useQuery({
    queryKey: [PROTOCOL_TEMPLATES_KEY],
    queryFn: () => apiClient.get<ProtocolTemplateDto[]>('/v1/protocol-templates'),
  })
}
