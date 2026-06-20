const express = require('express')
const router = express.Router()
const db = require('../services/database')

// POST /auth/login — no requiere API key
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' })
    }

    const authConfig = await db.getAuthConfig()
    let valid = false

    if (authConfig) {
      valid = username === authConfig.username && password === authConfig.password
    } else {
      // Sin config en Firebase: credenciales por defecto
      valid = username === 'admin' && password === 'admin'
    }

    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    }

    res.json({ success: true, apiKey: process.env.BARBER_API_KEY })
  } catch (error) {
    console.error('❌ Error en login:', error.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /auth/change-password — requiere API key válida
router.post('/auth/change-password', async (req, res) => {
  const apiKey = req.headers['x-api-key']
  if (apiKey !== process.env.BARBER_API_KEY) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  try {
    const { currentPassword, newPassword, newUsername } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' })
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' })
    }

    const authConfig = await db.getAuthConfig()
    const currentUsername = authConfig?.username || 'admin'
    const expectedPassword = authConfig ? authConfig.password : 'admin'

    if (currentPassword !== expectedPassword) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    }

    await db.setAuthPassword(newUsername || currentUsername, newPassword)
    res.json({ success: true })
  } catch (error) {
    console.error('❌ Error cambiando contraseña:', error.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
