const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { getDb } = require('../config/firebase')
const db = require('../services/database')
const wa = require('../services/whatsapp')
const scheduler = require('../services/scheduler')

const JWT_SECRET = process.env.JWT_SECRET

// Helper: colección dentro del tenant autenticado
function col(tenantId, collectionName) {
  return getDb().collection('tenants').doc(tenantId).collection(collectionName)
}

const VALID_STATUSES = ['confirmed', 'cancelled', 'pending']

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET)
    req.user = payload
    req.tenantId = payload.tenantId

    // Los admins de tenant deben tener tenantId en su JWT
    if (!req.tenantId) {
      return res.status(403).json({ error: 'Acceso no permitido desde este panel' })
    }
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión expirada. Inicia sesión de nuevo.' })
  }
}

router.use(authMiddleware)

// ─── CITAS ───────────────────────────────────────────────────

// GET /api/appointments?date=2024-01-15
router.get('/appointments', async (req, res) => {
  try {
    const { date, status } = req.query

    let query = col(req.tenantId, 'appointments').orderBy('datetime')

    if (date) {
      const start = new Date(date)
      if (isNaN(start.getTime())) {
        return res.status(400).json({ error: 'Fecha inválida' })
      }
      start.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      query = query
        .where('datetime', '>=', start.toISOString())
        .where('datetime', '<=', end.toISOString())
    }

    if (status) {
      query = query.where('status', '==', status)
    }

    const snapshot = await query.get()
    const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    res.json({ appointments })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// PATCH /api/appointments/:id/status
router.patch('/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status, reason } = req.body

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' })
    }

    await col(req.tenantId, 'appointments').doc(id).update({
      status,
      updatedAt: new Date().toISOString()
    })

    if (status === 'cancelled') {
      const doc = await col(req.tenantId, 'appointments').doc(id).get()
      if (doc.exists) {
        const appointment = doc.data()
        const tenant = await db.getTenant(req.tenantId)
        const waConfig = tenant ? { token: tenant.whatsappToken, phoneId: tenant.phoneNumberId } : {}
        await wa.sendBarberCancellation(
          appointment.clientPhone,
          appointment.clientName,
          reason || null,
          waConfig
        )
      }
    }

    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ─── SERVICIOS ───────────────────────────────────────────────

// GET /api/services
router.get('/services', async (req, res) => {
  try {
    const services = await db.getServices(req.tenantId)
    res.json({ services })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /api/services
router.post('/services', async (req, res) => {
  try {
    const { name, price, duration, active = true } = req.body
    if (!name || price == null || !duration) {
      return res.status(400).json({ error: 'name, price y duration son requeridos' })
    }

    const snapshot = await col(req.tenantId, 'services').get()
    const ref = await col(req.tenantId, 'services').add({
      name, price, duration, active,
      order: snapshot.size,
      createdAt: new Date().toISOString()
    })
    res.json({ id: ref.id })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// PUT /api/services/:id
router.put('/services/:id', async (req, res) => {
  try {
    const { name, price, duration, active, order } = req.body
    const update = {}
    if (name !== undefined) update.name = name
    if (price !== undefined) update.price = price
    if (duration !== undefined) update.duration = duration
    if (active !== undefined) update.active = active
    if (order !== undefined) update.order = order
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' })
    }
    await col(req.tenantId, 'services').doc(req.params.id).update(update)
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// DELETE /api/services/:id (desactiva)
router.delete('/services/:id', async (req, res) => {
  try {
    await col(req.tenantId, 'services').doc(req.params.id).update({ active: false })
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ─── HORARIOS ────────────────────────────────────────────────

// GET /api/day-schedule?date=2024-01-15
router.get('/day-schedule', async (req, res) => {
  try {
    const { date } = req.query
    if (!date) return res.status(400).json({ error: 'Falta el parámetro date' })

    const result = await scheduler.getDaySchedule(req.tenantId, date)
    res.json(result)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// GET /api/schedule
router.get('/schedule', async (req, res) => {
  try {
    const config = await db.getScheduleConfig(req.tenantId)
    res.json({ schedule: config })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// PUT /api/schedule
router.put('/schedule', async (req, res) => {
  try {
    const { weeklySchedule, slotDuration } = req.body
    const update = {}
    if (weeklySchedule !== undefined) update.weeklySchedule = weeklySchedule
    if (slotDuration !== undefined) update.slotDuration = slotDuration
    await col(req.tenantId, 'schedules').doc('default').set(update, { merge: true })
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ─── BLOQUEOS ─────────────────────────────────────────────────

// POST /api/blocked-slots
router.post('/blocked-slots', async (req, res) => {
  try {
    const { datetime, reason, isFullDay = false } = req.body
    if (!datetime) return res.status(400).json({ error: 'datetime es requerido' })

    const ref = await col(req.tenantId, 'blockedSlots').add({
      datetime,
      reason,
      isFullDay,
      createdAt: new Date().toISOString()
    })
    res.json({ id: ref.id })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// DELETE /api/blocked-slots/:id
router.delete('/blocked-slots/:id', async (req, res) => {
  try {
    await col(req.tenantId, 'blockedSlots').doc(req.params.id).delete()
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ─── ALERTA URGENTE ───────────────────────────────────────────

// POST /api/urgent-alert
router.post('/urgent-alert', async (req, res) => {
  try {
    const { reason, date } = req.body
    const targetDate = date || new Date().toISOString().split('T')[0]
    const start = new Date(targetDate)
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' })
    }
    start.setHours(0, 0, 0, 0)
    const end = new Date(targetDate)
    end.setHours(23, 59, 59, 999)

    const startISO = start.toISOString()
    const endISO = end.toISOString()
    const snapshot = await col(req.tenantId, 'appointments')
      .where('datetime', '>=', startISO)
      .where('datetime', '<=', endISO)
      .get()

    const targets = snapshot.docs.filter(doc => doc.data().status === 'confirmed')

    const tenant = await db.getTenant(req.tenantId)
    const waConfig = tenant ? { token: tenant.whatsappToken, phoneId: tenant.phoneNumberId } : {}

    let notified = 0
    for (const doc of targets) {
      const appointment = doc.data()
      await col(req.tenantId, 'appointments').doc(doc.id).update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelReason: reason
      })
      await wa.sendBarberCancellation(appointment.clientPhone, appointment.clientName, reason, waConfig)
      notified++
    }

    res.json({ success: true, notified })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ─── CONFIGURACIÓN DEL BOT ───────────────────────────────────

// GET /api/bot-config
router.get('/bot-config', async (req, res) => {
  try {
    const config = await db.getBotConfig(req.tenantId)
    res.json({ config })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// PUT /api/bot-config
router.put('/bot-config', async (req, res) => {
  try {
    const { botActive, keywords, reminderHours, reminderMinutes, welcomeMessage } = req.body
    const update = {}
    if (botActive !== undefined) update.botActive = botActive
    if (keywords !== undefined) update.keywords = keywords
    if (reminderHours !== undefined) update.reminderHours = reminderHours
    if (reminderMinutes !== undefined) update.reminderMinutes = reminderMinutes
    if (welcomeMessage !== undefined) update.welcomeMessage = welcomeMessage
    await col(req.tenantId, 'botConfig').doc('default').set(update, { merge: true })
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
