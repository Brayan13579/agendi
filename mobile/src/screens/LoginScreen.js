import React, { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, ScrollView, Platform, Image, Dimensions, TouchableOpacity
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import { login, setupAccount, requestOTP, verifyOTP, resetPassword } from '../services/api'
import { initApi } from '../services/api'
import { colors, spacing, radius, fonts } from '../services/theme'
import { FadeInUp, PressScale } from '../components/Motion'
import alert from '../services/alert'

const brandLogo = require('../assets/images/brand-logo.png')
const logoGold = require('../assets/images/logo-gold.png')
const LOGO_RATIO = 1029 / 1412
const { width: SCREEN_W } = Dimensions.get('window')
const BG_LOGO_WIDTH = SCREEN_W * 1.4
const BG_LOGO_HEIGHT = BG_LOGO_WIDTH / LOGO_RATIO
const MARK_WIDTH = Math.min(SCREEN_W * 0.55, 240)
const MARK_HEIGHT = MARK_WIDTH

// 'login' | 'setup' | 'otp-phone' | 'otp-code' | 'otp-newpass'
const VIEWS = {
  LOGIN: 'login',
  SETUP: 'setup',
  OTP_PHONE: 'otp-phone',
  OTP_CODE: 'otp-code',
  OTP_NEWPASS: 'otp-newpass',
}

export default function LoginScreen({ navigation }) {
  const [view, setView] = useState(VIEWS.LOGIN)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(null)

  // Login
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  // OTP flow
  const [otpPhone, setOtpPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function normalizePhone(raw) {
    const digits = raw.replace(/\D/g, '')
    // Si ya tiene código de país, lo deja; si no, agrega 57 (Colombia)
    return digits.startsWith('57') && digits.length >= 11 ? digits : `57${digits}`
  }

  // ── INICIAR SESIÓN ──────────────────────────────────────────

  async function handleLogin() {
    if (!phone || !password) {
      return alert.alert('Campos requeridos', 'Ingresa tu número y contraseña.')
    }
    setLoading(true)
    try {
      const normalized = normalizePhone(phone)
      const data = await login(normalized, password)
      await AsyncStorage.setItem('AUTH_TOKEN', data.token)
      await initApi()
      navigation.replace('Main')
    } catch (e) {
      const msg = e.response?.data?.error || 'No se pudo conectar al servidor.'
      // Si no hay usuarios aún, ofrecer setup inicial
      if (e.response?.status === 401 && msg === 'Credenciales incorrectas') {
        alert.alert('Error', msg)
      } else {
        alert.alert('Error', msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── PRIMER ACCESO (SETUP) ────────────────────────────────────

  async function handleSetup() {
    if (!phone || !password || !confirmPassword) {
      return alert.alert('Campos requeridos', 'Completa todos los campos.')
    }
    if (password !== confirmPassword) {
      return alert.alert('Error', 'Las contraseñas no coinciden.')
    }
    if (password.length < 6) {
      return alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.')
    }
    setLoading(true)
    try {
      const normalized = normalizePhone(phone)
      const data = await setupAccount(normalized, password)
      await AsyncStorage.setItem('AUTH_TOKEN', data.token)
      await initApi()
      navigation.replace('Main')
    } catch (e) {
      const msg = e.response?.data?.error || 'Error al crear la cuenta.'
      alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  // ── PASO 1 RECUPERAR: pedir teléfono y enviar OTP ────────────

  async function handleRequestOTP() {
    if (!otpPhone) {
      return alert.alert('Requerido', 'Ingresa tu número de celular.')
    }
    setLoading(true)
    try {
      const normalized = normalizePhone(otpPhone)
      await requestOTP(normalized)
      setView(VIEWS.OTP_CODE)
    } catch (e) {
      alert.alert('Error', 'No se pudo enviar el código. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── PASO 2 RECUPERAR: verificar código OTP ──────────────────

  async function handleVerifyOTP() {
    if (!otpCode || otpCode.length < 6) {
      return alert.alert('Código inválido', 'Ingresa el código de 6 dígitos.')
    }
    setLoading(true)
    try {
      const normalized = normalizePhone(otpPhone)
      const data = await verifyOTP(normalized, otpCode)
      setResetToken(data.resetToken)
      setView(VIEWS.OTP_NEWPASS)
    } catch (e) {
      const msg = e.response?.data?.error || 'Código incorrecto o expirado.'
      alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  // ── PASO 3 RECUPERAR: establecer nueva contraseña ───────────

  async function handleResetPassword() {
    if (!newPassword || !confirmPassword) {
      return alert.alert('Requerido', 'Completa ambos campos.')
    }
    if (newPassword !== confirmPassword) {
      return alert.alert('Error', 'Las contraseñas no coinciden.')
    }
    if (newPassword.length < 6) {
      return alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.')
    }
    setLoading(true)
    try {
      await resetPassword(resetToken, newPassword)
      alert.alert('¡Listo!', 'Contraseña actualizada. Inicia sesión.', [
        { text: 'OK', onPress: () => { setView(VIEWS.LOGIN); setNewPassword(''); setConfirmPassword('') } }
      ])
    } catch (e) {
      const msg = e.response?.data?.error || 'Error al cambiar la contraseña.'
      alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  // ── RENDER ──────────────────────────────────────────────────

  function renderContent() {
    if (view === VIEWS.LOGIN) return (
      <>
        <FadeInUp delay={140} distance={20} style={styles.form}>
          <Text style={styles.formTitle}>INICIAR SESIÓN</Text>

          <Text style={styles.label}>NÚMERO DE CELULAR</Text>
          <TextInput
            style={[styles.input, focused === 'phone' && styles.inputFocused]}
            placeholder="3001234567"
            placeholderTextColor={colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            onFocus={() => setFocused('phone')}
            onBlur={() => setFocused(null)}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Text style={styles.label}>CONTRASEÑA</Text>
          <TextInput
            style={[styles.input, focused === 'pass' && styles.inputFocused]}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused('pass')}
            onBlur={() => setFocused(null)}
            secureTextEntry
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

          <TouchableOpacity style={styles.link} onPress={() => { setOtpPhone(phone); setView(VIEWS.OTP_PHONE) }}>
            <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkSecondary} onPress={() => setView(VIEWS.SETUP)}>
            <Text style={styles.linkSecondaryText}>Primer acceso →</Text>
          </TouchableOpacity>
        </FadeInUp>
      </>
    )

    if (view === VIEWS.SETUP) return (
      <FadeInUp distance={20} style={styles.form}>
        <Text style={styles.formTitle}>CREAR CUENTA</Text>
        <Text style={styles.formSubtitle}>Solo disponible si no hay cuenta registrada</Text>

        <Text style={styles.label}>NÚMERO DE CELULAR</Text>
        <TextInput
          style={[styles.input, focused === 'phone' && styles.inputFocused]}
          placeholder="3001234567"
          placeholderTextColor={colors.textMuted}
          value={phone}
          onChangeText={setPhone}
          onFocus={() => setFocused('phone')}
          onBlur={() => setFocused(null)}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>CONTRASEÑA</Text>
        <TextInput
          style={[styles.input, focused === 'pass' && styles.inputFocused]}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setFocused('pass')}
          onBlur={() => setFocused(null)}
          secureTextEntry
        />

        <Text style={styles.label}>CONFIRMAR CONTRASEÑA</Text>
        <TextInput
          style={[styles.input, focused === 'confirm' && styles.inputFocused]}
          placeholder="Repite la contraseña"
          placeholderTextColor={colors.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onFocus={() => setFocused('confirm')}
          onBlur={() => setFocused(null)}
          secureTextEntry
        />

        <PressScale
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSetup}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.black} />
            : <Text style={styles.buttonText}>CREAR CUENTA</Text>
          }
        </PressScale>

        <TouchableOpacity style={styles.link} onPress={() => setView(VIEWS.LOGIN)}>
          <Text style={styles.linkText}>← Volver al login</Text>
        </TouchableOpacity>
      </FadeInUp>
    )

    if (view === VIEWS.OTP_PHONE) return (
      <FadeInUp distance={20} style={styles.form}>
        <Text style={styles.formTitle}>RECUPERAR ACCESO</Text>
        <Text style={styles.formSubtitle}>Te enviaremos un código por WhatsApp</Text>

        <Text style={styles.label}>TU NÚMERO DE CELULAR</Text>
        <TextInput
          style={[styles.input, focused === 'otp-phone' && styles.inputFocused]}
          placeholder="3001234567"
          placeholderTextColor={colors.textMuted}
          value={otpPhone}
          onChangeText={setOtpPhone}
          onFocus={() => setFocused('otp-phone')}
          onBlur={() => setFocused(null)}
          keyboardType="phone-pad"
        />

        <PressScale
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRequestOTP}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.black} />
            : <Text style={styles.buttonText}>ENVIAR CÓDIGO</Text>
          }
        </PressScale>

        <TouchableOpacity style={styles.link} onPress={() => setView(VIEWS.LOGIN)}>
          <Text style={styles.linkText}>← Volver</Text>
        </TouchableOpacity>
      </FadeInUp>
    )

    if (view === VIEWS.OTP_CODE) return (
      <FadeInUp distance={20} style={styles.form}>
        <Text style={styles.formTitle}>INGRESA EL CÓDIGO</Text>
        <Text style={styles.formSubtitle}>Revisa tu WhatsApp — válido por 5 minutos</Text>

        <Text style={styles.label}>CÓDIGO DE 6 DÍGITOS</Text>
        <TextInput
          style={[styles.input, styles.inputCode, focused === 'code' && styles.inputFocused]}
          placeholder="482910"
          placeholderTextColor={colors.textMuted}
          value={otpCode}
          onChangeText={t => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
          onFocus={() => setFocused('code')}
          onBlur={() => setFocused(null)}
          keyboardType="number-pad"
          maxLength={6}
        />

        <PressScale
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyOTP}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.black} />
            : <Text style={styles.buttonText}>VERIFICAR</Text>
          }
        </PressScale>

        <TouchableOpacity style={styles.link} onPress={() => setView(VIEWS.OTP_PHONE)}>
          <Text style={styles.linkText}>← No llegó el código</Text>
        </TouchableOpacity>
      </FadeInUp>
    )

    if (view === VIEWS.OTP_NEWPASS) return (
      <FadeInUp distance={20} style={styles.form}>
        <Text style={styles.formTitle}>NUEVA CONTRASEÑA</Text>
        <Text style={styles.formSubtitle}>Elige una contraseña segura</Text>

        <Text style={styles.label}>NUEVA CONTRASEÑA</Text>
        <TextInput
          style={[styles.input, focused === 'new' && styles.inputFocused]}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor={colors.textMuted}
          value={newPassword}
          onChangeText={setNewPassword}
          onFocus={() => setFocused('new')}
          onBlur={() => setFocused(null)}
          secureTextEntry
        />

        <Text style={styles.label}>CONFIRMAR CONTRASEÑA</Text>
        <TextInput
          style={[styles.input, focused === 'confirm' && styles.inputFocused]}
          placeholder="Repite la contraseña"
          placeholderTextColor={colors.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onFocus={() => setFocused('confirm')}
          onBlur={() => setFocused(null)}
          secureTextEntry
        />

        <PressScale
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.black} />
            : <Text style={styles.buttonText}>CAMBIAR CONTRASEÑA</Text>
          }
        </PressScale>
      </FadeInUp>
    )
  }

  return (
    <View style={styles.container}>
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
          <FadeInUp distance={14} style={styles.brandBlock}>
            <Text style={styles.brandTag}>PANEL DEL NEGOCIO</Text>
            <Image source={logoGold} style={styles.brandMark} resizeMode="contain" />
          </FadeInUp>

          {renderContent()}

          <FadeInUp delay={300} style={styles.taglineBlock}>
            <Text style={styles.tagline}>Agenda tu éxito,{'\n'}resalta tu belleza.</Text>
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
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  backgroundLogo: {
    position: 'absolute',
    width: BG_LOGO_WIDTH,
    height: BG_LOGO_HEIGHT,
    top: -BG_LOGO_HEIGHT * 0.08,
    right: -BG_LOGO_WIDTH * 0.42,
    opacity: 0.08,
    transform: [{ rotate: '8deg' }],
  },
  brandBlock: { alignItems: 'center' },
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
  form: {
    gap: spacing.sm,
    backgroundColor: 'rgba(29, 27, 24, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  formTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
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
  inputCode: {
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
    fontFamily: fonts.bold,
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 2,
  },
  link: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  linkText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.accent,
  },
  linkSecondary: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  linkSecondaryText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
})
