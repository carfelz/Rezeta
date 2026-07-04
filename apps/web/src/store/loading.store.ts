import { create } from 'zustand'

export interface LoadingState {
  pendingCount: number
  isLoading: boolean
  requestStarted: () => void
  requestFinished: () => void
}

export const useLoadingStore = create<LoadingState>((set) => ({
  pendingCount: 0,
  isLoading: false,
  requestStarted: () =>
    set((s) => {
      const pendingCount = s.pendingCount + 1
      return { pendingCount, isLoading: pendingCount > 0 }
    }),
  requestFinished: () =>
    set((s) => {
      const pendingCount = Math.max(0, s.pendingCount - 1)
      return { pendingCount, isLoading: pendingCount > 0 }
    }),
}))
