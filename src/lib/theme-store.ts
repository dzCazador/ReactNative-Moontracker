import { create } from 'zustand';

export type ThemeScheme = 'light' | 'dark';

interface ThemeState {
  scheme: ThemeScheme;
  setScheme: (scheme: ThemeScheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  scheme: 'dark',
  setScheme: (scheme) => set({ scheme }),
}));
