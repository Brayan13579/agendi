import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { format, addDays, subDays, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { getDaySchedule, updateAppointmentStatus, sendUrgentAlert, addBlockedSlot, removeBlockedSlot } from '../services/api'
import { colors, spacing, radius } from '../services/theme'
import alert from '../services/alert'

const STATUS_COLORS = {
  confirmed: colors.accent,
  pending: colors.pending,
  cancelled: colors.error
}

const STATUS_LABELS = {
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  cancelled: 'Cancelada'
}

export default function AgendaScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [daySchedule, setDaySchedule] = useState({ dayActive: true, slots: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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

  function changeDate(days) {
    setSelectedDate(prev => days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days)))
  }

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
  const bookedAppointments = slots.filter(s => s.status === 'booked').map(s => s.appointment)

  function renderSlot({ item }) {
    if (item.status === 'booked') {
      const appt = item.appointment
      return (
        <View style={styles.card}>
          <View style={styles.cardLeft}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[appt.status] }]} />
            <View>
              <Text style={styles.clientName}>{appt.clientName}</Text>
              <Text style={styles.service}>{appt.service}</Text>
              <Text style={styles.time}>🕐 {item.time}</Text>
            </View>
          </View>

          <View style={styles.cardRight}>
            <Text style={[styles.statusBadge, { color: STATUS_COLORS[appt.status] }]}>
              {STATUS_LABELS[appt.status]}
            </Text>
            {appt.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.confirmBtn]}
                  onPress={() => handleStatusChange(appt, 'confirmed')}
                >
                  <Ionicons name="checkmark" size={16} color={colors.black} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={() => handleStatusChange(appt, 'cancelled')}
                >
                  <Ionicons name="close" size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            )}
            {appt.status === 'confirmed' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={() => handleStatusChange(appt, 'cancelled')}
                >
                  <Ionicons name="close" size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )
    }

    if (item.status === 'blocked') {
      return (
        <TouchableOpacity style={styles.blockedRow} onPress={() => handleFreeSlot(item)}>
          <View style={styles.slotLeft}>
            <Ionicons name="lock-closed" size={14} color={colors.warning} />
            <Text style={styles.slotTime}>{item.time}</Text>
          </View>
          <Text style={styles.slotHintBlocked}>Ocupado · Toca para liberar</Text>
        </TouchableOpacity>
      )
    }

    return (
      <TouchableOpacity style={styles.freeRow} onPress={() => handleMarkOccupied(item)}>
        <View style={styles.slotLeft}>
          <Ionicons name="ellipse-outline" size={14} color={colors.textMuted} />
          <Text style={styles.slotTime}>{item.time}</Text>
        </View>
        <Text style={styles.slotHintFree}>Libre · Toca para marcar ocupado</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header de fecha */}
      <View style={styles.dateHeader}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.arrowBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.dateCenter}>
          <Text style={styles.dateText}>
            {isToday(selectedDate) ? 'Hoy' : format(selectedDate, 'EEEE', { locale: es })}
          </Text>
          <Text style={styles.dateSubtext}>
            {format(selectedDate, 'd MMM yyyy', { locale: es })}
          </Text>
        </View>

        <TouchableOpacity onPress={() => changeDate(1)} style={styles.arrowBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Stats del día */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{bookedAppointments.length}</Text>
          <Text style={styles.statLabel}>Citas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {bookedAppointments.filter(a => a.status === 'confirmed').length}
          </Text>
          <Text style={styles.statLabel}>Confirmadas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {bookedAppointments.filter(a => a.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
      </View>

      {/* Horario del día */}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : !daySchedule.dayActive ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No hay horario configurado para este día</Text>
        </View>
      ) : (
        <FlatList
          data={slots}
          keyExtractor={item => item.datetime}
          renderItem={renderSlot}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadDaySchedule(selectedDate) }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Sin horarios para este día</Text>
            </View>
          }
        />
      )}

      {/* Botón alerta urgente */}
      {bookedAppointments.filter(a => a.status !== 'cancelled').length > 0 && (
        <TouchableOpacity style={styles.urgentBtn} onPress={handleUrgentAlert}>
          <Ionicons name="warning" size={18} color={colors.black} />
          <Text style={styles.urgentBtnText}>Alerta urgente</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  arrowBtn: {
    width: 40, height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  dateCenter: { alignItems: 'center' },
  dateText: {
    fontSize: 20, fontWeight: '700',
    color: colors.textPrimary, textTransform: 'capitalize'
  },
  dateSubtext: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800', color: colors.accent },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  list: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  clientName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  service: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  time: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  cardRight: { alignItems: 'flex-end', gap: spacing.sm },
  statusBadge: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.xs },
  actionBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtn: { backgroundColor: colors.accent },
  cancelBtn: { backgroundColor: colors.error },
  freeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  blockedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.warning,
    backgroundColor: '#FFB30015',
  },
  slotLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slotTime: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  slotHintFree: { fontSize: 11, color: colors.textMuted },
  slotHintBlocked: { fontSize: 11, color: colors.warning, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: 15 },
  urgentBtn: {
    position: 'absolute', bottom: spacing.lg,
    left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.error,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: spacing.sm,
    paddingVertical: 14, borderRadius: radius.md,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  urgentBtnText: { color: colors.black, fontWeight: '700', fontSize: 15 },
})
