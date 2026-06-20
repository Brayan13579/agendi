import React, { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, ScrollView, Platform, Image,
  useWindowDimensions
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

export default function LoginScreen({ navigation }) {
  const { width, height } = useWindowDimensions()
  const isWide = width > 600

  const bgLogoWidth = width * (isWide ? 0.9 : 1.4)
  const bgLogoHeight = bgLogoWidth / LOGO_RATIO
  const logoSize = Math.min(width * (isWide ? 0.28 : 0.52), 220)

  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(null)
  const [showServer, setShowServer] = useState(false)

  async function handleLogin() {
    if (!username || !password) {
      alert.alert('Campos requeridos', 'Escribe tu usuario y contraseña.')
      return
    }

    const storedUrl = await AsyncStorage.getItem('API_URL')
    const apiUrl = (serverUrl.trim() || storedUrl || '').replace(/\/$/, '')

    if (!apiUrl) {
      setShowServer(true)
      alert.alert('Servidor requerido', 'Ingresa la URL del servidor primero.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        await AsyncStorage.setItem('API_URL', apiUrl)
        await AsyncStorage.setItem('API_KEY', data.apiKey)
        await initApi()
        navigation.replace('Main')
      } else {
        alert.alert('Acceso denegado', data.error || 'Usuario o contraseña incorrectos.')
      }
    } catch (e) {
      alert.alert('Error de conexión', 'No se pudo conectar al servidor. Verifica la URL.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Fondo ambiental */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={brandLogo}
          style={[styles.backgroundLogo, {
            width: bgLogoWidth,
            height: bgLogoHeight,
            top: -bgLogoHeight * 0.08,
            right: -bgLogoWidth * (isWide ? 0.3 : 0.42),
          }]}
          resizeMode="contain"
        />
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="glowBrand" cx="50%" cy="26%" r="55%">
              <Stop offset="0%" stopColor={colors.spotlight} stopOpacity={0.22} />
              <Stop offset="100%" stopColor={colors.spotlight} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="glowForm" cx="50%" cy="100%" r="60%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.12} />
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
          contentContainerStyle={[styles.scrollContent, { minHeight: height }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.inner, isWide && styles.innerWide]}>

            {/* Logo */}
            <FadeInUp distance={14} style={styles.brandBlock}>
              <Image
                source={logoGold}
                style={{ width: logoSize, height: logoSize }}
                resizeMode="contain"
              />
            </FadeInUp>

            {/* Formulario */}
            <FadeInUp delay={120} distance={20} style={styles.form}>
              <Text style={styles.formTitle}>Iniciar sesión</Text>

              <Text style={styles.label}>Usuario</Text>
              <TextInput
                style={[styles.input, focused === 'user' && styles.inputFocused]}
                placeholder="admin"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocused('user')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={[styles.input, focused === 'pw' && styles.inputFocused]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('pw')}
                onBlur={() => setFocused(null)}
                secureTextEntry
                autoCapitalize="none"
              />

              {/* Servidor — colapsable */}
              <PressScale onPress={() => setShowServer(v => !v)} style={styles.serverToggle}>
                <Text style={styles.serverToggleText}>
                  {showServer ? '▲ Ocultar servidor' : '⚙️ Configurar servidor'}
                </Text>
              </PressScale>

              {showServer && (
                <>
                  <Text style={styles.label}>URL del servidor</Text>
                  <TextInput
                    style={[styles.input, focused === 'url' && styles.inputFocused]}
                    placeholder="https://tu-servidor.railway.app"
                    placeholderTextColor={colors.textMuted}
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    onFocus={() => setFocused('url')}
                    onBlur={() => setFocused(null)}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </>
              )}

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

            <FadeInUp delay={260} style={styles.taglineBlock}>
              <Text style={styles.tagline}>Agenda tu éxito,{'\n'}resalta tu belleza.</Text>
            </FadeInUp>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  inner: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
  innerWide: {
    maxWidth: 400,
  },
  backgroundLogo: {
    position: 'absolute',
    opacity: 0.07,
    transform: [{ rotate: '8deg' }],
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.xs,
    backgroundColor: 'rgba(29, 27, 24, 0.80)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  formTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 4,
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
  serverToggle: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
  serverToggleText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 2,
  },
  taglineBlock: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  tagline: {
    fontFamily: fonts.script,
    fontSize: 32,
    lineHeight: 40,
    color: colors.spotlightSoft,
    textAlign: 'center',
  },
})
