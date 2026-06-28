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
  CHANGING_NAME: 'changing_name',
  CHOOSING_CANCEL: 'choosing_cancel'
}

const BOT_KEYWORDS = ['cita', 'agendar', 'reservar', 'turno', 'hora']

async function handleMessage(phone, messageText, tenantId, waConfig = {}) {
  const text = messageText.trim().toLowerCase()

  const config = await db.getBotConfig(tenantId)
  if (!config.botActive) return

  const session = await db.getSession(tenantId, phone)
  const keywords = config.keywords || BOT_KEYWORDS
  const isKeyword = keywords.some(k => text.includes(k.toLowerCase()))

  if (!session && !isKeyword) return

  if ((text === 'cancelar' || text === 'cancel') && session?.state !== STATES.ASKING_NAME) {
    const inBookingFlow = session && [
      STATES.CHOOSING_SERVICE, STATES.CHOOSING_DAY,
      STATES.CHOOSING_SLOT, STATES.CONFIRMING,
      STATES.CHOOSING_CANCEL
    ].includes(session.state)
    if (inBookingFlow) {
      const client = await db.getClient(tenantId, phone)
      if (client) return showMainMenu(phone, client.name, tenantId, waConfig)
      return db.deleteSession(tenantId, phone)
    }
    return handleCancel(phone, tenantId, waConfig)
  }

  const isMenuCommand = text === 'menu' || text === 'menú' || text === 'inicio' || text === '0'
  if (isMenuCommand && session && session.state !== STATES.ASKING_NAME) {
    const client = await db.getClient(tenantId, phone)
    if (client) return showMainMenu(phone, client.name, tenantId, waConfig)
    return startFlow(phone, config, tenantId, waConfig)
  }

  if (!session) {
    return startFlow(phone, config, tenantId, waConfig)
  }

  if (isKeyword && session.state !== STATES.ASKING_NAME && session.state !== STATES.CHANGING_NAME) {
    const client = await db.getClient(tenantId, phone)
    if (client) return showMainMenu(phone, client.name, tenantId, waConfig)
    return startFlow(phone, config, tenantId, waConfig)
  }

  switch (session.state) {
    case STATES.ASKING_NAME:      return handleName(phone, messageText, session, tenantId, waConfig)
    case STATES.MAIN_MENU:        return handleMainMenu(phone, text, session, tenantId, waConfig)
    case STATES.CHOOSING_SERVICE: return handleServiceChoice(phone, text, session, tenantId, waConfig)
    case STATES.CHOOSING_DAY:     return handleDayChoice(phone, text, session, tenantId, waConfig)
    case STATES.CHOOSING_SLOT:    return handleSlotChoice(phone, text, session, tenantId, waConfig)
    case STATES.CONFIRMING:       return handleConfirmation(phone, text, session, tenantId, waConfig)
    case STATES.CHANGING_NAME:    return handleChangingName(phone, messageText, session, tenantId, waConfig)
    case STATES.CHOOSING_CANCEL:  return handleCancelChoice(phone, text, session, tenantId, waConfig)
    default:                      return startFlow(phone, config, tenantId, waConfig)
  }
}

// ─── INICIO ──────────────────────────────────────────────────

async function startFlow(phone, config, tenantId, waConfig) {
  const client = await db.getClient(tenantId, phone)
  if (!client) {
    await db.saveSession(tenantId, phone, { state: STATES.ASKING_NAME })
    await wa.sendText(phone, `${config.welcomeMessage}\n\nPara empezar, ¿cuál es tu nombre? 😊`, waConfig)
  } else {
    await showMainMenu(phone, client.name, tenantId, waConfig)
  }
}

// ─── NOMBRE ──────────────────────────────────────────────────

async function handleName(phone, name, session, tenantId, waConfig) {
  const cleanName = name.trim()
  const lower = cleanName.toLowerCase()

  if (cleanName.length < 2) {
    await wa.sendText(phone, 'Por favor escribe tu nombre completo. 😊', waConfig)
    return
  }
  if (BOT_KEYWORDS.some(k => lower.includes(k))) {
    await wa.sendText(phone, 'Ese parece un mensaje, no un nombre 😄 ¿Cómo te llamas?', waConfig)
    return
  }

  await db.saveClient(tenantId, phone, cleanName)
  await db.saveSession(tenantId, phone, { state: STATES.MAIN_MENU, clientName: cleanName })
  await showMainMenu(phone, cleanName, tenantId, waConfig)
}

// ─── MENÚ PRINCIPAL ──────────────────────────────────────────

async function showMainMenu(phone, clientName, tenantId, waConfig) {
  await db.saveSession(tenantId, phone, { state: STATES.MAIN_MENU, clientName })
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
    }],
    undefined,
    waConfig
  )
}

async function handleMainMenu(phone, text, session, tenantId, waConfig) {
  if (text === 'menu_book' || text === '1' || text.includes('agendar')) {
    return startBooking(phone, session, tenantId, waConfig)
  } else if (text === 'menu_view' || text === '2' || text.includes('ver')) {
    return showAppointments(phone, session, false, tenantId, waConfig)
  } else if (text === 'menu_cancel' || text === '3') {
    return showAppointments(phone, session, true, tenantId, waConfig)
  } else if (text === 'menu_rename' || text === '4' || (text.includes('cambiar') && text.includes('nombre'))) {
    return startRename(phone, session, tenantId, waConfig)
  } else {
    await showMainMenu(phone, session.clientName, tenantId, waConfig)
  }
}

// ─── AGENDAR ─────────────────────────────────────────────────

async function startBooking(phone, session, tenantId, waConfig) {
  const services = await db.getServices(tenantId)

  if (services.length === 0) {
    await wa.sendText(phone, 'Lo siento, no hay servicios disponibles en este momento. Intenta más tarde.', waConfig)
    return db.deleteSession(tenantId, phone)
  }

  await db.saveSession(tenantId, phone, {
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
    }],
    undefined,
    waConfig
  )
}

async function handleServiceChoice(phone, text, session, tenantId, waConfig) {
  const services = session.services
  let index

  if (text.startsWith('svc_')) {
    index = parseInt(text.replace('svc_', ''))
  } else {
    index = parseInt(text) - 1
  }

  if (isNaN(index) || index < 0 || index >= services.length) {
    await wa.sendText(phone, 'Por favor elige un servicio de la lista.', waConfig)
    return
  }

  const selectedService = services[index]
  const allDays = await getAvailableSlots(tenantId, 14, selectedService.duration)
  const availableDays = allDays.slice(0, 10)

  if (availableDays.length === 0) {
    await wa.sendText(phone, '😔 No hay horarios disponibles en los próximos días. Intenta más tarde o escribe *cancelar* para salir.', waConfig)
    return db.deleteSession(tenantId, phone)
  }

  await db.saveSession(tenantId, phone, {
    state: STATES.CHOOSING_DAY,
    clientName: session.clientName,
    service: selectedService,
    availableDays
  })

  await showDaysList(phone, availableDays, waConfig)
}

async function showDaysList(phone, availableDays, waConfig) {
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
    'Escribe atrás para cambiar de servicio',
    waConfig
  )
}

async function handleDayChoice(phone, text, session, tenantId, waConfig) {
  if (text === 'atras' || text === 'atrás') {
    return startBooking(phone, session, tenantId, waConfig)
  }

  let index
  if (text.startsWith('day_')) {
    index = parseInt(text.replace('day_', ''))
  } else {
    index = parseInt(text) - 1
  }

  const days = session.availableDays

  if (isNaN(index) || index < 0 || index >= days.length) {
    await wa.sendText(phone, 'Por favor elige un día de la lista.', waConfig)
    return
  }

  const selectedDay = days[index]
  const slots = selectedDay.slots.slice(0, 10)

  await db.saveSession(tenantId, phone, {
    state: STATES.CHOOSING_SLOT,
    clientName: session.clientName,
    service: session.service,
    availableDays: days,
    slotOptions: slots
  })

  await showSlotsList(phone, selectedDay.date, slots, waConfig)
}

async function showSlotsList(phone, dateLabel, slots, waConfig) {
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
    'Escribe atrás para cambiar de día',
    waConfig
  )
}

async function handleSlotChoice(phone, text, session, tenantId, waConfig) {
  if (text === 'atras' || text === 'atrás') {
    await db.saveSession(tenantId, phone, {
      state: STATES.CHOOSING_DAY,
      clientName: session.clientName,
      service: session.service,
      availableDays: session.availableDays
    })
    return showDaysList(phone, session.availableDays, waConfig)
  }

  let index
  if (text.startsWith('slot_')) {
    index = parseInt(text.replace('slot_', ''))
  } else {
    index = parseInt(text) - 1
  }

  const options = session.slotOptions

  if (isNaN(index) || index < 0 || index >= options.length) {
    await wa.sendText(phone, 'Por favor elige un horario de la lista.', waConfig)
    return
  }

  const selectedSlot = options[index]

  await db.saveSession(tenantId, phone, {
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
    ],
    waConfig
  )
}

async function handleConfirmation(phone, text, session, tenantId, waConfig) {
  if (text === 'confirm_yes' || text === '1' || text.includes('si') || text.includes('sí') || text.includes('confirmo')) {
    const taken = await isSlotTaken(tenantId, session.slot.datetime, session.service.duration)

    if (taken) {
      const allDays = await getAvailableSlots(tenantId, 14, session.service.duration)
      const availableDays = allDays.slice(0, 10)

      if (availableDays.length === 0) {
        await wa.sendText(phone, '😔 Justo se ocupó ese horario y no quedan otros disponibles. Intenta más tarde o escribe *cancelar*.', waConfig)
        return db.deleteSession(tenantId, phone)
      }

      await db.saveSession(tenantId, phone, {
        state: STATES.CHOOSING_DAY,
        clientName: session.clientName,
        service: session.service,
        availableDays
      })

      await wa.sendText(phone, '😔 Justo acaban de ocupar ese horario. Elige otro:', waConfig)
      return showDaysList(phone, availableDays, waConfig)
    }

    await db.createAppointment(tenantId, {
      clientPhone: phone,
      clientName: session.clientName,
      service: session.service.name,
      servicePrice: session.service.price,
      duration: session.service.duration,
      datetime: session.slot.datetime,
      date: session.slot.dateLabel,
      time: session.slot.label,
      reminderSent: false,
      status: 'confirmed'
    })

    await db.deleteSession(tenantId, phone)
    await wa.sendConfirmation(phone, {
      clientName: session.clientName,
      service: session.service.name,
      date: session.slot.dateLabel,
      time: session.slot.label
    }, waConfig)

  } else if (text === 'confirm_no' || text === '2' || text.includes('no')) {
    await showMainMenu(phone, session.clientName, tenantId, waConfig)
  } else {
    await wa.sendButtons(
      phone,
      '¿Confirmas la cita?',
      [
        { id: 'confirm_yes', title: '✅ Confirmar' },
        { id: 'confirm_no',  title: '❌ Cancelar' }
      ],
      waConfig
    )
  }
}

// ─── VER / CANCELAR CITAS ────────────────────────────────────

const STATUS_LABEL = { confirmed: '✅ Confirmada', pending: '⏳ Pendiente' }

async function showAppointments(phone, session, cancelMode = false, tenantId, waConfig) {
  const appointments = await db.getAppointmentsByPhone(tenantId, phone)

  if (appointments.length === 0) {
    await wa.sendText(phone, '📭 No tienes ninguna cita activa.\n\nEscribe *cita* para agendar una.', waConfig)
    return showMainMenu(phone, session.clientName, tenantId, waConfig)
  }

  await db.saveSession(tenantId, phone, {
    state: STATES.CHOOSING_CANCEL,
    clientName: session.clientName,
    appointments
  })

  let message = cancelMode
    ? '❌ *¿Cuál cita quieres cancelar?*\n\n'
    : '📅 *Tus citas activas:*\n\n'

  appointments.forEach((a, i) => {
    message += `*${i + 1}.* ${a.service} · ${a.date} · ${a.time} · ${STATUS_LABEL[a.status] || a.status}\n`
  })

  message += '\n_Responde con el número para cancelar esa cita, o escribe *menu* para volver._'
  await wa.sendText(phone, message, waConfig)
}

async function handleCancelChoice(phone, text, session, tenantId, waConfig) {
  const index = parseInt(text) - 1
  const appointments = session.appointments

  if (isNaN(index) || index < 0 || index >= appointments.length) {
    await wa.sendText(phone, `Responde con un número del 1 al ${appointments.length}, o escribe *menu* para volver.`, waConfig)
    return
  }

  const appt = appointments[index]
  await db.cancelAppointment(tenantId, appt.id)
  await db.deleteSession(tenantId, phone)
  await wa.sendText(phone,
    `✅ Listo. Tu cita de *${appt.service}* del *${appt.date}* a las *${appt.time}* fue cancelada.\n\n` +
    `Escribe *cita* cuando quieras agendar de nuevo.`,
    waConfig
  )
}

async function handleCancel(phone, tenantId, waConfig) {
  const client = await db.getClient(tenantId, phone)
  const session = { clientName: client?.name || '' }
  return showAppointments(phone, session, true, tenantId, waConfig)
}

// ─── CAMBIAR NOMBRE ──────────────────────────────────────────

async function startRename(phone, session, tenantId, waConfig) {
  await db.saveSession(tenantId, phone, { state: STATES.CHANGING_NAME, clientName: session.clientName })
  await wa.sendText(phone, `✏️ Tu nombre actual es *${session.clientName}*.\n\n¿Cómo quieres que te llamemos?`, waConfig)
}

async function handleChangingName(phone, name, session, tenantId, waConfig) {
  const cleanName = name.trim()
  const lower = cleanName.toLowerCase()

  if (cleanName.length < 2) {
    await wa.sendText(phone, 'Por favor escribe un nombre válido. 😊', waConfig)
    return
  }
  if (BOT_KEYWORDS.some(k => lower.includes(k))) {
    await wa.sendText(phone, 'Ese parece un mensaje, no un nombre 😄 ¿Cómo te llamas?', waConfig)
    return
  }

  await db.saveClient(tenantId, phone, cleanName)
  await wa.sendText(phone, `✅ ¡Listo! Ahora te llamamos *${cleanName}*. 😊`, waConfig)
  await showMainMenu(phone, cleanName, tenantId, waConfig)
}

module.exports = { handleMessage }
