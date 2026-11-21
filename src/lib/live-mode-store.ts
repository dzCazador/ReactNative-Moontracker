import { create } from 'zustand';

interface LiveModeState {
  isActive: boolean;
  setActive: (active: boolean) => void;
}

export const useLiveModeStore = create<LiveModeState>((set) => ({
  isActive: false,
  setActive: (active) => set({ isActive: active }),
}));
