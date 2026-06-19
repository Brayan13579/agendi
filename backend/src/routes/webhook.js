const express = require('express')
const router = express.Router()
const { handleMessage } = require('../bot/handler')

// ─── VERIFICACIÓN DEL WEBHOOK (requerido por Meta) ────────────
// Meta llama a este endpoint cuando configuras el webhook
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
  // Responder 200 inmediatamente (Meta requiere respuesta rápida)
  res.sendStatus(200)

  try {
    const body = req.body

    // Verificar que es un mensaje de WhatsApp
    if (body.object !== 'whatsapp_business_account') return

    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    // Solo procesar mensajes entrantes (no estados de entrega)
    if (!value?.messages) return

    const message = value.messages[0]
    const phone = message.from

    // Extraer texto de mensajes de texto e interactivos (botones / listas)
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

    console.log(`📩 Mensaje de ${phone}: ${messageText}`)

    await handleMessage(phone, messageText)
  } catch (error) {
    console.error('❌ Error procesando webhook:', error.message)
  }
})

module.exports = router
