import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getSchedule, updateSchedule } from '../services/api'
import { colors, spacing, radius, fonts } from '../services/theme'
import TimePickerModal from '../components/TimePickerModal'
import { FadeInUp, PressScale } from '../components/Motion'
import alert from '../services/alert'

const DAYS = [
  { key: 'lunes',      label: 'Lunes' },
  { key: 'martes',     label: 'Martes' },
  { key: 'miercoles',  label: 'Miércoles' },
  { key: 'jueves',     label: 'Jueves' },
  { key: 'viernes',    label: 'Viernes' },
  { key: 'sabado',     label: 'Sábado' },
  { key: 'domingo',    label: 'Domingo' },
]

const DEFAULT_SCHEDULE = {
  slotDuration: 30,
  weeklySchedule: {
    lunes:     { active: true,  start: '09:00', end: '18:00' },
    martes:    { active: true,  start: '09:00', end: '18:00' },
    miercoles: { active: true,  start: '09:00', end: '18:00' },
    jueves:    { active: true,  start: '09:00', end: '18:00' },
    viernes:   { active: true,  start: '09:00', end: '18:00' },
    sabado:    { active: true,  start: '09:00', end: '14:00' },
    domingo:   { active: false, start: '09:00', end: '14:00' },
  }
}

export default function ScheduleScreen() {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [timePicker, setTimePicker] = useState(null) // { dayKey, field, value }

  useEffect(() => {
    loadSchedule()
  }, [])

  async function loadSchedule() {
    try {
      const data = await getSchedule()
      if (data) setSchedule({
        ...DEFAULT_SCHEDULE,
        ...data,
        weeklySchedule: { ...DEFAULT_SCHEDULE.weeklySchedule, ...data.weeklySchedule }
      })
    } catch (e) {
      alert.alert('Error', 'No se pudo cargar el horario.')
    } finally {
      setLoading(false)
    }
  }

  function updateDay(dayKey, field, value) {
    setSchedule(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [dayKey]: { ...prev.weeklySchedule?.[dayKey], [field]: value }
      }
    }))
    setHasChanges(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateSchedule(schedule)
      setHasChanges(false)
      alert.alert('✅ Guardado', 'Los horarios se actualizaron correctamente.')
    } catch (e) {
      alert.alert('Error', e?.response?.data?.error || e?.message || 'No se pudo guardar el horario.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent} />
    </View>
  )

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Duración de cada cita */}
        <FadeInUp distance={12}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duración de cada turno</Text>
            <View style={styles.slotRow}>
              {[15, 30, 45, 60].map(min => (
                <PressScale
                  key={min}
                  style={[
                    styles.slotOption,
                    schedule.slotDuration === min && styles.slotOptionActive
                  ]}
                  onPress={() => {
                    setSchedule(p => ({ ...p, slotDuration: min }))
                    setHasChanges(true)
                  }}
                >
                  <Text style={[
                    styles.slotOptionText,
                    schedule.slotDuration === min && styles.slotOptionTextActive
                  ]}>
                    {min} min
                  </Text>
                </PressScale>
              ))}
            </View>
          </View>
        </FadeInUp>

        {/* Horario semanal */}
        <View style={styles.section}>
          <FadeInUp delay={60} distance={12}>
            <Text style={styles.sectionTitle}>Horario semanal</Text>
          </FadeInUp>
          {DAYS.map(({ key, label }, idx) => {
            const day = schedule.weeklySchedule?.[key] || { active: false, start: '09:00', end: '18:00' }
            return (
              <FadeInUp key={key} delay={90 + idx * 35} distance={12}>
                <View style={[styles.dayCard, !day.active && styles.dayCardInactive]}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayLabelRow}>
                      <View style={[styles.dayDot, day.active ? styles.dayDotActive : styles.dayDotInactive]} />
                      <Text style={[styles.dayLabel, !day.active && styles.dayLabelInactive]}>
                        {label}
                      </Text>
                    </View>
                    <Switch
                      value={day.active}
                      onValueChange={v => updateDay(key, 'active', v)}
                      trackColor={{ false: colors.border, true: colors.accentDim }}
                      thumbColor={day.active ? colors.accent : colors.textMuted}
                    />
                  </View>

                  {day.active && (
                    <View style={styles.timeRow}>
                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>Desde</Text>
                        <PressScale
                          style={styles.timeBtn}
                          onPress={() => setTimePicker({ dayKey: key, field: 'start', value: day.start })}
                        >
                          <Ionicons name="time-outline" size={14} color={colors.accent} />
                          <Text style={styles.timeBtnText}>{day.start}</Text>
                        </PressScale>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.textMuted} style={styles.arrow} />
                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>Hasta</Text>
                        <PressScale
                          style={styles.timeBtn}
                          onPress={() => setTimePicker({ dayKey: key, field: 'end', value: day.end })}
                        >
                          <Ionicons name="time-outline" size={14} color={colors.accent} />
                          <Text style={styles.timeBtnText}>{day.end}</Text>
                        </PressScale>
                      </View>
                    </View>
                  )}

                  {!day.active && (
                    <Text style={styles.closedText}>Cerrado</Text>
                  )}
                </View>
              </FadeInUp>
            )
          })}
        </View>
      </ScrollView>

      {/* Botón guardar */}
      {hasChanges && (
        <PressScale
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={colors.black} />
            : <>
                <Ionicons name="checkmark-circle" size={20} color={colors.black} />
                <Text style={styles.saveBtnText}>GUARDAR CAMBIOS</Text>
              </>
          }
        </PressScale>
      )}

      <TimePickerModal
        visible={!!timePicker}
        value={timePicker?.value || '09:00'}
        onClose={() => setTimePicker(null)}
        onConfirm={v => {
          updateDay(timePicker.dayKey, timePicker.field, v)
          setTimePicker(null)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 120 },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  slotRow: { flexDirection: 'row', gap: spacing.sm },
  slotOption: {
    flex: 1, paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  slotOptionActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  slotOptionText: { fontFamily: fonts.semiBold, color: colors.textSecondary, fontSize: 13 },
  slotOptionTextActive: { color: colors.accent },
  dayCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  dayCardInactive: { opacity: 0.7 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  dayDotActive: { backgroundColor: colors.accent },
  dayDotInactive: { backgroundColor: colors.textMuted },
  dayLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  dayLabelInactive: { color: colors.textMuted },
  closedText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  timeField: { flex: 1 },
  timeLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.bgInput,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderWidth: 1, borderColor: colors.accent + '55',
  },
  timeBtnText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: 1,
  },
  arrow: { marginTop: 16 },
  saveBtn: {
    position: 'absolute', bottom: 100,
    left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: spacing.sm,
    paddingVertical: 14, borderRadius: radius.md,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.black, fontFamily: fonts.bold, fontSize: 14, letterSpacing: 1.5 },
})
