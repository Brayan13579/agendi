import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Rect, G, ClipPath, Defs } from 'react-native-svg'
import { colors, fonts } from '../services/theme'

const TONES = {
  gold: {
    ring: colors.accent,
    ringDim: 'rgba(212, 162, 78, 0.3)',
    plate: colors.bgElevated,
    cap: '#100C08',
    wordmark: colors.textPrimary,
    accentDot: colors.accent,
  },
  cream: {
    ring: colors.poleCream,
    ringDim: 'rgba(242, 232, 216, 0.35)',
    plate: '#100C08',
    cap: colors.poleCream,
    wordmark: colors.poleCream,
    accentDot: colors.accent,
  },
  dark: {
    ring: '#100C08',
    ringDim: 'rgba(11, 8, 5, 0.35)',
    plate: colors.poleCream,
    cap: '#100C08',
    wordmark: '#100C08',
    accentDot: colors.poleRed,
  },
}

/**
 * Insignia circular con un poste de barbero estilizado en el centro.
 * variant: 'gold' | 'cream' | 'dark' — recolorea el anillo, el fondo y las tapas.
 */
export function LogoMark({ size = 56, variant = 'gold' }) {
  const t = TONES[variant] || TONES.gold

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="poleClip">
          <Rect x="38" y="16" width="24" height="68" rx="12" />
        </ClipPath>
      </Defs>

      {/* Anillo exterior */}
      <Circle cx="50" cy="50" r="47" fill={t.plate} stroke={t.ring} strokeWidth="3" />
      <Circle cx="50" cy="50" r="39" fill="none" stroke={t.ringDim} strokeWidth="1" />

      {/* Poste de barbero, ligeramente inclinado */}
      <G transform="rotate(10 50 50)">
        <G clipPath="url(#poleClip)">
          <Rect x="38" y="16" width="24" height="68" fill={colors.poleCream} />
          {/* Franjas diagonales */}
          {Array.from({ length: 9 }).map((_, i) => (
            <Rect
              key={i}
              x={-20 + i * 14}
              y={0}
              width="10"
              height="120"
              fill={i % 2 === 0 ? colors.poleRed : colors.poleBlue}
              transform="rotate(45 50 50)"
            />
          ))}
        </G>
        {/* Tapas */}
        <Rect x="35" y="11" width="30" height="13" rx="6.5" fill={t.cap} />
        <Rect x="35" y="76" width="30" height="13" rx="6.5" fill={t.cap} />
      </G>
    </Svg>
  )
}

/**
 * Logotipo completo: insignia + wordmark "Agendi".
 * size controla la altura de la insignia; el texto escala junto a ella.
 */
export default function Logo({ size = 56, variant = 'gold', showWordmark = true, vertical = false }) {
  const t = TONES[variant] || TONES.gold
  const textSize = size * 0.62

  return (
    <View style={[styles.row, vertical && styles.column]}>
      <LogoMark size={size} variant={variant} />
      {showWordmark && (
        <View style={[styles.textBlock, vertical ? styles.textBlockVertical : styles.textBlockRow]}>
          <Text style={[styles.wordmark, { fontSize: textSize, color: t.wordmark }]}>
            Agendi
          </Text>
          <View style={[styles.underline, { backgroundColor: t.accentDot, width: textSize * 1.6 }]} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { flexDirection: 'column', alignItems: 'center' },
  textBlock: { },
  textBlockRow: { marginLeft: 14 },
  textBlockVertical: { marginTop: 10, alignItems: 'center' },
  wordmark: {
    fontFamily: fonts.display,
    letterSpacing: 2,
    lineHeight: undefined,
  },
  underline: {
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    opacity: 0.85,
  },
})
