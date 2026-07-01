import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, ActivityIndicator, TextInput, Image
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getBotConfig, updateBotConfig } from '../services/api'
import { colors, spacing, radius, fonts } from '../services/theme'
import { FadeInUp, PressScale } from '../components/Motion'

const logoGold = require('../assets/images/logo-gold.png')
import alert from '../services/alert'

export default function ConfigScreen({ navigation }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    try {
      const data = await getBotConfig()
      setConfig(data)
    } catch {
      alert.alert('Error', 'No se pudo cargar la configuración.')
    } finally {
      setLoading(false)
    }
  }

  function update(field, value) {
    setConfig(p => ({ ...p, [field]: value }))
    setHasChanges(true)
  }

  function addKeyword() {
    const kw = newKeyword.trim().toLowerCase()
    if (!kw) return
    if (config.keywords.includes(kw)) {
      alert.alert('Ya existe', 'Esa palabra clave ya está en la lista.')
      return
    }
    update('keywords', [...config.keywords, kw])
    setNewKeyword('')
  }

  function removeKeyword(kw) {
    if (config.keywords.length <= 1) {
      alert.alert('Mínimo una', 'Debe haber al menos una palabra clave.')
      return
    }
    update('keywords', config.keywords.filter(k => k !== kw))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateBotConfig(config)
      setHasChanges(false)
      alert.alert('✅ Guardado', 'La configuración se actualizó.')
    } catch {
      alert.alert('Error', 'No se pudo guardar la configuración.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('AUTH_TOKEN')
          navigation.replace('Login')
        }
      }
    ])
  }

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent} />
    </View>
  )

  if (!config) return (
    <View style={styles.centered}>
      <Text style={{ fontFamily: fonts.medium, color: colors.textSecondary, marginBottom: spacing.lg }}>
        No se pudo cargar la configuración
      </Text>
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => {
          await AsyncStorage.removeItem('AUTH_TOKEN')
          navigation.replace('Login')
        }}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Bot activo/pausado */}
        <FadeInUp distance={12}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado del bot</Text>
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>Bot activo</Text>
                  <Text style={styles.cardHint}>
                    {config.botActive
                      ? 'El bot responde automáticamente'
                      : 'Modo manual — respondes tú'
                    }
                  </Text>
                </View>
                <Switch
                  value={config.botActive}
                  onValueChange={v => update('botActive', v)}
                  trackColor={{ false: colors.border, true: colors.accentDim }}
                  thumbColor={config.botActive ? colors.accent : colors.textMuted}
                />
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Palabras clave */}
        <FadeInUp delay={70} distance={12}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Palabras que activan el bot</Text>
            <View style={styles.card}>
              <View style={styles.keywordsList}>
                {config.keywords.map(kw => (
                  <View key={kw} style={styles.keyword}>
                    <Text style={styles.keywordText}>{kw}</Text>
                    <TouchableOpacity onPress={() => removeKeyword(kw)}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addKeywordRow}>
                <TextInput
                  style={styles.keywordInput}
                  placeholder="Nueva palabra..."
                  placeholderTextColor={colors.textMuted}
                  value={newKeyword}
                  onChangeText={setNewKeyword}
                  onSubmitEditing={addKeyword}
                  autoCapitalize="none"
                />
                <PressScale style={styles.addKeywordBtn} onPress={addKeyword}>
                  <Ionicons name="add" size={20} color={colors.black} />
                </PressScale>
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Recordatorio */}
        <FadeInUp delay={140} distance={12}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recordatorio automático</Text>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Minutos antes de la cita</Text>
              <View style={styles.reminderRow}>
                {[15, 30, 45, 60].map(min => (
                  <PressScale
                    key={min}
                    style={[
                      styles.reminderBtn,
                      config.reminderMinutes === min && styles.reminderBtnActive
                    ]}
                    onPress={() => update('reminderMinutes', min)}
                  >
                    <Text style={[
                      styles.reminderBtnText,
                      config.reminderMinutes === min && styles.reminderBtnTextActive
                    ]}>
                      {min} min
                    </Text>
                  </PressScale>
                ))}
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Mensaje de bienvenida */}
        <FadeInUp delay={210} distance={12}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mensaje de bienvenida</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.welcomeInput}
                value={config.welcomeMessage}
                onChangeText={v => update('welcomeMessage', v)}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </FadeInUp>

        {/* Cerrar sesión */}
        <FadeInUp delay={280} distance={12}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Image source={logoGold} style={{ height: 40, width: 40 }} resizeMode="contain" />
            <Text style={styles.version}>Agendi · v1.0.0</Text>
          </View>
        </FadeInUp>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 140 },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  cardHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  keywordsList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  keyword: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.accentDim,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.accent,
  },
  keywordText: { fontFamily: fonts.semiBold, color: colors.accent, fontSize: 13 },
  addKeywordRow: { flexDirection: 'row', gap: spacing.sm },
  keywordInput: {
    flex: 1, backgroundColor: colors.bgInput,
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 10,
    color: colors.textPrimary, fontFamily: fonts.medium, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  addKeywordBtn: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  reminderRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  reminderBtn: {
    flex: 1, paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgInput,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  reminderBtnActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  reminderBtnText: { fontFamily: fonts.semiBold, color: colors.textSecondary, fontSize: 13 },
  reminderBtnTextActive: { color: colors.accent },
  welcomeInput: {
    color: colors.textPrimary, fontFamily: fonts.medium, fontSize: 14,
    textAlignVertical: 'top', minHeight: 80,
  },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.error,
    borderRadius: radius.md, marginBottom: spacing.md,
  },
  logoutText: { fontFamily: fonts.semiBold, color: colors.error, fontSize: 15 },
  footer: { alignItems: 'center', gap: 6, opacity: 0.6 },
  version: { fontFamily: fonts.medium, textAlign: 'center', color: colors.textMuted, fontSize: 12 },
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
