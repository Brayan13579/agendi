const { getScheduleConfig, getBlockedSlots } = require('./database')
const { getDb } = require('../config/firebase')
const { labelNow } = require('../utils/time')

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

// ¿Se solapan los rangos [startA, endA) y [startB, endB)?
function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

// Obtener todos los intervalos ocupados (citas + bloqueos manuales) como rangos {start, end}
async function getBusyIntervals(barberId, baseSlotMinutes) {
  const db = getDb()
  const blockedSlots = await getBlockedSlots(barberId)

  const snapshot = await db.collection('appointments')
    .where('barberId', '==', barberId)
    .where('datetime', '>=', labelNow().toISOString())
    .get()

  const intervals = []

  for (const doc of snapshot.docs) {
    const appt = doc.data()
    if (appt.status === 'cancelled') continue
    const start = new Date(appt.datetime)
    intervals.push({ start, end: new Date(start.getTime() + (appt.duration || baseSlotMinutes) * 60000) })
  }

  for (const block of blockedSlots) {
    const start = new Date(block.datetime)
    intervals.push({ start, end: new Date(start.getTime() + (block.duration || baseSlotMinutes) * 60000) })
  }

  return intervals
}

// Obtener slots disponibles para los próximos N días
async function getAvailableSlots(barberId = 'default', daysAhead = 3, serviceDuration = null) {
  const config = await getScheduleConfig(barberId)
  if (!config) return []

  const baseSlotMinutes = config.slotDuration || 30
  const duration = serviceDuration || baseSlotMinutes
  const busyIntervals = await getBusyIntervals(barberId, baseSlotMinutes)

  const availableSlots = []

  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    // Usar labelNow() en vez de new Date() para obtener la fecha en hora Bogotá.
    // El servidor corre en UTC y después de las 7 PM Bogotá ya es medianoche UTC
    // (día siguiente), lo que haría que el loop empiece en el día equivocado.
    const date = labelNow()
    date.setDate(date.getDate() + dayOffset)
    date.setSeconds(0, 0)

    const dayName = DAYS[date.getDay()]
    const dayConfig = config.weeklySchedule?.[dayName]

    // Si el día no está configurado o está bloqueado, saltarlo
    if (!dayConfig || !dayConfig.active) continue

    const [startHour, startMin] = dayConfig.start.split(':').map(Number)
    const [endHour, endMin] = dayConfig.end.split(':').map(Number)

    const dayEnd = new Date(date)
    dayEnd.setHours(endHour, endMin, 0, 0)

    let cursor = new Date(date)
    cursor.setHours(startHour, startMin, 0, 0)

    // Si es hoy, comenzar desde ahora + 1 hora de margen, redondeado al slot base.
    // El servidor corre en UTC pero las horas del horario están pensadas en hora de
    // Bogotá (UTC-5), así que se usa labelNow() para comparar en la misma convención.
    if (dayOffset === 0) {
      const minStart = labelNow()
      minStart.setMinutes(minStart.getMinutes() + 30)
      const minutesSinceMidnight = minStart.getHours() * 60 + minStart.getMinutes()
      const roundedMinutes = Math.ceil(minutesSinceMidnight / baseSlotMinutes) * baseSlotMinutes
      const minStartRounded = new Date(date)
      minStartRounded.setHours(0, roundedMinutes, 0, 0)
      if (minStartRounded > cursor) cursor = minStartRounded
    }

    const daySlots = []

    while (cursor.getTime() + duration * 60000 <= dayEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + duration * 60000)
      const isBusy = busyIntervals.some(b => overlaps(cursor, slotEnd, b.start, b.end))

      if (!isBusy) {
        daySlots.push({
          datetime: cursor.toISOString(),
          label: formatTime(cursor.getHours(), cursor.getMinutes()),
          dateLabel: formatDate(cursor)
        })
      }

      cursor = new Date(cursor.getTime() + baseSlotMinutes * 60000)
    }

    if (daySlots.length > 0) {
      availableSlots.push({
        date: formatDate(date),
        isoDate: date.toISOString().split('T')[0],
        slots: daySlots
      })
    }
  }

  return availableSlots.slice(0, 10)
}

// Verificar justo antes de confirmar si un horario sigue libre (bloqueo manual o cita de otro cliente)
async function isSlotTaken(barberId, datetime, duration) {
  const config = await getScheduleConfig(barberId)
  const baseSlotMinutes = config?.slotDuration || 30
  const slotDuration = duration || baseSlotMinutes

  const start = new Date(datetime)
  const end = new Date(start.getTime() + slotDuration * 60000)

  const busyIntervals = await getBusyIntervals(barberId, baseSlotMinutes)
  return busyIntervals.some(b => overlaps(start, end, b.start, b.end))
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

  const appointments = apptSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(a => a.status !== 'cancelled')

  const blockedSnapshot = await db.collection('blockedSlots')
    .where('barberId', '==', barberId)
    .where('datetime', '>=', start.toISOString())
    .where('datetime', '<=', end.toISOString())
    .get()

  const blocked = blockedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

  const slots = []
  let cursor = new Date(date)
  cursor.setHours(startHour, startMin, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(endHour, endMin, 0, 0)

  while (cursor < dayEnd) {
    const isoString = cursor.toISOString()
    const cellEnd = new Date(cursor.getTime() + slotDuration * 60000)

    // ¿Una cita empieza justo en este horario? Ocupa tantas franjas como dure.
    const appt = appointments.find(a => a.datetime === isoString)
    if (appt) {
      const apptEnd = new Date(cursor.getTime() + (appt.duration || slotDuration) * 60000)
      slots.push({
        datetime: isoString,
        time: formatTime(cursor.getHours(), cursor.getMinutes()),
        endTime: formatTime(apptEnd.getHours(), apptEnd.getMinutes()),
        status: 'booked',
        appointment: appt,
        blockedId: null
      })
      cursor = apptEnd
      continue
    }

    // ¿Un bloqueo manual empieza justo en este horario?
    const block = blocked.find(b => b.datetime === isoString)
    if (block) {
      const blockEnd = new Date(cursor.getTime() + (block.duration || slotDuration) * 60000)
      slots.push({
        datetime: isoString,
        time: formatTime(cursor.getHours(), cursor.getMinutes()),
        endTime: formatTime(blockEnd.getHours(), blockEnd.getMinutes()),
        status: 'blocked',
        appointment: null,
        blockedId: block.id
      })
      cursor = blockEnd
      continue
    }

    // ¿Esta franja ya quedó cubierta por una cita o bloqueo que empezó antes? Saltarla.
    const insideAppt = appointments.some(a => {
      const aStart = new Date(a.datetime)
      const aEnd = new Date(aStart.getTime() + (a.duration || slotDuration) * 60000)
      return cursor >= aStart && cursor < aEnd
    })
    const insideBlock = blocked.some(b => {
      const bStart = new Date(b.datetime)
      const bEnd = new Date(bStart.getTime() + (b.duration || slotDuration) * 60000)
      return cursor >= bStart && cursor < bEnd
    })

    if (!insideAppt && !insideBlock) {
      slots.push({
        datetime: isoString,
        time: formatTime(cursor.getHours(), cursor.getMinutes()),
        endTime: formatTime(cellEnd.getHours(), cellEnd.getMinutes()),
        status: 'free',
        appointment: null,
        blockedId: null
      })
    }

    cursor = cellEnd
  }

  return { dayActive: true, slots }
}

module.exports = { getAvailableSlots, getDaySchedule, isSlotTaken, formatDaysMessage, formatDaySlotsMessage, formatDate, formatTime }
