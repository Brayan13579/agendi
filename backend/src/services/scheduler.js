const { getScheduleConfig, getBlockedSlots } = require('./database')
const { getDb } = require('../config/firebase')

const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

// Formatear fecha legible en español
function formatDate(date) {
  const d = new Date(date)
  const day = DAYS[d.getDay()]
  const num = d.getDate()
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${day.charAt(0).toUpperCase() + day.slice(1)} ${num} de ${months[d.getMonth()]}`
}

// Formatear hora legible
function formatTime(hour, minute) {
  const h = hour % 12 || 12
  const m = minute === 0 ? '00' : minute
  const ampm = hour < 12 ? 'am' : 'pm'
  return `${h}:${m} ${ampm}`
}

// Obtener slots disponibles para los próximos N días
async function getAvailableSlots(barberId = 'default', daysAhead = 3, serviceDuration = null) {
  const config = await getScheduleConfig(barberId)
  if (!config) return []

  const blockedSlots = await getBlockedSlots(barberId)
  const blockedDatetimes = new Set(blockedSlots.map(b => b.datetime))

  // Obtener citas ya agendadas (sin filtro != para evitar índice compuesto)
  const db = getDb()
  const now = new Date()
  const snapshot = await db.collection('appointments')
    .where('barberId', '==', barberId)
    .where('datetime', '>=', now.toISOString())
    .get()

  const bookedDatetimes = new Set(
    snapshot.docs
      .filter(d => d.data().status !== 'cancelled')
      .map(d => d.data().datetime)
  )

  const availableSlots = []
  const slotDurationMinutes = serviceDuration || config.slotDuration || 30

  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    const date = new Date()
    date.setDate(date.getDate() + dayOffset)
    date.setSeconds(0, 0)

    const dayName = DAYS[date.getDay()]
    const dayConfig = config.weeklySchedule?.[dayName]

    // Si el día no está configurado o está bloqueado, saltarlo
    if (!dayConfig || !dayConfig.active) continue

    const [startHour, startMin] = dayConfig.start.split(':').map(Number)
    const [endHour, endMin] = dayConfig.end.split(':').map(Number)

    let currentHour = startHour
    let currentMin = startMin

    // Si es hoy, comenzar desde ahora + 1 hora de margen
    if (dayOffset === 0) {
      const minTime = new Date()
      minTime.setMinutes(minTime.getMinutes() + 60)
      if (minTime.getHours() > startHour ||
          (minTime.getHours() === startHour && minTime.getMinutes() > startMin)) {
        currentHour = minTime.getHours()
        currentMin = Math.ceil(minTime.getMinutes() / slotDurationMinutes) * slotDurationMinutes
        if (currentMin >= 60) { currentHour++; currentMin = 0 }
      }
    }

    const daySlots = []

    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMin < endMin)
    ) {
      const slotDate = new Date(date)
      slotDate.setHours(currentHour, currentMin, 0, 0)
      const isoString = slotDate.toISOString()

      if (!blockedDatetimes.has(isoString) && !bookedDatetimes.has(isoString)) {
        daySlots.push({
          datetime: isoString,
          label: formatTime(currentHour, currentMin),
          dateLabel: formatDate(slotDate)
        })
      }

      currentMin += slotDurationMinutes
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60)
        currentMin = currentMin % 60
      }
    }

    if (daySlots.length > 0) {
      availableSlots.push({
        date: formatDate(date),
        isoDate: date.toISOString().split('T')[0],
        slots: daySlots
      })
    }
  }

  return availableSlots
}

// Formatear lista de días disponibles para que el cliente elija uno
function formatDaysMessage(availableDays) {
  let message = '📅 *¿Qué día te viene bien?*\n\n'

  availableDays.forEach((day, i) => {
    const n = day.slots.length
    message += `*${i + 1}.* ${day.date}  _(${n} horario${n === 1 ? '' : 's'} libre${n === 1 ? '' : 's'})_\n`
  })

  message += '\n_Responde con el número del día que prefieras._'
  return { message }
}

// Formatear los horarios disponibles de un día específico
function formatDaySlotsMessage(day) {
  let message = `🕐 *Horarios para ${day.date}*\n\n`

  day.slots.forEach((slot, i) => {
    message += `*${i + 1}.* ${slot.label}\n`
  })

  message += '\n_Responde con el número del horario que prefieras, o escribe *atrás* para elegir otro día._'
  return { message }
}

// Obtener el horario completo de un día: todos los slots (libres, ocupados y citas)
async function getDaySchedule(barberId = 'default', dateStr) {
  const config = await getScheduleConfig(barberId)
  if (!config) return { dayActive: false, slots: [] }

  const date = new Date(`${dateStr}T00:00:00`)
  const dayName = DAYS[date.getDay()]
  const dayConfig = config.weeklySchedule?.[dayName]

  if (!dayConfig || !dayConfig.active) return { dayActive: false, slots: [] }

  const slotDuration = config.slotDuration || 30
  const [startHour, startMin] = dayConfig.start.split(':').map(Number)
  const [endHour, endMin] = dayConfig.end.split(':').map(Number)

  const db = getDb()
  const start = new Date(`${dateStr}T00:00:00`)
  const end = new Date(`${dateStr}T23:59:59.999`)

  const apptSnapshot = await db.collection('appointments')
    .where('datetime', '>=', start.toISOString())
    .where('datetime', '<=', end.toISOString())
    .get()

  const appointmentsByDatetime = new Map()
  apptSnapshot.docs.forEach(doc => {
    const data = doc.data()
    if (data.status !== 'cancelled') {
      appointmentsByDatetime.set(data.datetime, { id: doc.id, ...data })
    }
  })

  const blockedSnapshot = await db.collection('blockedSlots')
    .where('barberId', '==', barberId)
    .where('datetime', '>=', start.toISOString())
    .where('datetime', '<=', end.toISOString())
    .get()

  const blockedByDatetime = new Map()
  blockedSnapshot.docs.forEach(doc => {
    blockedByDatetime.set(doc.data().datetime, { id: doc.id, ...doc.data() })
  })

  const slots = []
  let currentHour = startHour
  let currentMin = startMin

  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const slotDate = new Date(date)
    slotDate.setHours(currentHour, currentMin, 0, 0)
    const isoString = slotDate.toISOString()

    let status = 'free'
    let appointment = null
    let blockedId = null

    if (appointmentsByDatetime.has(isoString)) {
      status = 'booked'
      appointment = appointmentsByDatetime.get(isoString)
    } else if (blockedByDatetime.has(isoString)) {
      status = 'blocked'
      blockedId = blockedByDatetime.get(isoString).id
    }

    slots.push({
      datetime: isoString,
      time: formatTime(currentHour, currentMin),
      status,
      appointment,
      blockedId
    })

    currentMin += slotDuration
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60)
      currentMin = currentMin % 60
    }
  }

  return { dayActive: true, slots }
}

module.exports = { getAvailableSlots, getDaySchedule, formatDaysMessage, formatDaySlotsMessage, formatDate, formatTime }
