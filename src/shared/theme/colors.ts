export const colors = {
  // Dark theme (default)
  dark: {
    background: '#0b0f17',
    surface: '#121926',
    surfaceElevated: '#1c2736',
    border: '#2d3a4f',
    text: '#e8eaf0',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    accent: '#38bdf8', // sky-400
    accentPressed: '#0ea5e9',
    danger: '#f87171',
    success: '#4ade80',
    warning: '#fbbf24',
    // Large touch target areas
    pressable: 'rgba(56, 189, 248, 0.10)',
  },
  // Light theme
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceElevated: '#f1f5f9',
    border: '#cbd5e1',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    accent: '#0369a1',
    accentPressed: '#075985',
    danger: '#ef4444',
    success: '#16a34a',
    warning: '#d97706',
    pressable: 'rgba(3, 105, 161, 0.10)',
  },
} as const;

export type ColorScheme = 'light' | 'dark';
