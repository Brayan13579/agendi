const { getScheduleConfig, getBlockedSlots } = require('./database')
const { getDb } = require('../config/firebase')
const { labelNow } = require('../utils/time')

const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function formatDate(date) {
  const d = new Date(date)
  const day = DAYS[d.getDay()]
  const num = d.getDate()
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${day.charAt(0).toUpperCase() + day.slice(1)} ${num} de ${months[d.getMonth()]}`
}

function formatTime(hour, minute) {
  const h = hour % 12 || 12
  const m = minute === 0 ? '00' : minute
  const ampm = hour < 12 ? 'am' : 'pm'
  return `${h}:${m} ${ampm}`
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

async function getBusyIntervals(tenantId, baseSlotMinutes) {
  const blockedSlots = await getBlockedSlots(tenantId)

  // Citas dentro del tenant — no se filtra por barberId ya que toda la colección
  // pertenece al tenant por diseño de la estructura de Firestore
  const snapshot = await getDb()
    .collection('tenants').doc(tenantId)
    .collection('appointments')
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

async function getAvailableSlots(tenantId, daysAhead = 3, serviceDuration = null) {
  const config = await getScheduleConfig(tenantId)
  if (!config) return []

  const baseSlotMinutes = config.slotDuration || 30
  const duration = serviceDuration || baseSlotMinutes
  const busyIntervals = await getBusyIntervals(tenantId, baseSlotMinutes)

  const availableSlots = []

  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    const date = labelNow()
    date.setDate(date.getDate() + dayOffset)
    date.setSeconds(0, 0)

    const dayName = DAYS[date.getDay()]
    const dayConfig = config.weeklySchedule?.[dayName]

    if (!dayConfig || !dayConfig.active) continue

    const [startHour, startMin] = dayConfig.start.split(':').map(Number)
    const [endHour, endMin] = dayConfig.end.split(':').map(Number)

    const dayEnd = new Date(date)
    dayEnd.setHours(endHour, endMin, 0, 0)

    let cursor = new Date(date)
    cursor.setHours(startHour, startMin, 0, 0)

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

async function isSlotTaken(tenantId, datetime, duration) {
  const config = await getScheduleConfig(tenantId)
  const baseSlotMinutes = config?.slotDuration || 30
  const slotDuration = duration || baseSlotMinutes

  const start = new Date(datetime)
  const end = new Date(start.getTime() + slotDuration * 60000)

  const busyIntervals = await getBusyIntervals(tenantId, baseSlotMinutes)
  return busyIntervals.some(b => overlaps(start, end, b.start, b.end))
}

async function getDaySchedule(tenantId, dateStr) {
  const config = await getScheduleConfig(tenantId)
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

  const tenantRef = db.collection('tenants').doc(tenantId)

  const apptSnapshot = await tenantRef.collection('appointments')
    .where('datetime', '>=', start.toISOString())
    .where('datetime', '<=', end.toISOString())
    .get()

  const appointments = apptSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(a => a.status !== 'cancelled')

  const blockedSnapshot = await tenantRef.collection('blockedSlots')
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

function formatDaysMessage(availableDays) {
  let message = '📅 *¿Qué día te viene bien?*\n\n'
  availableDays.forEach((day, i) => {
    const n = day.slots.length
    message += `*${i + 1}.* ${day.date}  _(${n} horario${n === 1 ? '' : 's'} libre${n === 1 ? '' : 's'})_\n`
  })
  message += '\n_Responde con el número del día que prefieras._'
  return { message }
}

function formatDaySlotsMessage(day) {
  let message = `🕐 *Horarios para ${day.date}*\n\n`
  day.slots.forEach((slot, i) => {
    message += `*${i + 1}.* ${slot.label}\n`
  })
  message += '\n_Responde con el número del horario que prefieras, o escribe *atrás* para elegir otro día._'
  return { message }
}

module.exports = { getAvailableSlots, getDaySchedule, isSlotTaken, formatDaysMessage, formatDaySlotsMessage, formatDate, formatTime }
