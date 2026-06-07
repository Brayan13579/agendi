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

    // Solo procesar mensajes de texto por ahora
    if (message.type !== 'text') {
      // Puedes agregar soporte para audio/imagen después
      return
    }

    const text = message.text.body
    console.log(`📩 Mensaje de ${phone}: ${text}`)

    await handleMessage(phone, text)
  } catch (error) {
    console.error('❌ Error procesando webhook:', error.message)
  }
})

module.exports = router
