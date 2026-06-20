import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getServices, createService, updateService, deleteService } from '../services/api'
import { colors, spacing, radius, fonts } from '../services/theme'
import { FadeInUp, PressScale } from '../components/Motion'
import alert from '../services/alert'

const EMPTY_SERVICE = { name: '', price: '', duration: '30', active: true }

export default function ServicesScreen() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState(null) // null = nuevo
  const [form, setForm] = useState(EMPTY_SERVICE)
  const [saving, setSaving] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  useEffect(() => { loadServices() }, [])

  async function loadServices() {
    try {
      const data = await getServices()
      setServices(data || [])
    } catch {
      alert.alert('Error', 'No se pudieron cargar los servicios.')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_SERVICE)
    setModalVisible(true)
  }

  function openEdit(service) {
    setEditing(service)
    setForm({
      name: service.name,
      price: String(service.price),
      duration: String(service.duration || 30),
      active: service.active
    })
    setModalVisible(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price) {
      alert.alert('Campos requeridos', 'Completa el nombre y el precio.')
      return
    }
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        price: Number(form.price),
        duration: Number(form.duration),
        active: true
      }
      if (editing) {
        await updateService(editing.id, data)
      } else {
        await createService(data)
      }
      setModalVisible(false)
      loadServices()
    } catch {
      alert.alert('Error', 'No se pudo guardar el servicio.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(service) {
    alert.alert(
      'Desactivar servicio',
      `¿Desactivar "${service.name}"? Ya no aparecerá en el bot.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteService(service.id)
              loadServices()
            } catch {
              alert.alert('Error', 'No se pudo desactivar el servicio.')
            }
          }
        }
      ]
    )
  }

  function renderService({ item, index }) {
    return (
      <FadeInUp delay={Math.min(index * 50, 350)} distance={14}>
        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="cut-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.serviceName}>{item.name}</Text>
            <View style={styles.serviceMeta}>
              <Text style={styles.servicePrice}>${item.price.toLocaleString()}</Text>
              <Text style={styles.serviceDot}>·</Text>
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.serviceDuration}>{item.duration} min</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <PressScale onPress={() => openEdit(item)} style={styles.iconBtn}>
              <Ionicons name="pencil" size={16} color={colors.textSecondary} />
            </PressScale>
            <PressScale onPress={() => handleDelete(item)} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </PressScale>
          </View>
        </View>
      </FadeInUp>
    )
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={services}
          keyExtractor={item => item.id}
          renderItem={renderService}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cut-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>No hay servicios aún</Text>
              <Text style={styles.emptyHint}>Toca el botón + para agregar</Text>
            </View>
          }
        />
      )}

      {/* Botón agregar */}
      <PressScale style={styles.fab} onPress={openNew}>
        <Ionicons name="add" size={28} color={colors.black} />
      </PressScale>

      {/* Modal crear/editar */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editing ? 'EDITAR SERVICIO' : 'NUEVO SERVICIO'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.label}>Nombre del servicio</Text>
            <TextInput
              style={[styles.input, focusedField === 'name' && styles.inputFocused]}
              placeholder="Ej: Corte clásico"
              placeholderTextColor={colors.textMuted}
              value={form.name}
              onChangeText={v => setForm(p => ({ ...p, name: v }))}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
            />

            <Text style={styles.label}>Precio</Text>
            <TextInput
              style={[styles.input, focusedField === 'price' && styles.inputFocused]}
              placeholder="Ej: 15000"
              placeholderTextColor={colors.textMuted}
              value={form.price}
              onChangeText={v => setForm(p => ({ ...p, price: v }))}
              onFocus={() => setFocusedField('price')}
              onBlur={() => setFocusedField(null)}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Duración (minutos)</Text>
            <View style={styles.durationRow}>
              {['15', '30', '45', '60', '90'].map(d => (
                <PressScale
                  key={d}
                  style={[styles.durationBtn, form.duration === d && styles.durationBtnActive]}
                  onPress={() => setForm(p => ({ ...p, duration: d }))}
                >
                  <Text style={[styles.durationText, form.duration === d && styles.durationTextActive]}>
                    {d}
                  </Text>
                </PressScale>
              ))}
            </View>

            <PressScale
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.black} />
                : <Text style={styles.saveBtnText}>
                    {editing ? 'GUARDAR CAMBIOS' : 'AGREGAR SERVICIO'}
                  </Text>
              }
            </PressScale>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md, paddingBottom: 120 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  serviceName: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: spacing.xs },
  servicePrice: { fontFamily: fonts.bold, fontSize: 14, color: colors.accent },
  serviceDot: { color: colors.textMuted },
  serviceDuration: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 34, height: 34, borderRadius: radius.full,
    backgroundColor: colors.bgInput,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.xs },
  emptyText: { fontFamily: fonts.bold, color: colors.textSecondary, fontSize: 16, marginTop: spacing.sm },
  emptyHint: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 13 },
  fab: {
    position: 'absolute', bottom: 100, right: spacing.lg,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.accent, letterSpacing: 2 },
  modalBody: { padding: spacing.lg, gap: spacing.sm },
  label: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    color: colors.textPrimary, fontFamily: fonts.medium, fontSize: 15,
    marginBottom: spacing.sm,
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.bgInputFocus },
  durationRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  durationBtn: {
    flex: 1, paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  durationBtnActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  durationText: { fontFamily: fonts.semiBold, color: colors.textSecondary, fontSize: 13 },
  durationTextActive: { color: colors.accent },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md, paddingVertical: 16,
    alignItems: 'center', marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.black, fontFamily: fonts.bold, fontSize: 14, letterSpacing: 1.5 },
})
