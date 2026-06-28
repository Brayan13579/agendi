const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { randomInt } = require('crypto')
const db = require('../services/database')
const wa = require('../services/whatsapp')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET no está configurado en las variables de entorno')

const JWT_EXPIRES = '7d'
const OTP_TTL_MS = 5 * 60 * 1000
const BCRYPT_ROUNDS = 12

// POST /auth/login
// - Super admin: busca en colección superadmin/, devuelve role:'superadmin'
// - Admin de negocio: busca en userIndex → tenantId → users, devuelve role:'admin'
router.post('/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) {
      return res.status(400).json({ error: 'Teléfono y contraseña requeridos' })
    }

    // Verificar si es super admin
    const superAdmin = await db.getSuperAdmin(phone)
    if (superAdmin) {
      const valid = await bcrypt.compare(password, superAdmin.passwordHash)
      if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

      const token = jwt.sign({ phone, role: 'superadmin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
      return res.json({ success: true, token, role: 'superadmin' })
    }

    // Admin de tenant: lookup global por teléfono
    const index = await db.getUserIndex(phone)
    if (!index) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const { tenantId } = index

    // Verificar que el tenant esté activo
    const tenant = await db.getTenant(tenantId)
    if (!tenant || !tenant.active) {
      return res.status(403).json({ error: 'Cuenta suspendida. Contacta al administrador.' })
    }

    const user = await db.getUserByPhone(tenantId, phone)
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.sign({ phone, tenantId, role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({ success: true, token, role: 'admin' })
  } catch (error) {
    console.error('❌ Error en login:', error.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /auth/request-otp — envía código de recuperación por WhatsApp
router.post('/auth/request-otp', async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ error: 'Teléfono requerido' })

    const code = String(randomInt(100000, 1000000))
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

    // Super admin
    const superAdmin = await db.getSuperAdmin(phone)
    if (superAdmin) {
      await db.saveSuperAdminOTP(phone, code, expiresAt)
      await wa.sendOTPCode(phone, code)
      return res.json({ success: true })
    }

    // Admin de tenant
    const index = await db.getUserIndex(phone)
    if (!index) return res.json({ success: true }) // No revelar si el número existe

    const tenant = await db.getTenant(index.tenantId)
    const waConfig = tenant ? { token: tenant.whatsappToken, phoneId: tenant.phoneNumberId } : {}

    await db.saveOTP(index.tenantId, phone, code, expiresAt)
    await wa.sendOTPCode(phone, code, waConfig)

    res.json({ success: true })
  } catch (error) {
    console.error('❌ Error enviando OTP:', error.message)
    res.status(500).json({ error: 'Error enviando el código' })
  }
})

// POST /auth/verify-otp — valida el código y devuelve token temporal para resetear contraseña
router.post('/auth/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body
    if (!phone || !code) {
      return res.status(400).json({ error: 'Teléfono y código requeridos' })
    }

    let otp = null
    let tenantId = null
    let isSuperAdmin = false

    const superAdmin = await db.getSuperAdmin(phone)
    if (superAdmin) {
      otp = await db.getSuperAdminOTP(phone)
      isSuperAdmin = true
    } else {
      const index = await db.getUserIndex(phone)
      if (index) {
        tenantId = index.tenantId
        otp = await db.getOTP(tenantId, phone)
      }
    }

    if (!otp) return res.status(400).json({ error: 'Código inválido o expirado' })

    if (new Date() > new Date(otp.expiresAt)) {
      if (isSuperAdmin) await db.deleteSuperAdminOTP(phone)
      else await db.deleteOTP(tenantId, phone)
      return res.status(400).json({ error: 'El código expiró. Solicita uno nuevo.' })
    }

    if (otp.code !== String(code)) {
      return res.status(400).json({ error: 'Código incorrecto' })
    }

    if (isSuperAdmin) await db.deleteSuperAdminOTP(phone)
    else await db.deleteOTP(tenantId, phone)

    // Token de un solo uso (15 min) para resetear contraseña
    const resetToken = jwt.sign(
      { phone, tenantId: isSuperAdmin ? '_superadmin' : tenantId, purpose: 'reset' },
      JWT_SECRET,
      { expiresIn: '15m' }
    )
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
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
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

    if (payload.tenantId === '_superadmin') {
      await db.updateSuperAdminPassword(payload.phone, hash)
    } else {
      await db.updateUserPassword(payload.tenantId, payload.phone, hash)
    }

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
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' })
    }

    let user
    if (payload.role === 'superadmin') {
      user = await db.getSuperAdmin(payload.phone)
    } else {
      user = await db.getUserByPhone(payload.tenantId, payload.phone)
    }

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' })

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    if (payload.role === 'superadmin') {
      await db.updateSuperAdminPassword(payload.phone, hash)
    } else {
      await db.updateUserPassword(payload.tenantId, payload.phone, hash)
    }

    res.json({ success: true })
  } catch (error) {
    console.error('❌ Error cambiando contraseña:', error.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
