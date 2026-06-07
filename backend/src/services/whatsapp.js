const axios = require('axios')

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`

// Cabeceras para todas las peticiones
const headers = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json'
})

// Enviar mensaje de texto simple
async function sendText(to, message) {
  try {
    await axios.post(WHATSAPP_API_URL, {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message }
    }, { headers: headers() })
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.response?.data || error.message)
  }
}

// Enviar lista de opciones numeradas (más fácil para el cliente)
async function sendOptions(to, title, options) {
  const optionsList = options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')
  await sendText(to, `${title}\n\n${optionsList}\n\n_Responde con el número de tu opción._`)
}

// Enviar confirmación de cita con todos los datos
async function sendConfirmation(to, appointment) {
  const message =
    `✅ *Cita confirmada*\n\n` +
    `👤 ${appointment.clientName}\n` +
    `✂️  ${appointment.service}\n` +
    `📅 ${appointment.date}\n` +
    `🕐 ${appointment.time}\n\n` +
    `Para cancelar escribe *cancelar* en cualquier momento.`

  await sendText(to, message)
}

// Enviar recordatorio antes de la cita
async function sendReminder(to, appointment) {
  const minutes = process.env.REMINDER_MINUTES || 30
  const message =
    `⏰ *Recordatorio*\n\n` +
    `Hola ${appointment.clientName}, tu cita es en ${minutes} minutos.\n\n` +
    `✂️  ${appointment.service}\n` +
    `🕐 ${appointment.time}\n\n` +
    `¡Te esperamos!`

  await sendText(to, message)
}

// Notificar al cliente que el barbero canceló y puede reagendar
async function sendBarberCancellation(to, clientName, reason) {
  const message =
    `😔 Hola ${clientName}, lamentablemente tu barbero tuvo un inconveniente.\n\n` +
    (reason ? `📝 Motivo: ${reason}\n\n` : '') +
    `Para reagendar escribe *cita* cuando quieras.`

  await sendText(to, message)
}

module.exports = {
  sendText,
  sendOptions,
  sendConfirmation,
  sendReminder,
  sendBarberCancellation
}
