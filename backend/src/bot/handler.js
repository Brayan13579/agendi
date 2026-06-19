const db = require('../services/database')
const wa = require('../services/whatsapp')
const { getAvailableSlots, isSlotTaken } = require('../services/scheduler')

const STATES = {
  IDLE: 'idle',
  ASKING_NAME: 'asking_name',
  MAIN_MENU: 'main_menu',
  CHOOSING_SERVICE: 'choosing_service',
  CHOOSING_DAY: 'choosing_day',
  CHOOSING_SLOT: 'choosing_slot',
  CONFIRMING: 'confirming',
  CHANGING_NAME: 'changing_name'
}

const BOT_KEYWORDS = ['cita', 'agendar', 'reservar', 'turno', 'hora']

async function handleMessage(phone, messageText) {
  const text = messageText.trim().toLowerCase()

  const config = await db.getBotConfig()
  if (!config.botActive) return

  const session = await db.getSession(phone)
  const keywords = config.keywords || BOT_KEYWORDS
  const isKeyword = keywords.some(k => text.includes(k.toLowerCase()))

  if (!session && !isKeyword) return

  if ((text === 'cancelar' || text === 'cancel') && session?.state !== STATES.ASKING_NAME && session?.state !== STATES.CHANGING_NAME) {
    return handleCancel(phone)
  }

  if (!session) {
    return startFlow(phone, config)
  }

  if (isKeyword && session.state !== STATES.ASKING_NAME && session.state !== STATES.CHANGING_NAME) {
    const client = await db.getClient(phone)
    if (client) return showMainMenu(phone, client.name)
    return startFlow(phone, config)
  }

  switch (session.state) {
    case STATES.ASKING_NAME:    return handleName(phone, messageText, session)
    case STATES.MAIN_MENU:      return handleMainMenu(phone, text, session)
    case STATES.CHOOSING_SERVICE: return handleServiceChoice(phone, text, session)
    case STATES.CHOOSING_DAY:   return handleDayChoice(phone, text, session)
    case STATES.CHOOSING_SLOT:  return handleSlotChoice(phone, text, session)
    case STATES.CONFIRMING:     return handleConfirmation(phone, text, session)
    case STATES.CHANGING_NAME:  return handleChangingName(phone, messageText, session)
    default:                    return startFlow(phone, config)
  }
}

// ─── INICIO ──────────────────────────────────────────────────

async function startFlow(phone, config) {
  const client = await db.getClient(phone)
  if (!client) {
    await db.saveSession(phone, { state: STATES.ASKING_NAME })
    await wa.sendText(phone, `${config.welcomeMessage}\n\nPara empezar, ¿cuál es tu nombre? 😊`)
  } else {
    await showMainMenu(phone, client.name)
  }
}

// ─── NOMBRE ──────────────────────────────────────────────────

async function handleName(phone, name, session) {
  const cleanName = name.trim()
  const lower = cleanName.toLowerCase()

  if (cleanName.length < 2) {
    await wa.sendText(phone, 'Por favor escribe tu nombre completo. 😊')
    return
  }
  if (BOT_KEYWORDS.some(k => lower.includes(k))) {
    await wa.sendText(phone, 'Ese parece un mensaje, no un nombre 😄 ¿Cómo te llamas?')
    return
  }

  await db.saveClient(phone, cleanName)
  await db.saveSession(phone, { state: STATES.MAIN_MENU, clientName: cleanName })
  await showMainMenu(phone, cleanName)
}

// ─── MENÚ PRINCIPAL ──────────────────────────────────────────

async function showMainMenu(phone, clientName) {
  await db.saveSession(phone, { state: STATES.MAIN_MENU, clientName })
  await wa.sendList(
    phone,
    `¡Hola, ${clientName}! 👋 ¿Qué quieres hacer?`,
    'Ver opciones',
    [{
      title: 'Opciones',
      rows: [
        { id: 'menu_book',   title: '📅 Agendar cita' },
        { id: 'menu_view',   title: '🔍 Ver mi cita' },
        { id: 'menu_cancel', title: '❌ Cancelar cita' },
        { id: 'menu_rename', title: '✏️ Cambiar mi nombre' }
      ]
    }]
  )
}

async function handleMainMenu(phone, text, session) {
  if (text === 'menu_book' || text === '1' || text.includes('agendar')) {
    return startBooking(phone, session)
  } else if (text === 'menu_view' || text === '2' || text.includes('ver')) {
    return showCurrentAppointment(phone, session)
  } else if (text === 'menu_cancel' || text === '3') {
    return handleCancel(phone)
  } else if (text === 'menu_rename' || text === '4' || (text.includes('cambiar') && text.includes('nombre'))) {
    return startRename(phone, session)
  } else {
    await showMainMenu(phone, session.clientName)
  }
}

// ─── AGENDAR ─────────────────────────────────────────────────

async function startBooking(phone, session) {
  const services = await db.getServices()

  if (services.length === 0) {
    await wa.sendText(phone, 'Lo siento, no hay servicios disponibles en este momento. Intenta más tarde.')
    return db.deleteSession(phone)
  }

  await db.saveSession(phone, {
    state: STATES.CHOOSING_SERVICE,
    clientName: session.clientName,
    services
  })

  await wa.sendList(
    phone,
    '✂️ ¿Qué servicio quieres?',
    'Ver servicios',
    [{
      title: 'Servicios',
      rows: services.slice(0, 10).map((s, i) => ({
        id: `svc_${i}`,
        title: s.name,
        description: `$${s.price} · ${s.duration} min`
      }))
    }]
  )
}

async function handleServiceChoice(phone, text, session) {
  const services = session.services
  let index

  if (text.startsWith('svc_')) {
    index = parseInt(text.replace('svc_', ''))
  } else {
    index = parseInt(text) - 1
  }

  if (isNaN(index) || index < 0 || index >= services.length) {
    await wa.sendText(phone, 'Por favor elige un servicio de la lista.')
    return
  }

  const selectedService = services[index]
  const allDays = await getAvailableSlots('default', 14, selectedService.duration)
  const availableDays = allDays.slice(0, 10)

  if (availableDays.length === 0) {
    await wa.sendText(phone, '😔 No hay horarios disponibles en los próximos días. Intenta más tarde o escribe *cancelar* para salir.')
    return db.deleteSession(phone)
  }

  await db.saveSession(phone, {
    state: STATES.CHOOSING_DAY,
    clientName: session.clientName,
    service: selectedService,
    availableDays
  })

  await showDaysList(phone, availableDays)
}

async function showDaysList(phone, availableDays) {
  await wa.sendList(
    phone,
    '📅 ¿Qué día te viene bien?',
    'Elegir día',
    [{
      title: 'Días disponibles',
      rows: availableDays.map((day, i) => {
        const n = day.slots.length
        return {
          id: `day_${i}`,
          title: day.date,
          description: `${n} horario${n === 1 ? '' : 's'} libre${n === 1 ? '' : 's'}`
        }
      })
    }],
    'Escribe atrás para cambiar de servicio'
  )
}

async function handleDayChoice(phone, text, session) {
  if (text === 'atras' || text === 'atrás') {
    return startBooking(phone, session)
  }

  let index
  if (text.startsWith('day_')) {
    index = parseInt(text.replace('day_', ''))
  } else {
    index = parseInt(text) - 1
  }

  const days = session.availableDays

  if (isNaN(index) || index < 0 || index >= days.length) {
    await wa.sendText(phone, 'Por favor elige un día de la lista.')
    return
  }

  const selectedDay = days[index]
  const slots = selectedDay.slots.slice(0, 10)

  await db.saveSession(phone, {
    state: STATES.CHOOSING_SLOT,
    clientName: session.clientName,
    service: session.service,
    availableDays: days,
    slotOptions: slots
  })

  await showSlotsList(phone, selectedDay.date, slots)
}

async function showSlotsList(phone, dateLabel, slots) {
  await wa.sendList(
    phone,
    `🕐 Horarios para *${dateLabel}*`,
    'Elegir horario',
    [{
      title: 'Horarios libres',
      rows: slots.map((slot, i) => ({
        id: `slot_${i}`,
        title: slot.label
      }))
    }],
    'Escribe atrás para cambiar de día'
  )
}

async function handleSlotChoice(phone, text, session) {
  if (text === 'atras' || text === 'atrás') {
    await db.saveSession(phone, {
      state: STATES.CHOOSING_DAY,
      clientName: session.clientName,
      service: session.service,
      availableDays: session.availableDays
    })
    return showDaysList(phone, session.availableDays)
  }

  let index
  if (text.startsWith('slot_')) {
    index = parseInt(text.replace('slot_', ''))
  } else {
    index = parseInt(text) - 1
  }

  const options = session.slotOptions

  if (isNaN(index) || index < 0 || index >= options.length) {
    await wa.sendText(phone, 'Por favor elige un horario de la lista.')
    return
  }

  const selectedSlot = options[index]

  await db.saveSession(phone, {
    state: STATES.CONFIRMING,
    clientName: session.clientName,
    service: session.service,
    slot: selectedSlot
  })

  await wa.sendButtons(
    phone,
    `📋 *Resumen de tu cita:*\n\n` +
    `👤 ${session.clientName}\n` +
    `✂️  ${session.service.name} · $${session.service.price}\n` +
    `📅 ${selectedSlot.dateLabel}\n` +
    `🕐 ${selectedSlot.label}\n\n` +
    `¿Confirmas?`,
    [
      { id: 'confirm_yes', title: '✅ Confirmar' },
      { id: 'confirm_no',  title: '❌ Cancelar' }
    ]
  )
}

async function handleConfirmation(phone, text, session) {
  if (text === 'confirm_yes' || text === '1' || text.includes('si') || text.includes('sí') || text.includes('confirmo')) {
    const taken = await isSlotTaken('default', session.slot.datetime, session.service.duration)

    if (taken) {
      const allDays = await getAvailableSlots('default', 14, session.service.duration)
      const availableDays = allDays.slice(0, 10)

      if (availableDays.length === 0) {
        await wa.sendText(phone, '😔 Justo se ocupó ese horario y no quedan otros disponibles. Intenta más tarde o escribe *cancelar*.')
        return db.deleteSession(phone)
      }

      await db.saveSession(phone, {
        state: STATES.CHOOSING_DAY,
        clientName: session.clientName,
        service: session.service,
        availableDays
      })

      await wa.sendText(phone, '😔 Justo acaban de ocupar ese horario. Elige otro:')
      return showDaysList(phone, availableDays)
    }

    await db.createAppointment({
      clientPhone: phone,
      clientName: session.clientName,
      service: session.service.name,
      servicePrice: session.service.price,
      duration: session.service.duration,
      datetime: session.slot.datetime,
      date: session.slot.dateLabel,
      time: session.slot.label,
      barberId: 'default',
      reminderSent: false,
      status: 'confirmed'
    })

    await db.deleteSession(phone)
    await wa.sendConfirmation(phone, {
      clientName: session.clientName,
      service: session.service.name,
      date: session.slot.dateLabel,
      time: session.slot.label
    })

  } else if (text === 'confirm_no' || text === '2' || text.includes('no')) {
    await showMainMenu(phone, session.clientName)
  } else {
    await wa.sendButtons(
      phone,
      '¿Confirmas la cita?',
      [
        { id: 'confirm_yes', title: '✅ Confirmar' },
        { id: 'confirm_no',  title: '❌ Cancelar' }
      ]
    )
  }
}

// ─── VER CITA ────────────────────────────────────────────────

async function showCurrentAppointment(phone, session) {
  const appointment = await db.getAppointmentByPhone(phone)

  if (!appointment) {
    await db.saveSession(phone, { state: STATES.MAIN_MENU, clientName: session.clientName })
    await wa.sendText(phone, '📭 No tienes ninguna cita activa.')
    return showMainMenu(phone, session.clientName)
  }

  await db.saveSession(phone, { state: STATES.MAIN_MENU, clientName: session.clientName })
  await wa.sendButtons(
    phone,
    `📅 *Tu cita actual:*\n\n` +
    `✂️  ${appointment.service}\n` +
    `📅 ${appointment.date}\n` +
    `🕐 ${appointment.time}`,
    [
      { id: 'menu_cancel', title: '❌ Cancelar cita' },
      { id: 'menu_book',   title: '📅 Nueva cita' }
    ]
  )
}

// ─── CANCELAR CITA ───────────────────────────────────────────

async function handleCancel(phone) {
  const appointment = await db.getAppointmentByPhone(phone)

  if (!appointment) {
    await db.deleteSession(phone)
    await wa.sendText(phone, '📭 No tienes ninguna cita activa para cancelar.')
    return
  }

  await db.cancelAppointment(appointment.id)
  await db.deleteSession(phone)
  await wa.sendText(phone,
    `✅ Tu cita del *${appointment.date}* a las *${appointment.time}* fue cancelada.\n\n` +
    `Cuando quieras agendar de nuevo, escribe *cita*.`
  )
}

// ─── CAMBIAR NOMBRE ──────────────────────────────────────────

async function startRename(phone, session) {
  await db.saveSession(phone, { state: STATES.CHANGING_NAME, clientName: session.clientName })
  await wa.sendText(phone, `✏️ Tu nombre actual es *${session.clientName}*.\n\n¿Cómo quieres que te llamemos?`)
}

async function handleChangingName(phone, name, session) {
  const cleanName = name.trim()
  const lower = cleanName.toLowerCase()

  if (cleanName.length < 2) {
    await wa.sendText(phone, 'Por favor escribe un nombre válido. 😊')
    return
  }
  if (BOT_KEYWORDS.some(k => lower.includes(k))) {
    await wa.sendText(phone, 'Ese parece un mensaje, no un nombre 😄 ¿Cómo te llamas?')
    return
  }

  await db.saveClient(phone, cleanName)
  await wa.sendText(phone, `✅ ¡Listo! Ahora te llamamos *${cleanName}*. 😊`)
  await showMainMenu(phone, cleanName)
}

module.exports = { handleMessage }
