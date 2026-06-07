const cron = require('node-cron')
const { getDb } = require('../config/firebase')
const wa = require('../services/whatsapp')

let isRunning = false // Evita ejecuciones simultáneas

function startReminderCron() {
  cron.schedule('* * * * *', async () => {
    // Si la ejecución anterior no terminó, saltar esta
    if (isRunning) return
    isRunning = true

    try {
      await checkReminders()
    } catch (error) {
      console.error('❌ Error inesperado en cron:', error.message)
    } finally {
      isRunning = false
    }
  })

  console.log('⏰ Cron de recordatorios iniciado')
}

async function checkReminders() {
  const db = getDb()

  // Obtener configuración del recordatorio
  let reminderMinutes = 30
  try {
    const configDoc = await db.collection('botConfig').doc('default').get()
    if (configDoc.exists) {
      reminderMinutes = configDoc.data().reminderMinutes || 30
    }
  } catch {
    // Si no se puede leer la config, usar valor por defecto
  }

  // Ventana de tiempo: ±1 minuto alrededor del tiempo objetivo
  const now = new Date()
  const targetTime = new Date(now.getTime() + reminderMinutes * 60 * 1000)
  const from = new Date(targetTime.getTime() - 60 * 1000).toISOString()
  const to   = new Date(targetTime.getTime() + 60 * 1000).toISOString()

  // Query simple — solo campos necesarios
  let snapshot
  try {
    snapshot = await db.collection('appointments')
      .where('status', '==', 'confirmed')
      .where('reminderSent', '==', false)
      .where('datetime', '>=', from)
      .where('datetime', '<=', to)
      .get()
  } catch (error) {
    console.error('❌ Error en query de recordatorios:', error.message)
    if (error.message.includes('FAILED_PRECONDITION')) {
      console.info('💡 Crea el índice compuesto en Firebase Console: status + reminderSent + datetime')
    }
    return
  }

  if (snapshot.empty) return

  console.log(`⏰ Enviando ${snapshot.size} recordatorio(s)...`)

  for (const doc of snapshot.docs) {
    const appointment = doc.data()

    if (!appointment.clientPhone || !appointment.clientName) {
      console.warn(`⚠️ Cita ${doc.id} sin datos de cliente, saltando.`)
      continue
    }

    try {
      // Marcar como enviado ANTES de enviar para evitar duplicados
      await db.collection('appointments').doc(doc.id).update({ reminderSent: true })

      await wa.sendReminder(appointment.clientPhone, appointment)
      console.log(`✅ Recordatorio enviado a ${appointment.clientName}`)

    } catch (error) {
      console.error(`❌ Error con ${appointment.clientName}:`, error.message)

      // Revertir el flag para reintentarlo en el próximo ciclo
      try {
        await db.collection('appointments').doc(doc.id).update({ reminderSent: false })
      } catch {
        // Silencioso — mejor no reenviar que romper el servidor
      }
    }
  }
}

module.exports = { startReminderCron }
