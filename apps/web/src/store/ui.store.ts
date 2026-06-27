import { create } from 'zustand'

interface UiState {
  activeLocationId: string | null
  setActiveLocation: (id: string) => void
  missingFieldsPanelOpen: boolean
  setMissingFieldsPanelOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeLocationId: null,
  setActiveLocation: (id) => set({ activeLocationId: id }),
  missingFieldsPanelOpen: false,
  setMissingFieldsPanelOpen: (open) => set({ missingFieldsPanelOpen: open }),
}))
