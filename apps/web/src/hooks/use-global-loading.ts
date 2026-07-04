import { useLoadingStore } from '@/store/loading.store'

export function useGlobalLoading(): { isLoading: boolean } {
  const isLoading = useLoadingStore((s) => s.isLoading)
  return { isLoading }
}
