const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { randomBytes } = require('crypto')
const db = require('../services/database')

const JWT_SECRET = process.env.JWT_SECRET
const BCRYPT_ROUNDS = 12

function superadminMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET)
    if (payload.role !== 'superadmin') {
      return res.status(403).json({ error: 'Acceso restringido al super admin' })
    }
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión expirada' })
  }
}

router.use(superadminMiddleware)

// GET /superadmin/tenants — lista todos los negocios
router.get('/tenants', async (req, res) => {
  try {
    const tenants = await db.listTenants()
    // No exponer tokens de WhatsApp en el listado
    const safe = tenants.map(({ whatsappToken, ...rest }) => rest)
    res.json({ tenants: safe })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /superadmin/tenants — crear nuevo negocio con admin
router.post('/tenants', async (req, res) => {
  try {
    const { name, adminPhone, phoneNumberId, whatsappToken } = req.body
    if (!name || !adminPhone || !phoneNumberId || !whatsappToken) {
      return res.status(400).json({
        error: 'Campos requeridos: name, adminPhone, phoneNumberId, whatsappToken'
      })
    }

    // Generar tenantId a partir del nombre del negocio
    const tenantId = name
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const existing = await db.getTenant(tenantId)
    if (existing) {
      return res.status(409).json({
        error: 'Ya existe un negocio con ese nombre',
        suggestion: `Intenta con un nombre diferente o usa el ID: ${tenantId}-2`
      })
    }

    // Contraseña temporal aleatoria
    const tempPassword = randomBytes(4).toString('hex')
    const hash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS)

    // Crear el tenant y su admin
    await db.createTenant(tenantId, { name, adminPhone, phoneNumberId, whatsappToken })
    await db.createUser(tenantId, adminPhone, hash)
    await db.setUserIndex(adminPhone, tenantId)

    res.status(201).json({
      success: true,
      tenantId,
      adminPhone,
      tempPassword,
      message: `Negocio "${name}" creado. Comparte estas credenciales con el administrador.`
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// GET /superadmin/tenants/:id — detalle de un negocio (token redactado por seguridad)
router.get('/tenants/:id', async (req, res) => {
  try {
    const tenant = await db.getTenant(req.params.id)
    if (!tenant) return res.status(404).json({ error: 'Negocio no encontrado' })
    const { whatsappToken, ...safe } = tenant
    res.json({ tenant: { ...safe, hasWhatsappToken: !!whatsappToken } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// PUT /superadmin/tenants/:id — actualizar datos del negocio
router.put('/tenants/:id', async (req, res) => {
  try {
    const { name, phoneNumberId, whatsappToken, adminPhone } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (phoneNumberId !== undefined) updates.phoneNumberId = phoneNumberId
    if (whatsappToken) updates.whatsappToken = whatsappToken
    if (adminPhone !== undefined) updates.adminPhone = adminPhone

    await db.updateTenant(req.params.id, updates)
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// PATCH /superadmin/tenants/:id/active — activar o suspender
router.patch('/tenants/:id/active', async (req, res) => {
  try {
    const { active } = req.body
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active debe ser true o false' })
    }
    await db.updateTenant(req.params.id, { active })
    res.json({ success: true, active })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /superadmin/tenants/:id/reset-password — nueva contraseña temporal para el admin
router.post('/tenants/:id/reset-password', async (req, res) => {
  try {
    const tenant = await db.getTenant(req.params.id)
    if (!tenant) return res.status(404).json({ error: 'Negocio no encontrado' })

    const tempPassword = randomBytes(4).toString('hex')
    const hash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS)

    await db.updateUserPassword(req.params.id, tenant.adminPhone, hash)

    res.json({ success: true, tempPassword, adminPhone: tenant.adminPhone })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
