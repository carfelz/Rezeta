import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  ScheduleBlock,
  ScheduleException,
  CreateScheduleBlockDto,
  UpdateScheduleBlockDto,
  CreateScheduleExceptionDto,
  UpdateScheduleExceptionDto,
} from '@rezeta/shared'

const QK_BLOCKS = 'schedule-blocks'
const QK_EXCEPTIONS = 'schedule-exceptions'

export function useGetBlocks(locationId?: string): UseQueryResult<ScheduleBlock[], Error> {
  const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''
  return useQuery({
    queryKey: [QK_BLOCKS, locationId],
    queryFn: () => apiClient.get<ScheduleBlock[]>(`/v1/schedules/blocks${qs}`),
  })
}

export function useCreateBlock(): UseMutationResult<ScheduleBlock, Error, CreateScheduleBlockDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateScheduleBlockDto) =>
      apiClient.post<ScheduleBlock>('/v1/schedules/blocks', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK_BLOCKS] })
    },
  })
}

export function useUpdateBlock(
  id: string,
): UseMutationResult<ScheduleBlock, Error, UpdateScheduleBlockDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateScheduleBlockDto) =>
      apiClient.patch<ScheduleBlock>(`/v1/schedules/blocks/${id}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK_BLOCKS] })
    },
  })
}

export function useDeleteBlock(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/schedules/blocks/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK_BLOCKS] })
    },
  })
}

export interface ExceptionParams {
  locationId?: string
  from?: string
  to?: string
}

export function useGetExceptions(
  params: ExceptionParams = {},
): UseQueryResult<ScheduleException[], Error> {
  const s = new URLSearchParams()
  if (params.locationId) s.set('locationId', params.locationId)
  if (params.from) s.set('from', params.from)
  if (params.to) s.set('to', params.to)
  const qs = s.toString()
  return useQuery({
    queryKey: [QK_EXCEPTIONS, params],
    queryFn: () =>
      apiClient.get<ScheduleException[]>(`/v1/schedules/exceptions${qs ? `?${qs}` : ''}`),
  })
}

export function useCreateException(): UseMutationResult<
  ScheduleException,
  Error,
  CreateScheduleExceptionDto
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateScheduleExceptionDto) =>
      apiClient.post<ScheduleException>('/v1/schedules/exceptions', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK_EXCEPTIONS] })
    },
  })
}

export function useUpdateException(
  id: string,
): UseMutationResult<ScheduleException, Error, UpdateScheduleExceptionDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateScheduleExceptionDto) =>
      apiClient.patch<ScheduleException>(`/v1/schedules/exceptions/${id}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK_EXCEPTIONS] })
    },
  })
}

export function useDeleteException(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/schedules/exceptions/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK_EXCEPTIONS] })
    },
  })
}
