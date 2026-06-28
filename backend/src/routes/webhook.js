const express = require('express')
const router = express.Router()
const { handleMessage } = require('../bot/handler')
const db = require('../services/database')

// ─── VERIFICACIÓN DEL WEBHOOK (requerido por Meta) ────────────
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado por Meta')
    res.status(200).send(challenge)
  } else {
    console.warn('⚠️ Token de webhook incorrecto')
    res.sendStatus(403)
  }
})

// ─── RECIBIR MENSAJES ─────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.sendStatus(200) // Meta requiere respuesta rápida

  try {
    const body = req.body

    if (body.object !== 'whatsapp_business_account') return

    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    if (!value?.messages) return

    const message = value.messages[0]
    const phone = message.from

    // Identificar a qué tenant pertenece este número de WhatsApp
    const phoneNumberId = value.metadata?.phone_number_id
    if (!phoneNumberId) {
      console.warn('⚠️ Webhook sin phone_number_id en metadata')
      return
    }

    const tenant = await db.getTenantByPhoneId(phoneNumberId)
    if (!tenant || !tenant.active) {
      console.warn(`⚠️ Tenant no encontrado o inactivo para phoneNumberId: ${phoneNumberId}`)
      return
    }

    // Extraer texto del mensaje
    let messageText
    if (message.type === 'text') {
      messageText = message.text.body
    } else if (message.type === 'interactive') {
      const { type } = message.interactive
      if (type === 'button_reply') {
        messageText = message.interactive.button_reply.id
      } else if (type === 'list_reply') {
        messageText = message.interactive.list_reply.id
      } else {
        return
      }
    } else {
      return
    }

    const maskedPhone = phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4)
    console.log(`📩 [${tenant.name}] Mensaje de ${maskedPhone}`)

    const waConfig = { token: tenant.whatsappToken, phoneId: tenant.phoneNumberId }
    await handleMessage(phone, messageText, tenant.id, waConfig)
  } catch (error) {
    console.error('❌ Error procesando webhook:', error.message)
  }
})

module.exports = router
