const axios = require('axios')

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`

const headers = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json'
})

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

// Botones de respuesta rápida — máx 3 botones, título máx 20 chars
async function sendButtons(to, bodyText, buttons) {
  try {
    await axios.post(WHATSAPP_API_URL, {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title }
          }))
        }
      }
    }, { headers: headers() })
  } catch (error) {
    console.error('❌ Error enviando botones:', error.response?.data || error.message)
  }
}

// Lista desplegable — máx 10 filas en total
// sections: [{ title, rows: [{ id, title, description? }] }]
async function sendList(to, bodyText, buttonLabel, sections, footer) {
  try {
    const interactive = {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonLabel,
        sections: sections.map(s => ({
          title: s.title,
          rows: s.rows.map(r => ({
            id: r.id,
            title: r.title,
            ...(r.description ? { description: r.description } : {})
          }))
        }))
      }
    }
    if (footer) interactive.footer = { text: footer }

    await axios.post(WHATSAPP_API_URL, {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive
    }, { headers: headers() })
  } catch (error) {
    console.error('❌ Error enviando lista:', error.response?.data || error.message)
  }
}

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

async function sendBarberCancellation(to, clientName, reason) {
  const message =
    `😔 Hola ${clientName}, lamentablemente tu barbero tuvo un inconveniente.\n\n` +
    (reason ? `📝 Motivo: ${reason}\n\n` : '') +
    `Para reagendar escribe *cita* cuando quieras.`
  await sendText(to, message)
}

module.exports = {
  sendText,
  sendButtons,
  sendList,
  sendConfirmation,
  sendReminder,
  sendBarberCancellation
}
