import { create } from 'zustand'

interface UiState {
  activeLocationId: string | null
  setActiveLocation: (id: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeLocationId: null,
  setActiveLocation: (id) => set({ activeLocationId: id }),
}))
