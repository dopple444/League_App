const status = {
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  offline: '#94A3B8',
  live: '#10B981',
  pendingSync: '#F59E0B',
  officialFinal: '#0F172A',
  synchronizing: '#3B82F6',
  workflowPending: '#F59E0B',
  neutral: '#64748B',
} as const;

const statusAppearance = {
  success: {
    indicator: status.success,
    surface: '#D1FAE5',
    text: '#065F46',
    border: '#6EE7B7',
  },
  warning: {
    indicator: status.warning,
    surface: '#FEF3C7',
    text: '#92400E',
    border: '#FCD34D',
  },
  danger: {
    indicator: status.danger,
    surface: '#FEE2E2',
    text: '#991B1B',
    border: '#FCA5A5',
  },
  info: {
    indicator: status.info,
    surface: '#DBEAFE',
    text: '#1E40AF',
    border: '#93C5FD',
  },
  offline: {
    indicator: status.offline,
    surface: '#F1F5F9',
    text: '#475569',
    border: '#CBD5E1',
  },
  live: {
    indicator: status.live,
    surface: '#D1FAE5',
    text: '#065F46',
    border: '#6EE7B7',
  },
  pendingSync: {
    indicator: status.pendingSync,
    surface: '#FEF3C7',
    text: '#92400E',
    border: '#FCD34D',
  },
  officialFinal: {
    indicator: status.officialFinal,
    surface: '#0F172A',
    text: '#F8FAFC',
    border: '#0F172A',
  },
  synchronizing: {
    indicator: status.synchronizing,
    surface: '#DBEAFE',
    text: '#1E40AF',
    border: '#93C5FD',
  },
  workflowPending: {
    indicator: status.workflowPending,
    surface: '#FEF3C7',
    text: '#92400E',
    border: '#FCD34D',
  },
  neutral: {
    indicator: status.neutral,
    surface: '#F1F5F9',
    text: '#475569',
    border: '#CBD5E1',
  },
} as const;

export const color = {
  background: {
    canvas: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    inverse: '#0F172A',
    inverseMuted: '#1E293B',
  },
  text: {
    primary: '#0F172A',
    muted: '#64748B',
    inverse: '#F8FAFC',
  },
  brand: {
    primary: '#047857',
    strong: '#065F46',
    soft: '#D1FAE5',
    accent: '#F59E0B',
  },
  action: {
    primary: {
      default: '#047857',
      hover: '#065F46',
      pressed: '#064E3B',
      foreground: '#F8FAFC',
    },
    secondary: {
      default: '#FFFFFF',
      hover: '#ECFDF5',
      pressed: '#D1FAE5',
      foreground: '#047857',
      border: '#047857',
    },
    destructive: {
      default: '#B91C1C',
      hover: '#991B1B',
      pressed: '#7F1D1D',
      foreground: '#FFFFFF',
    },
    link: {
      default: '#047857',
      hover: '#065F46',
    },
    disabled: {
      surface: '#E2E8F0',
      text: '#475569',
      border: '#CBD5E1',
    },
  },
  border: {
    subtle: '#CBD5E1',
    interactive: '#64748B',
    focus: '#2563EB',
    invalid: '#DC2626',
  },
  status,
  statusAppearance,
} as const;

export const typography = {
  fontFamily: {
    sans: ['Roboto Flex', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    web: "'Roboto Flex Variable', 'Roboto Flex', ui-sans-serif, system-ui, sans-serif",
    native: 'RobotoFlex_400Regular',
  },
  size: {
    xs: 12,
    sm: 14,
    body: 16,
    lg: 20,
    xl: 28,
    display: 44,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extraBold: 800,
  },
  lineHeight: {
    tight: 1.15,
    body: 1.55,
  },
} as const;

export const spacing = {
  base: 4,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const control = {
  touchTargetMin: 44,
  scoringTargetMin: 64,
  fieldMinHeight: 48,
} as const;

export const shadows = {
  card: '0 12px 34px rgba(15, 23, 42, 0.08)',
  raised: '0 18px 50px rgba(15, 23, 42, 0.14)',
} as const;

export const layout = {
  contentMaxWidth: 1280,
  adminSidebarWidth: 240,
  modalMaxViewportHeight: 80,
  breakpoint: {
    mobile: 768,
    tablet: 1024,
    desktop: 1025,
  },
} as const;

export const tokens = { color, control, layout, radii, shadows, spacing, typography } as const;

export type LeagueUiTokens = typeof tokens;
export type StatusTone = keyof typeof color.statusAppearance;
