export const tokens = {
  // Minimum recommended touch target: 48x48 dp (Accessibility / Material)
  touchTarget: {
    min: 48,
    comfortable: 56,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  fontSize: {
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    display: 36,
  },
  zIndex: {
    modal: 1000,
    toast: 2000,
  },
} as const;
