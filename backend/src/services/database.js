const { getDb } = require('../config/firebase')
const { labelNow } = require('../utils/time')

// ─── HELPER ──────────────────────────────────────────────────

function col(tenantId, collectionName) {
  return getDb().collection('tenants').doc(tenantId).collection(collectionName)
}

// ─── CLIENTES ───────────────────────────────────────────────

async function getClient(tenantId, phone) {
  const doc = await col(tenantId, 'clients').doc(phone).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
}

async function saveClient(tenantId, phone, name) {
  await col(tenantId, 'clients').doc(phone).set({
    name,
    phone,
    createdAt: new Date().toISOString()
  }, { merge: true })
}

// ─── SESIONES DE CONVERSACIÓN ────────────────────────────────

async function getSession(tenantId, phone) {
  const doc = await col(tenantId, 'sessions').doc(phone).get()
  return doc.exists ? doc.data() : null
}

async function saveSession(tenantId, phone, data) {
  await col(tenantId, 'sessions').doc(phone).set({
    ...data,
    updatedAt: new Date().toISOString()
  })
}

async function deleteSession(tenantId, phone) {
  await col(tenantId, 'sessions').doc(phone).delete()
}

// ─── CITAS ───────────────────────────────────────────────────

async function createAppointment(tenantId, data) {
  const ref = await col(tenantId, 'appointments').add({
    status: 'confirmed',
    ...data,
    createdAt: new Date().toISOString()
  })
  return ref.id
}

async function getAppointmentByPhone(tenantId, phone) {
  const snapshot = await col(tenantId, 'appointments')
    .where('clientPhone', '==', phone)
    .get()

  const now = labelNow().toISOString()
  const upcoming = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.status !== 'cancelled' && a.datetime >= now)
    .sort((a, b) => a.datetime.localeCompare(b.datetime))

  return upcoming[0] || null
}

async function getAppointmentsByPhone(tenantId, phone) {
  const snapshot = await col(tenantId, 'appointments')
    .where('clientPhone', '==', phone)
    .get()

  const now = labelNow().toISOString()
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.status !== 'cancelled' && a.datetime >= now)
    .sort((a, b) => a.datetime.localeCompare(b.datetime))
}

async function cancelAppointment(tenantId, appointmentId) {
  await col(tenantId, 'appointments').doc(appointmentId).update({
    status: 'cancelled',
    cancelledAt: new Date().toISOString()
  })
}

async function getUpcomingAppointments(tenantId, fromDate, toDate) {
  const snapshot = await col(tenantId, 'appointments')
    .where('status', '==', 'confirmed')
    .where('datetime', '>=', fromDate)
    .where('datetime', '<=', toDate)
    .where('reminderSent', '==', false)
    .get()

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function markReminderSent(tenantId, appointmentId) {
  await col(tenantId, 'appointments').doc(appointmentId).update({
    reminderSent: true
  })
}

// ─── SERVICIOS ───────────────────────────────────────────────

async function getServices(tenantId) {
  const snapshot = await col(tenantId, 'services')
    .where('active', '==', true)
    .orderBy('order')
    .get()

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// ─── HORARIOS ────────────────────────────────────────────────

async function getScheduleConfig(tenantId) {
  const doc = await col(tenantId, 'schedules').doc('default').get()
  return doc.exists ? doc.data() : null
}

async function getBlockedSlots(tenantId) {
  const snapshot = await col(tenantId, 'blockedSlots')
    .where('datetime', '>=', labelNow().toISOString())
    .get()

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// ─── CONFIGURACIÓN DEL BOT ───────────────────────────────────

async function getBotConfig(tenantId) {
  const doc = await col(tenantId, 'botConfig').doc('default').get()
  return doc.exists ? doc.data() : {
    keywords: ['cita', 'agendar', 'reservar', 'turno', 'hora'],
    reminderMinutes: 30,
    botActive: true,
    welcomeMessage: '¡Hola! 👋 Soy el asistente. ¿En qué te puedo ayudar?'
  }
}

// ─── USUARIOS DEL TENANT ─────────────────────────────────────

async function getUserByPhone(tenantId, phone) {
  const doc = await col(tenantId, 'users').doc(phone).get()
  return doc.exists ? { phone, ...doc.data() } : null
}

async function createUser(tenantId, phone, passwordHash) {
  await col(tenantId, 'users').doc(phone).set({
    phone,
    passwordHash,
    createdAt: new Date().toISOString()
  })
}

async function updateUserPassword(tenantId, phone, passwordHash) {
  await col(tenantId, 'users').doc(phone).update({
    passwordHash,
    updatedAt: new Date().toISOString()
  })
}

async function tenantUsersExist(tenantId) {
  const snap = await col(tenantId, 'users').limit(1).get()
  return !snap.empty
}

// ─── OTP ─────────────────────────────────────────────────────

async function saveOTP(tenantId, phone, code, expiresAt) {
  await col(tenantId, 'otp_codes').doc(phone).set({ code, expiresAt })
}

async function getOTP(tenantId, phone) {
  const doc = await col(tenantId, 'otp_codes').doc(phone).get()
  return doc.exists ? doc.data() : null
}

async function deleteOTP(tenantId, phone) {
  await col(tenantId, 'otp_codes').doc(phone).delete()
}

// ─── SUPER ADMIN ─────────────────────────────────────────────

async function getSuperAdmin(phone) {
  const db = getDb()
  const doc = await db.collection('superadmin').doc(phone).get()
  return doc.exists ? { phone, ...doc.data() } : null
}

async function createSuperAdmin(phone, passwordHash) {
  const db = getDb()
  await db.collection('superadmin').doc(phone).set({
    phone,
    passwordHash,
    role: 'superadmin',
    createdAt: new Date().toISOString()
  })
}

async function updateSuperAdminPassword(phone, passwordHash) {
  const db = getDb()
  await db.collection('superadmin').doc(phone).update({
    passwordHash,
    updatedAt: new Date().toISOString()
  })
}

// OTP del super admin se guarda dentro de su propio documento
async function saveSuperAdminOTP(phone, code, expiresAt) {
  const db = getDb()
  await db.collection('superadmin').doc(phone).set({ otp: { code, expiresAt } }, { merge: true })
}

async function getSuperAdminOTP(phone) {
  const db = getDb()
  const doc = await db.collection('superadmin').doc(phone).get()
  return doc.exists ? (doc.data().otp || null) : null
}

async function deleteSuperAdminOTP(phone) {
  const db = getDb()
  const { FieldValue } = require('firebase-admin/firestore')
  await db.collection('superadmin').doc(phone).update({ otp: FieldValue.delete() })
}

// ─── USER INDEX (login por teléfono global) ──────────────────

async function getUserIndex(phone) {
  const db = getDb()
  const doc = await db.collection('userIndex').doc(phone).get()
  return doc.exists ? doc.data() : null
}

async function setUserIndex(phone, tenantId) {
  const db = getDb()
  await db.collection('userIndex').doc(phone).set({ tenantId, role: 'admin' })
}

async function deleteUserIndex(phone) {
  const db = getDb()
  await db.collection('userIndex').doc(phone).delete()
}

// ─── GESTIÓN DE TENANTS ──────────────────────────────────────

async function createTenant(tenantId, data) {
  const db = getDb()
  await db.collection('tenants').doc(tenantId).set({
    ...data,
    active: true,
    createdAt: new Date().toISOString()
  })
}

async function getTenant(tenantId) {
  const db = getDb()
  const doc = await db.collection('tenants').doc(tenantId).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
}

async function listTenants() {
  const db = getDb()
  const snap = await db.collection('tenants').get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function getTenantByPhoneId(phoneNumberId) {
  const db = getDb()
  const snap = await db.collection('tenants')
    .where('phoneNumberId', '==', phoneNumberId)
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ...doc.data() }
}

async function updateTenant(tenantId, data) {
  const db = getDb()
  await db.collection('tenants').doc(tenantId).update({
    ...data,
    updatedAt: new Date().toISOString()
  })
}

module.exports = {
  // Clientes
  getClient,
  saveClient,
  // Sesiones
  getSession,
  saveSession,
  deleteSession,
  // Citas
  createAppointment,
  getAppointmentByPhone,
  getAppointmentsByPhone,
  cancelAppointment,
  getUpcomingAppointments,
  markReminderSent,
  // Servicios
  getServices,
  // Horarios
  getScheduleConfig,
  getBlockedSlots,
  // Config bot
  getBotConfig,
  // Usuarios tenant
  getUserByPhone,
  createUser,
  updateUserPassword,
  tenantUsersExist,
  // OTP
  saveOTP,
  getOTP,
  deleteOTP,
  // Super admin
  getSuperAdmin,
  createSuperAdmin,
  updateSuperAdminPassword,
  saveSuperAdminOTP,
  getSuperAdminOTP,
  deleteSuperAdminOTP,
  // User index
  getUserIndex,
  setUserIndex,
  deleteUserIndex,
  // Tenants
  createTenant,
  getTenant,
  listTenants,
  getTenantByPhoneId,
  updateTenant
}
