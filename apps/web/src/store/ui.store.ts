import { create } from 'zustand'

export type ConsultationViewMode = 'soap' | 'canvas'

interface UiState {
  activeLocationId: string | null
  setActiveLocation: (id: string) => void
  viewMode: ConsultationViewMode
  setViewMode: (mode: ConsultationViewMode) => void
  missingFieldsPanelOpen: boolean
  setMissingFieldsPanelOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeLocationId: null,
  setActiveLocation: (id) => set({ activeLocationId: id }),
  viewMode: 'soap',
  setViewMode: (mode) => set({ viewMode: mode }),
  missingFieldsPanelOpen: false,
  setMissingFieldsPanelOpen: (open) => set({ missingFieldsPanelOpen: open }),
}))
