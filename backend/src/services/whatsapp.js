const axios = require('axios')

// waConfig = { token, phoneId } — si no se pasa, usa las vars de entorno (fallback)
function getApiUrl(waConfig = {}) {
  const phoneId = waConfig.phoneId || process.env.WHATSAPP_PHONE_ID
  return `https://graph.facebook.com/v18.0/${phoneId}/messages`
}

function getHeaders(waConfig = {}) {
  const token = waConfig.token || process.env.WHATSAPP_TOKEN
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

async function sendText(to, message, waConfig = {}) {
  try {
    await axios.post(getApiUrl(waConfig), {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message }
    }, { headers: getHeaders(waConfig) })
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.response?.data || error.message)
  }
}

async function sendButtons(to, bodyText, buttons, waConfig = {}) {
  try {
    await axios.post(getApiUrl(waConfig), {
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
    }, { headers: getHeaders(waConfig) })
  } catch (error) {
    console.error('❌ Error enviando botones:', error.response?.data || error.message)
  }
}

// sections: [{ title, rows: [{ id, title, description? }] }]
async function sendList(to, bodyText, buttonLabel, sections, footer, waConfig = {}) {
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

    await axios.post(getApiUrl(waConfig), {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive
    }, { headers: getHeaders(waConfig) })
  } catch (error) {
    console.error('❌ Error enviando lista:', error.response?.data || error.message)
  }
}

async function sendConfirmation(to, appointment, waConfig = {}) {
  const message =
    `✅ *Cita confirmada*\n\n` +
    `👤 ${appointment.clientName}\n` +
    `✂️  ${appointment.service}\n` +
    `📅 ${appointment.date}\n` +
    `🕐 ${appointment.time}\n\n` +
    `Para cancelar escribe *cancelar* en cualquier momento.`
  await sendText(to, message, waConfig)
}

async function sendReminder(to, appointment, waConfig = {}) {
  const minutes = process.env.REMINDER_MINUTES || 30
  const message =
    `⏰ *Recordatorio*\n\n` +
    `Hola ${appointment.clientName}, tu cita es en ${minutes} minutos.\n\n` +
    `✂️  ${appointment.service}\n` +
    `🕐 ${appointment.time}\n\n` +
    `¡Te esperamos!`
  await sendText(to, message, waConfig)
}

async function sendBarberCancellation(to, clientName, reason, waConfig = {}) {
  const message =
    `😔 Hola ${clientName}, lamentablemente tu barbero tuvo un inconveniente.\n\n` +
    (reason ? `📝 Motivo: ${reason}\n\n` : '') +
    `Para reagendar escribe *cita* cuando quieras.`
  await sendText(to, message, waConfig)
}

async function sendOTPCode(phone, code, waConfig = {}) {
  const message =
    `🔐 *Código de verificación Agendi*\n\n` +
    `Tu código es: *${code}*\n\n` +
    `Válido por 5 minutos. No lo compartas con nadie.`
  await sendText(phone, message, waConfig)
}

module.exports = {
  sendText,
  sendButtons,
  sendList,
  sendConfirmation,
  sendReminder,
  sendBarberCancellation,
  sendOTPCode
}
