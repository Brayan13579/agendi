const cron = require('node-cron')
const db = require('../services/database')
const wa = require('../services/whatsapp')

let isRunning = false

function startReminderCron() {
  cron.schedule('* * * * *', async () => {
    if (isRunning) return
    isRunning = true

    try {
      await checkRemindersForAllTenants()
    } catch (error) {
      console.error('❌ Error inesperado en cron:', error.message)
    } finally {
      isRunning = false
    }
  })

  console.log('⏰ Cron de recordatorios iniciado')
}

async function checkRemindersForAllTenants() {
  let tenants
  try {
    tenants = await db.listTenants()
  } catch (error) {
    console.error('❌ Error obteniendo tenants para recordatorios:', error.message)
    return
  }

  const activeTenants = tenants.filter(t => t.active)
  if (activeTenants.length === 0) return

  await Promise.all(activeTenants.map(tenant => checkRemindersForTenant(tenant)))
}

async function checkRemindersForTenant(tenant) {
  const tenantId = tenant.id
  const waConfig = { token: tenant.whatsappToken, phoneId: tenant.phoneNumberId }

  let reminderMinutes = 30
  try {
    const config = await db.getBotConfig(tenantId)
    if (config.reminderHours != null) reminderMinutes = config.reminderHours * 60
    else if (config.reminderMinutes != null) reminderMinutes = config.reminderMinutes
  } catch {
    // Usar valor por defecto si no se puede leer la config
  }

  const now = new Date()
  const targetTime = new Date(now.getTime() + reminderMinutes * 60 * 1000)
  const from = new Date(targetTime.getTime() - 60 * 1000).toISOString()
  const to   = new Date(targetTime.getTime() + 60 * 1000).toISOString()

  let appointments
  try {
    appointments = await db.getUpcomingAppointments(tenantId, from, to)
  } catch (error) {
    console.error(`❌ [${tenantId}] Error en query de recordatorios:`, error.message)
    if (error.message.includes('FAILED_PRECONDITION')) {
      console.info('💡 Crea el índice compuesto en Firebase Console: status + reminderSent + datetime')
    }
    return
  }

  if (appointments.length === 0) return

  console.log(`⏰ [${tenant.name}] Enviando ${appointments.length} recordatorio(s)...`)

  for (const appointment of appointments) {
    if (!appointment.clientPhone || !appointment.clientName) {
      console.warn(`⚠️ Cita ${appointment.id} sin datos de cliente, saltando.`)
      continue
    }

    try {
      await db.markReminderSent(tenantId, appointment.id)
      await wa.sendReminder(appointment.clientPhone, appointment, waConfig)
      console.log(`✅ [${tenant.name}] Recordatorio enviado a ${appointment.clientName}`)
    } catch (error) {
      console.error(`❌ [${tenant.name}] Error con ${appointment.clientName}:`, error.message)
      try {
        // Revertir para reintentarlo en el próximo ciclo
        const { getDb } = require('../config/firebase')
        await getDb().collection('tenants').doc(tenantId)
          .collection('appointments').doc(appointment.id)
          .update({ reminderSent: false })
      } catch {
        // Silencioso
      }
    }
  }
}

module.exports = { startReminderCron }
