const { getDb } = require('../config/firebase')
const { labelNow } = require('../utils/time')

// ─── CLIENTES ───────────────────────────────────────────────

// Buscar cliente por número de teléfono
async function getClient(phone) {
  const db = getDb()
  const doc = await db.collection('clients').doc(phone).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
}

// Crear o actualizar cliente
async function saveClient(phone, name) {
  const db = getDb()
  await db.collection('clients').doc(phone).set({
    name,
    phone,
    createdAt: new Date().toISOString()
  }, { merge: true })
}

// ─── SESIONES DE CONVERSACIÓN ────────────────────────────────
// Guardamos el estado de cada conversación activa del bot

async function getSession(phone) {
  const db = getDb()
  const doc = await db.collection('sessions').doc(phone).get()
  return doc.exists ? doc.data() : null
}

async function saveSession(phone, data) {
  const db = getDb()
  await db.collection('sessions').doc(phone).set({
    ...data,
    updatedAt: new Date().toISOString()
  })
}

async function deleteSession(phone) {
  const db = getDb()
  await db.collection('sessions').doc(phone).delete()
}

// ─── CITAS ───────────────────────────────────────────────────

async function createAppointment(data) {
  const db = getDb()
  const ref = await db.collection('appointments').add({
    ...data,
    status: 'pending', // pending | confirmed | cancelled
    createdAt: new Date().toISOString()
  })
  return ref.id
}

async function getAppointmentByPhone(phone) {
  const db = getDb()
  const snapshot = await db.collection('appointments')
    .where('clientPhone', '==', phone)
    .get()

  const now = labelNow().toISOString()
  const upcoming = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.status !== 'cancelled' && a.datetime >= now)
    .sort((a, b) => a.datetime.localeCompare(b.datetime))

  return upcoming[0] || null
}

async function getAppointmentsByPhone(phone) {
  const db = getDb()
  const snapshot = await db.collection('appointments')
    .where('clientPhone', '==', phone)
    .get()

  const now = labelNow().toISOString()
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.status !== 'cancelled' && a.datetime >= now)
    .sort((a, b) => a.datetime.localeCompare(b.datetime))
}

async function cancelAppointment(appointmentId) {
  const db = getDb()
  await db.collection('appointments').doc(appointmentId).update({
    status: 'cancelled',
    cancelledAt: new Date().toISOString()
  })
}

// Obtener citas próximas para enviar recordatorios
async function getUpcomingAppointments(fromDate, toDate) {
  const db = getDb()
  const snapshot = await db.collection('appointments')
    .where('status', '==', 'confirmed')
    .where('datetime', '>=', fromDate)
    .where('datetime', '<=', toDate)
    .where('reminderSent', '==', false)
    .get()

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function markReminderSent(appointmentId) {
  const db = getDb()
  await db.collection('appointments').doc(appointmentId).update({
    reminderSent: true
  })
}

// ─── SERVICIOS ───────────────────────────────────────────────

async function getServices() {
  const db = getDb()
  const snapshot = await db.collection('services')
    .where('active', '==', true)
    .orderBy('order')
    .get()

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// ─── HORARIOS ────────────────────────────────────────────────

// Obtener la configuración de horarios del barbero
async function getScheduleConfig(barberId = 'default') {
  const db = getDb()
  const doc = await db.collection('schedules').doc(barberId).get()
  return doc.exists ? doc.data() : null
}

// Obtener slots bloqueados (vacaciones, urgencias)
async function getBlockedSlots(barberId = 'default') {
  const db = getDb()
  const snapshot = await db.collection('blockedSlots')
    .where('barberId', '==', barberId)
    .where('datetime', '>=', labelNow().toISOString())
    .get()

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// ─── CONFIGURACIÓN DEL BOT ───────────────────────────────────

async function getBotConfig(barberId = 'default') {
  const db = getDb()
  const doc = await db.collection('botConfig').doc(barberId).get()
  return doc.exists ? doc.data() : {
    keywords: ['cita', 'agendar', 'reservar', 'turno', 'hora'],
    reminderMinutes: 30,
    botActive: true,
    welcomeMessage: '¡Hola! 👋 Soy el asistente de la barbería. ¿En qué te puedo ayudar?'
  }
}

module.exports = {
  getClient,
  saveClient,
  getSession,
  saveSession,
  deleteSession,
  createAppointment,
  getAppointmentByPhone,
  getAppointmentsByPhone,
  cancelAppointment,
  getUpcomingAppointments,
  markReminderSent,
  getServices,
  getScheduleConfig,
  getBlockedSlots,
  getBotConfig
}
