const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { getDb } = require('../config/firebase')
const db = require('../services/database')
const wa = require('../services/whatsapp')
const scheduler = require('../services/scheduler')

const JWT_SECRET = process.env.JWT_SECRET || 'agendi_dev_secret_changeme'

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    jwt.verify(authHeader.slice(7), JWT_SECRET)
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
    const firestore = getDb()
    const { date, status } = req.query

    let query = firestore.collection('appointments')
      .orderBy('datetime')

    if (date) {
      const start = new Date(date)
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
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/appointments/:id/status
router.patch('/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body // confirmed | cancelled

    const firestore = getDb()
    await firestore.collection('appointments').doc(id).update({
      status,
      updatedAt: new Date().toISOString()
    })

    // Si el barbero cancela, notificar al cliente
    if (status === 'cancelled') {
      const doc = await firestore.collection('appointments').doc(id).get()
      const appointment = doc.data()
      await wa.sendBarberCancellation(
        appointment.clientPhone,
        appointment.clientName,
        req.body.reason || null
      )
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ─── SERVICIOS ───────────────────────────────────────────────

// GET /api/services
router.get('/services', async (req, res) => {
  try {
    const services = await db.getServices()
    res.json({ services })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/services
router.post('/services', async (req, res) => {
  try {
    const { name, price, duration, active = true } = req.body
    const firestore = getDb()
    const snapshot = await firestore.collection('services').get()
    const ref = await firestore.collection('services').add({
      name, price, duration, active,
      order: snapshot.size,
      createdAt: new Date().toISOString()
    })
    res.json({ id: ref.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/services/:id
router.put('/services/:id', async (req, res) => {
  try {
    const firestore = getDb()
    await firestore.collection('services').doc(req.params.id).update(req.body)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/services/:id (solo desactiva)
router.delete('/services/:id', async (req, res) => {
  try {
    const firestore = getDb()
    await firestore.collection('services').doc(req.params.id).update({ active: false })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ─── HORARIOS ────────────────────────────────────────────────

// GET /api/day-schedule?date=2024-01-15 — todos los horarios del día (libres, ocupados, citas)
router.get('/day-schedule', async (req, res) => {
  try {
    const { date } = req.query
    if (!date) return res.status(400).json({ error: 'Falta el parámetro date' })

    const result = await scheduler.getDaySchedule('default', date)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/schedule
router.get('/schedule', async (req, res) => {
  try {
    const config = await db.getScheduleConfig()
    res.json({ schedule: config })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/schedule
router.put('/schedule', async (req, res) => {
  try {
    const firestore = getDb()
    await firestore.collection('schedules').doc('default').set(req.body, { merge: true })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ─── BLOQUEOS ─────────────────────────────────────────────────

// POST /api/blocked-slots  — bloquear horas o días completos
router.post('/blocked-slots', async (req, res) => {
  try {
    const { datetime, reason, isFullDay = false } = req.body
    const firestore = getDb()
    const ref = await firestore.collection('blockedSlots').add({
      barberId: 'default',
      datetime,
      reason,
      isFullDay,
      createdAt: new Date().toISOString()
    })
    res.json({ id: ref.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/blocked-slots/:id
router.delete('/blocked-slots/:id', async (req, res) => {
  try {
    const firestore = getDb()
    await firestore.collection('blockedSlots').doc(req.params.id).delete()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ─── ALERTA URGENTE ───────────────────────────────────────────

// POST /api/urgent-alert — cancela todas las citas del día y avisa a clientes
router.post('/urgent-alert', async (req, res) => {
  try {
    const { reason, date } = req.body
    const firestore = getDb()

    const targetDate = date || new Date().toISOString().split('T')[0]
    const start = new Date(targetDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(targetDate)
    end.setHours(23, 59, 59, 999)

    const snapshot = await firestore.collection('appointments')
      .where('status', '==', 'confirmed')
      .get()

    const startISO = start.toISOString()
    const endISO = end.toISOString()
    const targets = snapshot.docs.filter(doc => {
      const dt = doc.data().datetime
      return dt >= startISO && dt <= endISO
    })

    let notified = 0
    for (const doc of targets) {
      const appointment = doc.data()
      await firestore.collection('appointments').doc(doc.id).update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelReason: reason
      })
      await wa.sendBarberCancellation(appointment.clientPhone, appointment.clientName, reason)
      notified++
    }

    res.json({ success: true, notified })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ─── CONFIGURACIÓN DEL BOT ───────────────────────────────────

// GET /api/bot-config
router.get('/bot-config', async (req, res) => {
  try {
    const config = await db.getBotConfig()
    res.json({ config })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/bot-config
router.put('/bot-config', async (req, res) => {
  try {
    const firestore = getDb()
    await firestore.collection('botConfig').doc('default').set(req.body, { merge: true })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
