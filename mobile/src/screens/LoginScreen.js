import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { initApi } from '../services/api'
import { colors, spacing, radius } from '../services/theme'
import alert from '../services/alert'

export default function LoginScreen({ navigation }) {
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>agendi</Text>
        </View>

        <Text style={styles.subtitle}>Panel del negocio</Text>

        {/* Formulario */}
        <View style={styles.form}>
          <Text style={styles.label}>URL del servidor</Text>
          <TextInput
            style={styles.input}
            placeholder="https://tu-servidor.railway.app"
            placeholderTextColor={colors.textMuted}
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={styles.label}>Clave de acceso</Text>
          <TextInput
            style={styles.input}
            placeholder="agendi_barber_key_2024"
            placeholderTextColor={colors.textMuted}
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.black} />
              : <Text style={styles.buttonText}>Entrar</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Encuentra la URL y la clave en el archivo .env de tu backend
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    marginRight: spacing.sm,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  }
})
