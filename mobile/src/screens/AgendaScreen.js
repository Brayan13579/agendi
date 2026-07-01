import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, StyleSheet,
  RefreshControl, ActivityIndicator, Linking, Animated, Easing, AccessibilityInfo
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Rect, Defs, RadialGradient, Stop } from 'react-native-svg'
import { format, addDays, subDays, startOfWeek, startOfDay, isToday, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { getDaySchedule, updateAppointmentStatus, sendUrgentAlert, addBlockedSlot, removeBlockedSlot } from '../services/api'
import { colors, spacing, radius, fonts, shadow } from '../services/theme'
import { FadeInUp, PressScale } from '../components/Motion'
import OccupancyRing from '../components/OccupancyRing'
import alert from '../services/alert'

const heroChairImg = require('../assets/images/hero-chair.png')

// Los datetimes vienen del backend en convención fake-UTC (hora Bogotá tratada como UTC).
// Para comparar correctamente con Date.now() (UTC real) se resta este offset.
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000

// Alto del bloque hero (debe coincidir con styles.heroBleed.height) — usado para
// calcular el progreso de scroll de la animación parallax del hero.
const HERO_HEIGHT = 250

const STATUS_COLORS = {
  confirmed: colors.success,
  pending: colors.pending,
  cancelled: colors.error,
}

const STATUS_DIM = {
  confirmed: colors.successDim,
  pending: colors.pendingDim,
  cancelled: colors.errorDim,
}

const STATUS_LABELS = {
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  cancelled: 'Cancelada',
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function formatCountdown(minutes) {
  if (minutes <= 0) return 'Ahora'
  if (minutes < 60) return `En ${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `En ${h}h ${m}min` : `En ${h}h`
}

export default function AgendaScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [daySchedule, setDaySchedule] = useState({ dayActive: true, slots: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tick, setTick] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const scrollY = useRef(new Animated.Value(0)).current

  const loadDaySchedule = useCallback(async (date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const data = await getDaySchedule(dateStr)
      setDaySchedule(data || { dayActive: true, slots: [] })
    } catch (e) {
      alert.alert('Error', 'No se pudo cargar el horario del día.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    loadDaySchedule(selectedDate)
  }, [selectedDate])

  // Refresca la cuenta atrás de la próxima cita cada medio minuto
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  // Respeta la preferencia de "reducir movimiento" del sistema para la animación del hero
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => sub?.remove?.()
  }, [])

  // Cuando el scroll supera la altura del hero, el bloque de días + próxima
  // cita + stats queda pegado arriba (stickyHeaderIndices) y se compacta.
  // Se usa un margen de histéresis (zona muerta) entre activar y desactivar
  // para que pequeños ajustes de scroll cerca del umbral no hagan parpadear
  // el estado.
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      setIsPinned(prev => {
        if (!prev && value >= HERO_HEIGHT) return true
        if (prev && value <= HERO_HEIGHT * 0.25) return false
        return prev
      })
    })
    return () => scrollY.removeListener(id)
  }, [])

  async function handleStatusChange(appointment, newStatus) {
    const labels = { confirmed: 'confirmar', cancelled: 'cancelar' }
    alert.alert(
      `¿${labels[newStatus] === 'confirmar' ? 'Confirmar' : 'Cancelar'} cita?`,
      `${appointment.clientName} · ${appointment.time}`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          style: newStatus === 'cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updateAppointmentStatus(appointment.id, newStatus)
              loadDaySchedule(selectedDate)
            } catch {
              alert.alert('Error', 'No se pudo actualizar la cita.')
            }
          }
        }
      ]
    )
  }

  async function handleMarkOccupied(slot) {
    try {
      await addBlockedSlot({ datetime: slot.datetime, reason: 'Ocupado', isFullDay: false })
      loadDaySchedule(selectedDate)
    } catch {
      alert.alert('Error', 'No se pudo marcar el horario como ocupado.')
    }
  }

  async function handleFreeSlot(slot) {
    try {
      await removeBlockedSlot(slot.blockedId)
      loadDaySchedule(selectedDate)
    } catch {
      alert.alert('Error', 'No se pudo liberar el horario.')
    }
  }

  function openWhatsApp(phone) {
    Linking.openURL(`https://wa.me/${phone}`)
  }

  async function handleUrgentAlert() {
    alert.prompt(
      '🚨 Alerta urgente',
      'Escribe el motivo (opcional). Se avisará a todos los clientes del día.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar alerta',
          style: 'destructive',
          onPress: async (reason) => {
            try {
              const res = await sendUrgentAlert(reason, format(selectedDate, 'yyyy-MM-dd'))
              alert.alert('✅ Listo', `Se notificaron ${res.notified} clientes.`)
              loadDaySchedule(selectedDate)
            } catch {
              alert.alert('Error', 'No se pudo enviar la alerta.')
            }
          }
        }
      ],
      'plain-text'
    )
  }

  const slots = daySchedule.slots || []
  const bookedSlots = useMemo(
    () => slots.filter(s => s.status === 'booked' && s.appointment?.status !== 'cancelled'),
    [slots]
  )
  const confirmedCount = bookedSlots.filter(s => s.appointment?.status === 'confirmed').length
  const pendingCount = bookedSlots.filter(s => s.appointment?.status === 'pending').length
  const revenue = bookedSlots.reduce((sum, s) => sum + (s.appointment?.servicePrice || 0), 0)

  const totalSlots = slots.length
  const occupiedSlots = slots.filter(s => s.status !== 'free').length
  const occupancyPercent = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0

  const freeRemainingSlots = isToday(selectedDate)
    ? slots.filter(s => s.status === 'free' && new Date(s.datetime).getTime() > Date.now() - BOGOTA_OFFSET_MS).length
    : slots.filter(s => s.status === 'free').length

  const now = new Date()
  const nowFake = Date.now() - BOGOTA_OFFSET_MS
  const attendedCount = bookedSlots.filter(s => {
    const end = new Date(s.datetime).getTime() + (s.appointment.duration || 30) * 60000
    return s.appointment.status === 'confirmed' && end <= nowFake
  }).length

  const todayStart = startOfDay(now).getTime()
  const selStart = startOfDay(selectedDate).getTime()
  const isFutureDay = selStart > todayStart
  const isPastDay = selStart < todayStart

  const heroSlot = useMemo(() => {
    if (isPastDay) return null
    if (isFutureDay) return bookedSlots[0] || null
    return bookedSlots.find(s => {
      const end = new Date(s.datetime).getTime() + (s.appointment.duration || 30) * 60000
      return end > Date.now() - BOGOTA_OFFSET_MS
    }) || null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookedSlots, isFutureDay, isPastDay, tick])

  const heroCountdownMin = heroSlot && isToday(selectedDate)
    ? Math.round((new Date(heroSlot.datetime).getTime() - (Date.now() - BOGOTA_OFFSET_MS)) / 60000)
    : null
  const heroInProgress = heroCountdownMin !== null && heroCountdownMin <= 0

  // Una fila por cada franja del día (libre, ocupada o con cita), sin agrupar.
  // Cuando se ve el día de hoy, se inyecta un marcador visual de la hora actual
  // entre el último slot pasado y el primer slot futuro.
  const timelineItems = useMemo(() => {
    const base = slots.map(slot => slot.status === 'free'
      ? { type: 'free', time: slot.time, endTime: slot.endTime, slots: [slot] }
      : { type: slot.status, slot }
    )

    if (!isToday(selectedDate)) return base

    const nowMs = Date.now() - BOGOTA_OFFSET_MS
    let markerInserted = false
    const result = []
    for (const item of base) {
      const dtMs = new Date(
        item.type === 'free' ? item.slots[0].datetime : item.slot.datetime
      ).getTime()
      if (!markerInserted && dtMs > nowMs) {
        result.push({ type: 'now' })
        markerInserted = true
      }
      result.push(item)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, selectedDate, tick])

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [selectedDate])

  let heroEmptyState = null
  if (!heroSlot) {
    if (bookedSlots.length === 0) {
      heroEmptyState = {
        icon: 'sparkles-outline',
        title: 'Agenda libre',
        subtitle: 'No tienes citas programadas para este día',
      }
    } else if (isPastDay) {
      heroEmptyState = {
        icon: 'time-outline',
        title: 'Día finalizado',
        subtitle: `${bookedSlots.length} cita${bookedSlots.length === 1 ? '' : 's'} registrada${bookedSlots.length === 1 ? '' : 's'}`,
      }
    } else {
      heroEmptyState = {
        icon: 'checkmark-done-circle-outline',
        title: 'Jornada completada',
        subtitle: `Atendiste ${bookedSlots.length} cita${bookedSlots.length === 1 ? '' : 's'} hoy`,
      }
    }
  }

  // Animación de scroll del hero: la foto se desvanece y se mueve más lento
  // que el scroll (parallax), mientras los textos suben más rápido y se
  // recortan/desvanecen contra el borde superior (heroBleed tiene overflow:hidden).
  const heroImageAnimStyle = reduceMotion ? null : {
    opacity: scrollY.interpolate({
      inputRange: [0, HERO_HEIGHT],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      { scale: 1.08 },
      {
        translateY: scrollY.interpolate({
          inputRange: [0, HERO_HEIGHT],
          outputRange: [0, -HERO_HEIGHT * 0.35],
          extrapolate: 'clamp',
        }),
      },
    ],
  }

  const heroTextAnimStyle = reduceMotion ? null : {
    opacity: scrollY.interpolate({
      inputRange: [0, HERO_HEIGHT],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [0, HERO_HEIGHT],
          outputRange: [0, -HERO_HEIGHT * 1.15],
          extrapolate: 'clamp',
        }),
      },
    ],
  }

  return (
    <View style={styles.container}>
      <GlowBackdrop />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadDaySchedule(selectedDate) }}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Foto de la silla de lado a lado + saludo — se va ocultando al hacer scroll */}
        <FadeInUp distance={10}>
          <View style={styles.heroBleed}>
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <RadialGradient id="chairGlow" cx="25%" cy="35%" r="75%">
                  <Stop offset="0%" stopColor={colors.spotlight} stopOpacity={0.45} />
                  <Stop offset="100%" stopColor={colors.spotlight} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#chairGlow)" />
            </Svg>
            <Animated.Image source={heroChairImg} style={[styles.heroBleedPhoto, heroImageAnimStyle]} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(18,17,16,0.15)', 'rgba(18,17,16,0.96)']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={styles.heroWeekNav}>
              <PressScale style={styles.weekNavBtn} onPress={() => setSelectedDate(d => subDays(d, 7))}>
                <Ionicons name="chevron-back" size={15} color={colors.textSecondary} />
              </PressScale>
              <PressScale style={styles.weekNavBtn} onPress={() => setSelectedDate(d => addDays(d, 7))}>
                <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
              </PressScale>
            </View>

            <Animated.View style={[styles.heroGreetingOverlay, heroTextAnimStyle]}>
              <Text style={styles.heroScript} numberOfLines={1}>{getGreeting()}</Text>
              <Text style={styles.heroBigDate} numberOfLines={1}>
                {capitalize(format(selectedDate, 'EEEE d', { locale: es }))}
              </Text>
              <Text style={styles.heroMonth}>
                {capitalize(format(selectedDate, 'MMMM', { locale: es }))}
              </Text>
            </Animated.View>
          </View>
        </FadeInUp>

        {/* Bloque fijo: selector de día + próxima cita + stats + cabecera de agenda.
            Al hacer scroll queda pegado arriba (stickyHeaderIndices) y se compacta
            de forma animada (transition CSS) para evitar saltos de scroll. */}
        <View style={[styles.stickyBlock, isPinned && styles.stickyBlockPinned]}>
          {/* Selector de día de la semana */}
          <View style={[styles.weekStrip, isPinned && styles.weekStripCompact]}>
            {weekDays.map(d => {
                const selected = isSameDay(d, selectedDate)
                const today = isToday(d)
                return (
                  <PressScale
                    key={d.toISOString()}
                    onPress={() => setSelectedDate(d)}
                    style={[
                      styles.dayPill,
                      isPinned && styles.dayPillCompact,
                      today && !selected && styles.dayPillToday,
                      selected && styles.dayPillActive,
                    ]}
                  >
                    <Text style={[styles.dayPillDow, selected && styles.dayPillTextActive]}>
                      {format(d, 'EEEEE', { locale: es }).toUpperCase()}
                    </Text>
                    <Text style={[styles.dayPillNum, selected && styles.dayPillTextActive]}>
                      {format(d, 'd')}
                    </Text>
                  </PressScale>
                )
              })}
            </View>

          {/* Tarjeta destacada: próxima cita */}
          {heroSlot ? (
              <HeroCard
                slot={heroSlot}
                countdownMin={heroCountdownMin}
                inProgress={heroInProgress}
                compact={isPinned}
                onWhatsapp={openWhatsApp}
                onConfirm={() => handleStatusChange(heroSlot.appointment, 'confirmed')}
                onCancel={() => handleStatusChange(heroSlot.appointment, 'cancelled')}
              />
            ) : (
              <HeroEmptyCard {...heroEmptyState} compact={isPinned} />
            )}

          {/* Resumen del día */}
          <View style={[styles.statsRow, isPinned && styles.statsRowCompact]}>
              <View style={[styles.statCard, styles.statCardA, isPinned && styles.statCardCompact]}>
                <View style={[styles.statIconWrap, isPinned && styles.statIconWrapCompact, { backgroundColor: colors.spotlightDim }]}>
                  <Ionicons name="calendar-outline" size={15} color={colors.spotlight} />
                </View>
                <Text style={[styles.statValue, isPinned && styles.statValueCompact]}>{bookedSlots.length}</Text>
                <Text style={styles.statLabel}>Citas hoy</Text>
                {!isPinned && (
                  <Text style={styles.statSub}>
                    {confirmedCount} confirmadas · {pendingCount} pend.
                  </Text>
                )}
              </View>

              <View style={[styles.statCard, styles.statCardB, isPinned && styles.statCardCompact]}>
                <View style={[styles.statIconWrap, isPinned && styles.statIconWrapCompact, { backgroundColor: colors.accentDim }]}>
                  <Ionicons name="time-outline" size={15} color={colors.accent} />
                </View>
                <Text style={[styles.statValue, isPinned && styles.statValueCompact]}>{freeRemainingSlots}</Text>
                <Text style={styles.statLabel}>Turnos libres</Text>
                {!isPinned && <Text style={styles.statSub}>{isToday(selectedDate) ? 'disponibles hoy' : `de ${totalSlots} en total`}</Text>}
              </View>

              <View style={[styles.statCard, styles.statCardC, styles.statCardCenter, isPinned && styles.statCardCompact]}>
                <OccupancyRing
                  percent={occupancyPercent}
                  size={isPinned ? 32 : 50}
                  strokeWidth={isPinned ? 4 : 5}
                  gradientColors={[colors.spotlight, colors.accent, colors.poleBlue]}
                />
                <Text style={styles.statLabel}>Ocupación</Text>
                {!isPinned && <Text style={styles.statSub}>{occupiedSlots}/{totalSlots} franjas</Text>}
              </View>
            </View>

          {/* Línea de tiempo */}
          <View style={[styles.timelineHeader, isPinned && styles.timelineHeaderCompact]}>
            <Text style={styles.sectionTitle}>Agenda del día</Text>
            <View style={styles.legend}>
              <LegendDot color={colors.success} label="Confirmada" />
              <LegendDot color={colors.pending} label="Pendiente" />
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : !daySchedule.dayActive ? (
          <EmptyState icon="moon-outline" text="No hay horario configurado para este día" />
        ) : timelineItems.length === 0 ? (
          <EmptyState icon="cafe-outline" text="Sin horarios para este día" />
        ) : (
          <View style={styles.timeline}>
            <View style={styles.timelineLine} pointerEvents="none" />
            {timelineItems.map((item, index) => (
              <TimelineRow
                key={
                  item.type === 'now' ? 'now-marker' :
                  item.type === 'free' ? item.slots[0].datetime :
                  item.slot.datetime
                }
                item={item}
                index={index}
                isNext={item.type === 'booked' && heroSlot?.datetime === item.slot.datetime}
                onWhatsapp={openWhatsApp}
                onConfirm={appt => handleStatusChange(appt, 'confirmed')}
                onCancel={appt => handleStatusChange(appt, 'cancelled')}
                onMarkOccupied={handleMarkOccupied}
                onFreeSlot={handleFreeSlot}
              />
            ))}
          </View>
        )}
      </Animated.ScrollView>

      {/* Botón flotante: alerta urgente */}
      {bookedSlots.length > 0 && <UrgentFab onPress={handleUrgentAlert} />}
    </View>
  )
}

// Atmósfera de fondo: glows radiales sutiles dorado/rojo que dan profundidad
// a toda la pantalla sin depender de imágenes ni de blur nativo.
function GlowBackdrop() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="glowGold" cx="100%" cy="0%" r="60%">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.16} />
          <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowRed" cx="0%" cy="62%" r="50%">
          <Stop offset="0%" stopColor={colors.spotlight} stopOpacity={0.10} />
          <Stop offset="100%" stopColor={colors.spotlight} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowGold)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowRed)" />
    </Svg>
  )
}

// Anillos tipo "radar" que pulsan detrás del avatar de la próxima cita,
// alternando los dos colores del poste de barbería.
function RadarPulse({ size }) {
  const v1 = useRef(new Animated.Value(0)).current
  const v2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const build = (val, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ])
    )
    const a1 = build(v1, 0)
    const a2 = build(v2, 1100)
    a1.start()
    a2.start()
    return () => { a1.stop(); a2.stop() }
  }, [])

  function ringStyle(val) {
    return {
      transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
      opacity: val.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.18, 0] }),
    }
  }

  const base = { width: size, height: size, borderRadius: size / 2 }
  return (
    <>
      <Animated.View style={[styles.radarRing, base, { borderColor: colors.spotlight }, ringStyle(v1)]} />
      <Animated.View style={[styles.radarRing, base, { borderColor: colors.spotlightSoft }, ringStyle(v2)]} />
    </>
  )
}

function HeroCard({ slot, countdownMin, inProgress, compact, onWhatsapp, onConfirm, onCancel }) {
  const appt = slot.appointment
  return (
    <View style={[styles.heroWrap, compact && styles.heroWrapCompact]}>
      <LinearGradient
        colors={[colors.bgElevated, colors.bgCard]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.heroCard, compact && styles.heroCardCompact]}
      >
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="heroGlow" cx="100%" cy="0%" r="75%">
              <Stop offset="0%" stopColor={colors.spotlight} stopOpacity={0.18} />
              <Stop offset="100%" stopColor={colors.spotlight} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGlow)" />
        </Svg>
        {!compact && (
          <Ionicons name="cut" size={150} color={colors.spotlight} style={styles.heroDecorIcon} />
        )}

        <View style={styles.heroHeader}>
          <View style={styles.heroLabelWrap}>
            <View style={styles.heroLabelDot} />
            <Text style={styles.heroLabel}>PRÓXIMA CITA</Text>
          </View>
          {countdownMin !== null && (
            <View style={[styles.countdownChip, inProgress && styles.countdownChipLive]}>
              {inProgress && <View style={styles.liveDot} />}
              <Text style={[styles.countdownText, inProgress && styles.countdownTextLive]}>
                {inProgress ? 'En curso' : formatCountdown(countdownMin)}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.heroBody, compact && styles.heroBodyCompact]}>
          <View style={[styles.avatarWrap, compact && styles.avatarWrapCompact]}>
            {!compact && <RadarPulse size={60} />}
            <View style={[styles.avatar, compact && styles.avatarCompact]}>
              <Text style={[styles.avatarText, compact && styles.avatarTextCompact]}>{getInitials(appt.clientName)}</Text>
            </View>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName} numberOfLines={1}>{appt.clientName}</Text>
            <Text style={styles.heroService} numberOfLines={1}>{appt.service}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: STATUS_DIM[appt.status] }]}>
            <Text style={[styles.statusPillText, { color: STATUS_COLORS[appt.status] }]}>
              {STATUS_LABELS[appt.status]}
            </Text>
          </View>
        </View>

        <View style={[styles.heroFooter, compact && styles.heroFooterCompact]}>
          <View style={styles.heroTimeWrap}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.heroTime}>{slot.time} – {slot.endTime}</Text>
          </View>
          <View style={styles.heroActions}>
            {appt.clientPhone && (
              <PressScale style={[styles.heroActionBtn, styles.whatsappBtn]} onPress={() => onWhatsapp(appt.clientPhone)}>
                <Ionicons name="logo-whatsapp" size={17} color={colors.white} />
              </PressScale>
            )}
            {appt.status === 'pending' && (
              <PressScale style={[styles.heroActionBtn, styles.confirmBtn]} onPress={onConfirm}>
                <Ionicons name="checkmark" size={18} color={colors.black} />
              </PressScale>
            )}
            <PressScale style={[styles.heroActionBtn, styles.cancelBtn]} onPress={onCancel}>
              <Ionicons name="close" size={18} color={colors.white} />
            </PressScale>
          </View>
        </View>
      </LinearGradient>
    </View>
  )
}

function HeroEmptyCard({ icon, title, subtitle, compact }) {
  return (
    <View style={[styles.heroWrap, compact && styles.heroWrapCompact]}>
      <LinearGradient
        colors={[colors.bgElevated, colors.bgCard]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.heroCard, styles.heroEmptyCard, compact && styles.heroCardCompact, compact && styles.heroEmptyCardCompact]}
      >
        {!compact && (
          <Ionicons name="cut" size={150} color={colors.spotlight} style={styles.heroDecorIcon} />
        )}
        <View style={[styles.heroEmptyIconWrap, compact && styles.heroEmptyIconWrapCompact]}>
          <Ionicons name={icon} size={compact ? 18 : 28} color={colors.spotlight} />
        </View>
        <Text style={[styles.heroEmptyTitle, compact && styles.heroEmptyTitleCompact]}>{title}</Text>
        {!compact && <Text style={styles.heroEmptySubtitle}>{subtitle}</Text>}
      </LinearGradient>
    </View>
  )
}

function LegendDot({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  )
}

function EmptyState({ icon, text }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={32} color={colors.textMuted} />
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  )
}

function NowMarker() {
  const now = new Date()
  const h = now.getHours() % 12 || 12
  const m = now.getMinutes()
  const mStr = m < 10 ? `0${m}` : `${m}`
  const ampm = now.getHours() < 12 ? 'am' : 'pm'
  return (
    <View style={styles.nowRow}>
      <View style={styles.timelineGutter}>
        <Text style={styles.nowTime}>{h}:{mStr} {ampm}</Text>
        <View style={styles.nowDot} />
      </View>
      <View style={styles.timelineContent}>
        <View style={styles.nowLine} />
      </View>
    </View>
  )
}

function TimelineRow({ item, index, isNext, onWhatsapp, onConfirm, onCancel, onMarkOccupied, onFreeSlot }) {
  const delay = Math.min(index * 35, 380)

  if (item.type === 'now') {
    return <NowMarker />
  }

  if (item.type === 'booked') {
    const { slot } = item
    const appt = slot.appointment
    return (
      <FadeInUp delay={delay} distance={12}>
        <View style={styles.timelineRow}>
          <View style={styles.timelineGutter}>
            <Text style={styles.timelineTime}>{slot.time}</Text>
            <View style={[
              styles.timelineDot,
              { backgroundColor: STATUS_COLORS[appt.status] },
              isNext && styles.timelineDotNext,
            ]} />
          </View>
          <View style={styles.timelineContent}>
            <View style={[
              styles.apptCard,
              { borderLeftColor: STATUS_COLORS[appt.status] },
              isNext && styles.apptCardNext,
            ]}>
              <View style={styles.apptCardMain}>
                <Text style={styles.apptName} numberOfLines={1}>{appt.clientName}</Text>
                <Text style={styles.apptService} numberOfLines={1}>
                  {appt.service} · {slot.time}-{slot.endTime}
                </Text>
              </View>
              <View style={styles.apptActions}>
                {appt.clientPhone && (
                  <PressScale style={[styles.apptActionBtn, styles.whatsappBtn]} onPress={() => onWhatsapp(appt.clientPhone)}>
                    <Ionicons name="logo-whatsapp" size={14} color={colors.white} />
                  </PressScale>
                )}
                {appt.status === 'pending' && (
                  <PressScale style={[styles.apptActionBtn, styles.confirmBtn]} onPress={() => onConfirm(appt)}>
                    <Ionicons name="checkmark" size={14} color={colors.black} />
                  </PressScale>
                )}
                {appt.status !== 'cancelled' && (
                  <PressScale style={[styles.apptActionBtn, styles.cancelBtn]} onPress={() => onCancel(appt)}>
                    <Ionicons name="close" size={14} color={colors.white} />
                  </PressScale>
                )}
              </View>
            </View>
          </View>
        </View>
      </FadeInUp>
    )
  }

  if (item.type === 'blocked') {
    const { slot } = item
    return (
      <FadeInUp delay={delay} distance={12}>
        <PressScale onPress={() => onFreeSlot(slot)}>
          <View style={styles.timelineRow}>
            <View style={styles.timelineGutter}>
              <Text style={styles.timelineTime}>{slot.time}</Text>
              <View style={[styles.timelineDot, styles.timelineDotBlocked]} />
            </View>
            <View style={styles.timelineContent}>
              <View style={styles.blockedCard}>
                <Ionicons name="lock-closed" size={13} color={colors.warning} />
                <Text style={styles.blockedText}>
                  Ocupado · {slot.time}-{slot.endTime} · Toca para liberar
                </Text>
              </View>
            </View>
          </View>
        </PressScale>
      </FadeInUp>
    )
  }

  // Bloque de franjas libres agrupadas
  return (
    <FadeInUp delay={delay} distance={12}>
      <View style={styles.timelineRow}>
        <View style={styles.timelineGutter}>
          <Text style={styles.timelineTimeFree}>{item.time}</Text>
          <View style={styles.timelineDotFree} />
        </View>
        <View style={styles.timelineContent}>
          <PressScale style={styles.freeCard} onPress={() => onMarkOccupied(item.slots[0])}>
            <View style={styles.freeCardLeft}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={styles.freeCardText}>Libre · {item.time} – {item.endTime}</Text>
            </View>
            <View style={styles.freeAddBtn}>
              <Ionicons name="add" size={14} color={colors.textSecondary} />
            </View>
          </PressScale>
        </View>
      </View>
    </FadeInUp>
  )
}

function UrgentFab({ onPress }) {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    )
    anim.start()
    return () => anim.stop()
  }, [])

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] })
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] })

  return (
    <View style={styles.fabWrap} pointerEvents="box-none">
      <Animated.View style={[styles.fabPulse, { transform: [{ scale }], opacity }]} />
      <PressScale style={styles.fab} onPress={onPress}>
        <Ionicons name="warning" size={22} color={colors.white} />
      </PressScale>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // overflowAnchor: 'none' evita que el navegador "corrija" el scroll cuando
  // el bloque fijo cambia de tamaño al anclarse (scroll-anchoring), que es lo
  // que causaba el bug de oscilación.
  scroll: { overflowAnchor: 'none' },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: 160 },

  // Bloque que queda pegado arriba al hacer scroll (stickyHeaderIndices)
  stickyBlock: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    ...sizeTransition,
  },
  stickyBlockPinned: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadow.card,
  },

  // Foto de la silla de lado a lado + saludo (sin tarjeta, a sangre)
  heroBleed: {
    marginHorizontal: -spacing.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    height: 250,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.bgElevated,
  },
  heroBleedPhoto: {
    width: '100%', height: '100%',
    transform: [{ scale: 1.08 }],
  },
  heroWeekNav: {
    position: 'absolute', top: spacing.lg, right: spacing.md,
    flexDirection: 'row', gap: 6, zIndex: 2,
  },
  weekNavBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: 'rgba(18,17,16,0.55)', borderWidth: 1, borderColor: colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  heroGreetingOverlay: {
    position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md,
  },
  heroScript: {
    fontFamily: fonts.script, fontSize: 30, color: colors.spotlightSoft,
    lineHeight: 32, marginBottom: -2,
  },
  heroBigDate: {
    fontFamily: fonts.display, fontSize: 38, lineHeight: 42,
    color: colors.textPrimary, letterSpacing: 0.5,
  },
  heroMonth: {
    fontFamily: fonts.semiBold, fontSize: 11, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 3, marginTop: 2,
  },

  // Selector de día de la semana
  weekStrip: {
    flexDirection: 'row', gap: 4, marginBottom: spacing.md,
    ...sizeTransition,
  },
  weekStripCompact: { marginBottom: spacing.xs },
  dayPill: {
    flex: 1, height: 56, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    position: 'relative',
    ...sizeTransition,
  },
  dayPillCompact: { height: 40 },
  dayPillToday: {
    borderWidth: 1.5, borderColor: colors.accent,
  },
  dayPillActive: {
    backgroundColor: colors.accent,
  },
  dayPillDow: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.textMuted, letterSpacing: 1.5 },
  dayPillNum: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary },
  dayPillTextActive: { color: colors.black },

  // Hero
  heroWrap: { marginBottom: spacing.md, ...sizeTransition },
  heroWrapCompact: { marginBottom: spacing.xs },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
    ...sizeTransition,
  },
  heroCardCompact: { padding: spacing.sm, borderRadius: radius.lg },
  heroDecorIcon: {
    position: 'absolute',
    top: -36, right: -30,
    opacity: 0.06,
    transform: [{ rotate: '18deg' }],
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabelDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.spotlight,
    shadowColor: colors.spotlight, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4,
  },
  heroLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2.5, color: colors.spotlightSoft },
  countdownChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
    backgroundColor: colors.spotlightDim, borderWidth: 1, borderColor: colors.spotlight + '55',
  },
  countdownChipLive: { backgroundColor: colors.errorDim, borderColor: colors.error + '55' },
  countdownText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.spotlightSoft },
  countdownTextLive: { color: colors.error },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.error },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, ...sizeTransition },
  heroBodyCompact: { marginTop: spacing.xs },
  avatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', ...sizeTransition },
  avatarWrapCompact: { width: 40, height: 40 },
  radarRing: {
    position: 'absolute', top: 0, left: 0,
    borderWidth: 1.5,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.spotlightDim, borderWidth: 1, borderColor: colors.spotlight + '66',
    alignItems: 'center', justifyContent: 'center',
    ...sizeTransition,
  },
  avatarCompact: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { fontFamily: fonts.display, fontSize: 20, color: colors.spotlightSoft, letterSpacing: 1, ...sizeTransition },
  avatarTextCompact: { fontSize: 15 },
  heroInfo: { flex: 1 },
  heroName: { fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary },
  heroService: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  statusPillText: { fontFamily: fonts.semiBold, fontSize: 10, letterSpacing: 0.5 },
  heroFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    ...sizeTransition,
  },
  heroFooterCompact: { marginTop: spacing.sm, paddingTop: spacing.sm },
  heroTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTime: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textPrimary },
  heroActions: { flexDirection: 'row', gap: 8 },
  heroActionBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  // Hero vacío
  heroEmptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  heroEmptyCardCompact: { paddingVertical: spacing.sm, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  heroEmptyIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.spotlightDim, borderWidth: 1, borderColor: colors.spotlight + '55',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
    ...sizeTransition,
  },
  heroEmptyIconWrapCompact: { width: 34, height: 34, borderRadius: 17, marginBottom: 0 },
  heroEmptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.textPrimary, letterSpacing: 0.5, ...sizeTransition },
  heroEmptyTitleCompact: { fontSize: 15 },
  heroEmptySubtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

  // Resumen del día (3 tarjetas)
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, ...sizeTransition },
  statsRowCompact: { marginBottom: spacing.xs },
  statCard: {
    flex: 1, padding: spacing.sm + 2, borderRadius: radius.lg,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    gap: 4, ...shadow.card,
    ...sizeTransition,
  },
  statCardCompact: { padding: 8, gap: 2 },
  statCardCenter: { alignItems: 'center' },
  statCardA: {
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl, borderBottomLeftRadius: 6,
  },
  statCardB: {
    borderTopLeftRadius: 6, borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl, borderBottomLeftRadius: radius.xl,
  },
  statCardC: {
    borderTopLeftRadius: radius.xl, borderTopRightRadius: 6,
    borderBottomRightRadius: radius.xl, borderBottomLeftRadius: radius.xl,
  },
  statIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
    ...sizeTransition,
  },
  statIconWrapCompact: { width: 20, height: 20, borderRadius: 6, marginBottom: 0 },
  statValue: { fontFamily: fonts.display, fontSize: 22, color: colors.textPrimary, ...sizeTransition },
  statValueCompact: { fontSize: 16 },
  statLabel: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.textPrimary, marginTop: 2 },
  statSub: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.textMuted },

  // Timeline
  timelineHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
    ...sizeTransition,
  },
  timelineHeaderCompact: { marginBottom: 0 },
  sectionTitle: {
    fontFamily: fonts.display, fontSize: 21, color: colors.textPrimary,
    letterSpacing: 1,
  },
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textSecondary },

  timeline: { position: 'relative' },
  timelineLine: {
    position: 'absolute',
    left: 50, top: 8, bottom: 8, width: 2,
    backgroundColor: colors.border, borderRadius: 1,
  },
  timelineRow: { flexDirection: 'row', marginBottom: spacing.sm },
  timelineGutter: {
    width: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingRight: 10,
  },
  timelineTime: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.textPrimary },
  timelineTimeFree: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  timelineDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  timelineDotNext: {
    width: 12, height: 12, borderRadius: 6,
    shadowColor: colors.spotlight, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 6,
  },
  timelineDotBlocked: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warning, zIndex: 1 },
  timelineDotFree: {
    width: 8, height: 8, borderRadius: 4, zIndex: 1,
    backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.textMuted,
  },
  timelineContent: { flex: 1, paddingLeft: spacing.sm },

  apptCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3,
    padding: spacing.sm + 2,
  },
  apptCardNext: {
    borderColor: colors.spotlight + '55', backgroundColor: colors.bgElevated,
    ...shadow.spotlight,
  },
  apptCardMain: { flex: 1 },
  apptName: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  apptService: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  apptActions: { flexDirection: 'row', gap: 6 },
  apptActionBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  confirmBtn: { backgroundColor: colors.success },
  cancelBtn: { backgroundColor: colors.error },
  whatsappBtn: { backgroundColor: '#3F8F5C' },

  blockedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.warningDim, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.warning + '40',
    paddingVertical: 10, paddingHorizontal: spacing.sm,
  },
  blockedText: { flex: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.warning },

  // Marcador de hora actual en la timeline
  nowRow: {
    flexDirection: 'row', alignItems: 'center', zIndex: 2,
    marginBottom: 4, marginTop: 2,
  },
  nowTime: {
    fontFamily: fonts.semiBold, fontSize: 10, color: colors.accent,
    letterSpacing: 0.5,
  },
  nowDot: {
    width: 12, height: 12, borderRadius: 6, zIndex: 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 5,
  },
  nowLine: {
    height: 1.5, backgroundColor: colors.accent, opacity: 0.75,
  },

  freeCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    paddingVertical: 10, paddingHorizontal: spacing.sm,
  },
  freeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  freeCardText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  freeAddBtn: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyState: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyStateText: { fontFamily: fonts.medium, color: colors.textSecondary, fontSize: 14 },

  // FAB alerta urgente
  fabWrap: {
    position: 'absolute', bottom: 110, right: spacing.lg,
    width: 56, height: 56, alignItems: 'center', justifyContent: 'center',
  },
  fabPulse: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.spotlight,
  },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.spotlight, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.spotlight, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
})
