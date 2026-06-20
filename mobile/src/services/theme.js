export const colors = {
  // Fondo cálido — carbón casi negro con un toque sutil de calidez
  bg: '#121110',
  bgElevated: '#181715',
  bgCard: '#1D1B18',
  bgInput: '#252320',
  bgInputFocus: '#2D2A26',

  // Acento latón — identidad de Agendi
  accent: '#D4A24E',
  accentSoft: '#E8C77E',
  accentDim: 'rgba(212, 162, 78, 0.14)',
  accentDark: '#A8782F',

  // Texto cálido
  textPrimary: '#F7F1E4',
  textSecondary: '#AD9D89',
  textMuted: '#5E5142',

  // Estados (tonos de la barbería: azul y rojo de poste)
  success: '#7FA876',
  successDim: 'rgba(127, 168, 118, 0.14)',
  warning: '#E0A458',
  warningDim: 'rgba(224, 164, 88, 0.14)',
  error: '#C0594C',
  errorDim: 'rgba(192, 89, 76, 0.14)',
  pending: '#7C9CC4',
  pendingDim: 'rgba(124, 156, 196, 0.14)',

  // Bordes
  border: '#322D27',
  borderLight: '#46403980',

  // Detalle del poste de barbero (logo y acentos)
  poleCream: '#F2E8D8',
  poleRed: '#B5453C',
  poleBlue: '#4F6E94',

  // Acento "spotlight" — carmesí para la próxima cita y elementos destacados
  spotlight: '#E8433B',
  spotlightSoft: '#F2766E',
  spotlightDim: 'rgba(232, 67, 59, 0.14)',
  spotlightDark: '#A8332C',

  // Blanco y negro
  white: '#FFFFFF',
  black: '#0B0805',
}

export const fonts = {
  display: 'BebasNeue_400Regular',
  body: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
  script: 'Caveat_700Bold',
  scriptMedium: 'Caveat_600SemiBold',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999
}

export const shadow = {
  accent: {
    shadowColor: '#D4A24E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4
  },
  spotlight: {
    shadowColor: '#E8433B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8
  }
}
