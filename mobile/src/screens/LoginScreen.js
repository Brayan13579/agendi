import React, { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, ScrollView, Platform, Image, Dimensions
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import { initApi } from '../services/api'
import { colors, spacing, radius, fonts } from '../services/theme'
import { FadeInUp, PressScale } from '../components/Motion'
import alert from '../services/alert'

const brandLogo = require('../assets/images/brand-logo.png')
const logoGold = require('../assets/images/logo-gold.png')
const LOGO_RATIO = 1029 / 1412
const GOLD_RATIO = 1 // logo-gold.png es aproximadamente cuadrado
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const BG_LOGO_WIDTH = SCREEN_W * 1.4
const BG_LOGO_HEIGHT = BG_LOGO_WIDTH / LOGO_RATIO
const MARK_WIDTH = Math.min(SCREEN_W * 0.55, 240)
const MARK_HEIGHT = MARK_WIDTH / GOLD_RATIO

export default function LoginScreen({ navigation }) {
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(null)

  async function handleLogin() {
    if (!apiUrl || !apiKey) {
      alert.alert('Campos requeridos', 'Completa la URL del servidor y la clave.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/health`, {
        headers: { 'x-api-key': apiKey }
      })

      if (res.ok) {
        await AsyncStorage.setItem('API_URL', apiUrl.trim())
        await AsyncStorage.setItem('API_KEY', apiKey.trim())
        await initApi()
        navigation.replace('Main')
      } else {
        alert.alert('Error', 'No se pudo conectar. Verifica la URL y la clave.')
      }
    } catch (e) {
      alert.alert('Error de conexión', 'Asegúrate de que el servidor esté corriendo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Fondo ambiental: logo grande y opaco de lado + halos de color, por toda la pantalla */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={brandLogo} style={styles.backgroundLogo} resizeMode="contain" />
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="glowBrand" cx="50%" cy="26%" r="55%">
              <Stop offset="0%" stopColor={colors.spotlight} stopOpacity={0.28} />
              <Stop offset="100%" stopColor={colors.spotlight} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="glowForm" cx="50%" cy="100%" r="60%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.14} />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowBrand)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowForm)" />
        </Svg>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Marca: tag + insignia centrada (sin fondo, flota sobre la pantalla) */}
          <FadeInUp distance={14} style={styles.brandBlock}>
            <Text style={styles.brandTag}>PANEL DEL NEGOCIO</Text>
            <Image source={logoGold} style={styles.brandMark} resizeMode="contain" />
          </FadeInUp>

          {/* Formulario */}
          <FadeInUp delay={140} distance={20} style={styles.form}>
            <Text style={styles.label}>URL del servidor</Text>
            <TextInput
              style={[styles.input, focused === 'url' && styles.inputFocused]}
              placeholder="https://tu-servidor.railway.app"
              placeholderTextColor={colors.textMuted}
              value={apiUrl}
              onChangeText={setApiUrl}
              onFocus={() => setFocused('url')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.label}>Clave de acceso</Text>
            <TextInput
              style={[styles.input, focused === 'key' && styles.inputFocused]}
              placeholder="agendi_barber_key_2024"
              placeholderTextColor={colors.textMuted}
              value={apiKey}
              onChangeText={setApiKey}
              onFocus={() => setFocused('key')}
              onBlur={() => setFocused(null)}
              secureTextEntry
              autoCapitalize="none"
            />

            <PressScale
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.black} />
                : <Text style={styles.buttonText}>ENTRAR</Text>
              }
            </PressScale>
          </FadeInUp>

          <FadeInUp delay={240} style={styles.taglineBlock}>
            <Text style={styles.tagline}>Agenda tu éxito,{'\n'}resalta tu belleza.</Text>
          </FadeInUp>

          <FadeInUp delay={300}>
            <Text style={styles.hint}>
              Encuentra la URL y la clave en el archivo .env de tu backend
            </Text>
          </FadeInUp>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  // Logo de marca como fondo, grande y opaco, recostado a un lado
  backgroundLogo: {
    position: 'absolute',
    width: BG_LOGO_WIDTH,
    height: BG_LOGO_HEIGHT,
    top: -BG_LOGO_HEIGHT * 0.08,
    right: -BG_LOGO_WIDTH * 0.42,
    opacity: 0.08,
    transform: [{ rotate: '8deg' }],
  },

  // Bloque de marca
  brandBlock: {
    alignItems: 'center',
  },
  brandTag: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  brandMark: {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
  },

  // Lema, debajo del formulario
  taglineBlock: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  tagline: {
    fontFamily: fonts.script,
    fontSize: 36,
    lineHeight: 42,
    color: colors.spotlightSoft,
    textAlign: 'center',
  },

  // Formulario
  form: {
    gap: spacing.sm,
    backgroundColor: 'rgba(29, 27, 24, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.bgInputFocus,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: spacing.lg,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 2,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  }
})
