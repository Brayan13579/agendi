import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const api = axios.create({
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

export async function initApi() {
  const baseURL = await AsyncStorage.getItem('API_URL')
  const apiKey = await AsyncStorage.getItem('API_KEY')
  if (baseURL) api.defaults.baseURL = baseURL
  if (apiKey) api.defaults.headers.common['x-api-key'] = apiKey
}

api.interceptors.request.use(async (config) => {
  const apiKey = await AsyncStorage.getItem('API_KEY')
  const baseURL = await AsyncStorage.getItem('API_URL')
if (apiKey) config.headers.set('x-api-key', apiKey)
  if (baseURL) config.baseURL = baseURL
  return config
})

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
