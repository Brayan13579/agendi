const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../services/database')
const wa = require('../services/whatsapp')

const JWT_SECRET = process.env.JWT_SECRET || 'agendi_dev_secret_changeme'
const JWT_EXPIRES = '7d'
const OTP_TTL_MS = 5 * 60 * 1000 // 5 minutos
const BCRYPT_ROUNDS = 12

// POST /auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) {
      return res.status(400).json({ error: 'Teléfono y contraseña requeridos' })
    }

    const user = await db.getUserByPhone(phone)
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({ success: true, token })
  } catch (error) {
    console.error('❌ Error en login:', error.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /auth/setup — solo funciona cuando no hay ningún usuario registrado
router.post('/auth/setup', async (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) {
      return res.status(400).json({ error: 'Teléfono y contraseña requeridos' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    const hayUsuarios = await db.usersExist()
    if (hayUsuarios) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada' })
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    await db.createUser(phone, hash)

    const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({ success: true, token })
  } catch (error) {
    console.error('❌ Error en setup:', error.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /auth/request-otp — envía código de 6 dígitos por WhatsApp
router.post('/auth/request-otp', async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ error: 'Teléfono requerido' })

    const user = await db.getUserByPhone(phone)
    // No revelar si el número existe o no (seguridad)
    if (!user) return res.json({ success: true })

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

    await db.saveOTP(phone, code, expiresAt)
    await wa.sendOTPCode(phone, code)

    res.json({ success: true })
  } catch (error) {
    console.error('❌ Error enviando OTP:', error.message)
    res.status(500).json({ error: 'Error enviando el código' })
  }
})

// POST /auth/verify-otp — valida el código y devuelve un token temporal para resetear contraseña
router.post('/auth/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body
    if (!phone || !code) {
      return res.status(400).json({ error: 'Teléfono y código requeridos' })
    }

    const otp = await db.getOTP(phone)
    if (!otp) {
      return res.status(400).json({ error: 'Código inválido o expirado' })
    }

    if (new Date() > new Date(otp.expiresAt)) {
      await db.deleteOTP(phone)
      return res.status(400).json({ error: 'El código expiró. Solicita uno nuevo.' })
    }

    if (otp.code !== String(code)) {
      return res.status(400).json({ error: 'Código incorrecto' })
    }

    await db.deleteOTP(phone)

    // Token de un solo uso con 15 min de validez, solo para resetear contraseña
    const resetToken = jwt.sign({ phone, purpose: 'reset' }, JWT_SECRET, { expiresIn: '15m' })
    res.json({ success: true, resetToken })
  } catch (error) {
    console.error('❌ Error verificando OTP:', error.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /auth/reset-password — requiere el resetToken del paso anterior
router.post('/auth/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Token y contraseña nueva requeridos' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    let payload
    try {
      payload = jwt.verify(resetToken, JWT_SECRET)
    } catch {
      return res.status(401).json({ error: 'El enlace de recuperación expiró. Intenta de nuevo.' })
    }

    if (payload.purpose !== 'reset') {
      return res.status(401).json({ error: 'Token inválido' })
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await db.updateUserPassword(payload.phone, hash)

    res.json({ success: true })
  } catch (error) {
    console.error('❌ Error reseteando contraseña:', error.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /auth/change-password — requiere sesión activa (JWT en Authorization header)
router.post('/auth/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' })
    }

    let payload
    try {
      payload = jwt.verify(authHeader.slice(7), JWT_SECRET)
    } catch {
      return res.status(401).json({ error: 'Sesión expirada' })
    }

    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Ambas contraseñas son requeridas' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' })
    }

    const user = await db.getUserByPhone(payload.phone)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await db.updateUserPassword(payload.phone, hash)

    res.json({ success: true })
  } catch (error) {
    console.error('❌ Error cambiando contraseña:', error.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
