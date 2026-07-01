import React, { useRef, useEffect } from 'react'
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, Animated, Platform, InteractionManager
} from 'react-native'
import { colors, spacing, radius, fonts } from '../services/theme'

const ITEM_HEIGHT = 58
const VISIBLE = 5
const COL_WIDTH = 110
const SCROLL_HEIGHT = ITEM_HEIGHT * VISIBLE

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']
const PAD = 2

export default function TimePickerModal({ visible, value = '09:00', onConfirm, onClose }) {
  const [hStr, mStr] = (value || '09:00').split(':')
  const initHour = Math.min(23, Math.max(0, parseInt(hStr) || 0))
  const initMinute = Math.max(0, MINUTES.indexOf(mStr) >= 0 ? MINUTES.indexOf(mStr) : 0)

  const selectedHour = useRef(initHour)
  const selectedMinute = useRef(initMinute)
  const hourOffset = useRef(initHour * ITEM_HEIGHT)
  const minuteOffset = useRef(initMinute * ITEM_HEIGHT)
  const hourRef = useRef()
  const minuteRef = useRef()

  const slideAnim = useRef(new Animated.Value(400)).current
  const overlayAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const mIdx = MINUTES.indexOf(mStr) >= 0 ? MINUTES.indexOf(mStr) : 0
    selectedHour.current = initHour
    selectedMinute.current = mIdx

    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true,
          tension: 68, friction: 13
        }),
        Animated.timing(overlayAnim, {
          toValue: 1, duration: 230, useNativeDriver: true
        }),
      ]).start()
      hourOffset.current = initHour * ITEM_HEIGHT
      minuteOffset.current = mIdx * ITEM_HEIGHT
      InteractionManager.runAfterInteractions(() => {
        hourRef.current?.scrollTo({ y: initHour * ITEM_HEIGHT, animated: false })
        minuteRef.current?.scrollTo({ y: mIdx * ITEM_HEIGHT, animated: false })
      })
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 400, duration: 210, useNativeDriver: true
        }),
        Animated.timing(overlayAnim, {
          toValue: 0, duration: 190, useNativeDriver: true
        }),
      ]).start()
    }
  }, [visible])

  function onHourScroll(e) {
    hourOffset.current = e.nativeEvent.contentOffset.y
  }

  function onMinuteScroll(e) {
    minuteOffset.current = e.nativeEvent.contentOffset.y
  }

  function handleConfirm() {
    const hourIdx = Math.max(0, Math.min(23, Math.round(hourOffset.current / ITEM_HEIGHT)))
    const minIdx = Math.max(0, Math.min(MINUTES.length - 1, Math.round(minuteOffset.current / ITEM_HEIGHT)))
    const h = String(hourIdx).padStart(2, '0')
    const m = MINUTES[minIdx] || '00'
    onConfirm(`${h}:${m}`)
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
            <Text style={styles.cancelBtn}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>SELECCIONAR HORA</Text>
          <TouchableOpacity onPress={handleConfirm} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
            <Text style={styles.confirmBtn}>Listo</Text>
          </TouchableOpacity>
        </View>

        {/* Picker area */}
        <View style={styles.pickerOuter}>
          <View style={styles.pickerInner}>

            {/* Highlight bar — positioned over middle row */}
            <View style={styles.highlight} pointerEvents="none" />

            {/* Labels row */}
            <View style={styles.labelsRow}>
              <Text style={[styles.colLabel, { width: COL_WIDTH }]}>HH</Text>
              <View style={styles.colonSpace} />
              <Text style={[styles.colLabel, { width: COL_WIDTH }]}>MM</Text>
            </View>

            {/* Wheels row */}
            <View style={styles.wheelsRow}>

              {/* Hours */}
              <ScrollView
                ref={hourRef}
                style={{ width: COL_WIDTH, height: SCROLL_HEIGHT }}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScroll={onHourScroll}
                onMomentumScrollEnd={onHourScroll}
              >
                {Array(PAD).fill(null).map((_, i) => <View key={`ht${i}`} style={styles.item} />)}
                {HOURS.map((h, i) => (
                  <TouchableOpacity
                    key={h}
                    style={styles.item}
                    onPress={() => {
                      hourOffset.current = i * ITEM_HEIGHT
                      hourRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true })
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.itemText}>{h}</Text>
                  </TouchableOpacity>
                ))}
                {Array(PAD).fill(null).map((_, i) => <View key={`hb${i}`} style={styles.item} />)}
              </ScrollView>

              {/* Colon */}
              <View style={styles.colonWrapper}>
                <Text style={styles.colon}>:</Text>
              </View>

              {/* Minutes */}
              <ScrollView
                ref={minuteRef}
                style={{ width: COL_WIDTH, height: SCROLL_HEIGHT }}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScroll={onMinuteScroll}
                onMomentumScrollEnd={onMinuteScroll}
              >
                {Array(PAD).fill(null).map((_, i) => <View key={`mt${i}`} style={styles.item} />)}
                {MINUTES.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={styles.item}
                    onPress={() => {
                      minuteOffset.current = i * ITEM_HEIGHT
                      minuteRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true })
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.itemText}>{m}</Text>
                  </TouchableOpacity>
                ))}
                {Array(PAD).fill(null).map((_, i) => <View key={`mb${i}`} style={styles.item} />)}
              </ScrollView>

            </View>
          </View>
        </View>

      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.semiBold, fontSize: 13, letterSpacing: 2, color: colors.textPrimary },
  cancelBtn: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  confirmBtn: { fontFamily: fonts.bold, fontSize: 15, color: colors.accent },

  pickerOuter: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  pickerInner: {
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 20 + ITEM_HEIGHT * PAD,
    left: 0,
    width: COL_WIDTH * 2 + 32,
    height: ITEM_HEIGHT,
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    zIndex: 0,
  },
  labelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingLeft: 0,
  },
  colLabel: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    letterSpacing: 1.5,
  },
  colonSpace: {
    width: 32,
  },
  wheelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colonWrapper: {
    width: 32,
    alignItems: 'center',
    marginTop: -(ITEM_HEIGHT * 0.1),
  },
  colon: {
    fontSize: 30,
    fontFamily: fonts.display,
    color: colors.accent,
  },
  item: {
    height: ITEM_HEIGHT,
    width: COL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 30,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
})
