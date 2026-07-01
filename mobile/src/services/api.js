import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { navigate } from '../navigation/navigationService'

// URL del backend desplegado — cambiar si cambia el servidor
const API_BASE_URL = 'https://agendi-production.up.railway.app'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// Adjunta el JWT en cada petición automáticamente
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('AUTH_TOKEN')
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

// Si el servidor responde 401 (sesión expirada), borra el token y vuelve al login
api.interceptors.response.use(
  res => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('AUTH_TOKEN')
      navigate('Login')
    }
    return Promise.reject(error)
  }
)

export async function initApi() {
  // Solo verifica que el token existe; el interceptor lo adjunta en cada llamada
  const token = await AsyncStorage.getItem('AUTH_TOKEN')
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

// ─── AUTH ─────────────────────────────────────────────────────

export async function login(phone, password) {
  const res = await api.post('/auth/login', { phone, password })
  return res.data // { success, token }
}

export async function setupAccount(phone, password) {
  const res = await api.post('/auth/setup', { phone, password })
  return res.data // { success, token }
}

export async function requestOTP(phone) {
  const res = await api.post('/auth/request-otp', { phone })
  return res.data
}

export async function verifyOTP(phone, code) {
  const res = await api.post('/auth/verify-otp', { phone, code })
  return res.data // { success, resetToken }
}

export async function resetPassword(resetToken, newPassword) {
  const res = await api.post('/auth/reset-password', { resetToken, newPassword })
  return res.data
}

export async function changePassword(currentPassword, newPassword) {
  const res = await api.post('/auth/change-password', { currentPassword, newPassword })
  return res.data
}

// ─── CITAS ───────────────────────────────────────────────────

export const getAppointments = async (date) => {
  const params = date ? { date } : {}
  const res = await api.get('/api/appointments', { params })
  return res.data.appointments
}

export const updateAppointmentStatus = async (id, status, reason = null) => {
  const res = await api.patch(`/api/appointments/${id}/status`, { status, reason })
  return res.data
}

export const getDaySchedule = async (date) => {
  const res = await api.get('/api/day-schedule', { params: { date } })
  return res.data
}

// ─── SERVICIOS ───────────────────────────────────────────────

export const getServices = async () => {
  const res = await api.get('/api/services')
  return res.data.services
}

export const createService = async (data) => {
  const res = await api.post('/api/services', data)
  return res.data
}

export const updateService = async (id, data) => {
  const res = await api.put(`/api/services/${id}`, data)
  return res.data
}

export const deleteService = async (id) => {
  const res = await api.delete(`/api/services/${id}`)
  return res.data
}

// ─── HORARIOS ────────────────────────────────────────────────

export const getSchedule = async () => {
  const res = await api.get('/api/schedule')
  return res.data.schedule
}

export const updateSchedule = async (data) => {
  const res = await api.put('/api/schedule', data)
  return res.data
}

// ─── BLOQUEOS ─────────────────────────────────────────────────

export const addBlockedSlot = async (data) => {
  const res = await api.post('/api/blocked-slots', data)
  return res.data
}

export const removeBlockedSlot = async (id) => {
  const res = await api.delete(`/api/blocked-slots/${id}`)
  return res.data
}

// ─── ALERTA URGENTE ───────────────────────────────────────────

export const sendUrgentAlert = async (reason, date = null) => {
  const res = await api.post('/api/urgent-alert', { reason, date })
  return res.data
}

// ─── CONFIGURACIÓN DEL BOT ───────────────────────────────────

export const getBotConfig = async () => {
  const res = await api.get('/api/bot-config')
  return res.data.config
}

export const updateBotConfig = async (data) => {
  const res = await api.put('/api/bot-config', data)
  return res.data
}

export default api
