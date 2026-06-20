import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { colors, fonts } from '../services/theme'

/**
 * Anillo de progreso circular. Si se pasa `gradientColors`, el trazo de
 * progreso usa un degradado (útil para el guiño al poste de barbería).
 */
export default function OccupancyRing({
  percent = 0,
  size = 56,
  strokeWidth = 5,
  trackColor = colors.border,
  solidColor = colors.accent,
  gradientColors,
}) {
  const clamped = Math.min(Math.max(percent, 0), 100)
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - clamped / 100)
  const gradId = 'occupancyRingGrad'

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {gradientColors && (
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              {gradientColors.map((c, i) => (
                <Stop key={i} offset={`${(i / (gradientColors.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
        )}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={gradientColors ? `url(#${gradId})` : solidColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={[styles.value, { fontSize: size * 0.28 }]}>{Math.round(clamped)}%</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
})
