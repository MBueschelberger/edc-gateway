import { create } from 'zustand'

interface UIStore {
  selectedEDCId: string | null
  setSelectedEDCId: (id: string | null) => void
}

export const useUIStore = create<UIStore>((set) => ({
  selectedEDCId: null,
  setSelectedEDCId: (id) => set({ selectedEDCId: id }),
}))
