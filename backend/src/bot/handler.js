const db = require('../services/database')
const wa = require('../services/whatsapp')
const { getAvailableSlots, isSlotTaken, formatDaysMessage, formatDaySlotsMessage, formatDate } = require('../services/scheduler')

// Estados posibles de la conversación
const STATES = {
  IDLE: 'idle',
  ASKING_NAME: 'asking_name',
  MAIN_MENU: 'main_menu',
  CHOOSING_SERVICE: 'choosing_service',
  CHOOSING_DAY: 'choosing_day',
  CHOOSING_SLOT: 'choosing_slot',
  CONFIRMING: 'confirming'
}

// Punto de entrada — recibe cada mensaje del cliente
async function handleMessage(phone, messageText) {
  const text = messageText.trim().toLowerCase()

  // 1. Verificar si el bot está activo para este barbero
  const config = await db.getBotConfig()
  if (!config.botActive) return // Bot pausado, el barbero atiende manual

  // 2. Verificar si el mensaje activa el bot o si ya hay sesión activa
  const session = await db.getSession(phone)
  const keywords = config.keywords || ['cita', 'agendar', 'reservar', 'turno', 'hora']
  const isKeyword = keywords.some(k => text.includes(k.toLowerCase()))

  // Si no hay sesión activa y no es palabra clave, ignorar el mensaje
  if (!session && !isKeyword) return

  // 3. Manejar "cancelar" en cualquier momento
  if (text === 'cancelar' || text === 'cancel') {
    return handleCancel(phone)
  }

  // 4. Si no hay sesión, iniciar flujo
  if (!session) {
    return startFlow(phone, config)
  }

  // Si el usuario repite la palabra clave en medio de otro flujo, reiniciar al menú
  if (isKeyword && session.state !== STATES.ASKING_NAME) {
    const client = await db.getClient(phone)
    if (client) return showMainMenu(phone, client.name)
    return startFlow(phone, config)
  }

  // 5. Continuar con el estado actual de la conversación
  switch (session.state) {
    case STATES.ASKING_NAME:
      return handleName(phone, messageText, session)
    case STATES.MAIN_MENU:
      return handleMainMenu(phone, text, session)
    case STATES.CHOOSING_SERVICE:
      return handleServiceChoice(phone, text, session)
    case STATES.CHOOSING_DAY:
      return handleDayChoice(phone, text, session)
    case STATES.CHOOSING_SLOT:
      return handleSlotChoice(phone, text, session)
    case STATES.CONFIRMING:
      return handleConfirmation(phone, text, session)
    default:
      return startFlow(phone, config)
  }
}

// ─── INICIO DEL FLUJO ────────────────────────────────────────

async function startFlow(phone, config) {
  const client = await db.getClient(phone)

  if (!client) {
    // Primera vez — pedir nombre
    await db.saveSession(phone, { state: STATES.ASKING_NAME })
    await wa.sendText(phone,
      `${config.welcomeMessage}\n\nPara empezar, ¿cuál es tu nombre? 😊`
    )
  } else {
    // Cliente conocido — ir directo al menú
    await showMainMenu(phone, client.name)
  }
}

// ─── PEDIR NOMBRE (solo primera vez) ─────────────────────────

async function handleName(phone, name, session) {
  const cleanName = name.trim()
  if (cleanName.length < 2) {
    await wa.sendText(phone, 'Por favor escribe tu nombre completo. 😊')
    return
  }

  await db.saveClient(phone, cleanName)
  await db.saveSession(phone, { state: STATES.MAIN_MENU, clientName: cleanName })
  await showMainMenu(phone, cleanName)
}

// ─── MENÚ PRINCIPAL ───────────────────────────────────────────

async function showMainMenu(phone, clientName) {
  await db.saveSession(phone, { state: STATES.MAIN_MENU, clientName })
  await wa.sendOptions(phone,
    `¡Hola, ${clientName}! 👋 ¿Qué quieres hacer?`,
    ['📅 Agendar una cita', '🔍 Ver mi cita actual', '❌ Cancelar mi cita']
  )
}

async function handleMainMenu(phone, text, session) {
  if (text === '1' || text.includes('agendar')) {
    return startBooking(phone, session)
  } else if (text === '2' || text.includes('ver')) {
    return showCurrentAppointment(phone, session)
  } else if (text === '3' || text.includes('cancelar')) {
    return handleCancel(phone)
  } else {
    await wa.sendText(phone, 'Responde con *1*, *2* o *3* según lo que necesites.')
  }
}

// ─── AGENDAR CITA ─────────────────────────────────────────────

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

  const serviceNames = services.map(s => `${s.name} · $${s.price}`)
  await wa.sendOptions(phone, '✂️ ¿Qué servicio quieres?', serviceNames)
}

async function handleServiceChoice(phone, text, session) {
  const index = parseInt(text) - 1
  const services = session.services

  if (isNaN(index) || index < 0 || index >= services.length) {
    await wa.sendText(phone, `Por favor responde con un número del 1 al ${services.length}.`)
    return
  }

  const selectedService = services[index]
  const availableDays = await getAvailableSlots('default', 14, selectedService.duration)

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

  const { message } = formatDaysMessage(availableDays)
  await wa.sendText(phone, message)
}

async function handleDayChoice(phone, text, session) {
  if (text === 'atras' || text === 'atrás') {
    return startBooking(phone, session)
  }

  const index = parseInt(text) - 1
  const days = session.availableDays

  if (isNaN(index) || index < 0 || index >= days.length) {
    await wa.sendText(phone, `Por favor responde con un número del 1 al ${days.length}, o escribe *atrás* para elegir otro día.`)
    return
  }

  const selectedDay = days[index]

  await db.saveSession(phone, {
    state: STATES.CHOOSING_SLOT,
    clientName: session.clientName,
    service: session.service,
    availableDays: days,
    slotOptions: selectedDay.slots
  })

  const { message } = formatDaySlotsMessage(selectedDay)
  await wa.sendText(phone, message)
}

async function handleSlotChoice(phone, text, session) {
  if (text === 'atras' || text === 'atrás') {
    await db.saveSession(phone, {
      state: STATES.CHOOSING_DAY,
      clientName: session.clientName,
      service: session.service,
      availableDays: session.availableDays
    })
    const { message } = formatDaysMessage(session.availableDays)
    return wa.sendText(phone, message)
  }

  const index = parseInt(text) - 1
  const options = session.slotOptions

  if (isNaN(index) || index < 0 || index >= options.length) {
    await wa.sendText(phone, `Por favor responde con un número del 1 al ${options.length}, o escribe *atrás* para elegir otro día.`)
    return
  }

  const selectedSlot = options[index]

  await db.saveSession(phone, {
    state: STATES.CONFIRMING,
    clientName: session.clientName,
    service: session.service,
    slot: selectedSlot
  })

  await wa.sendText(phone,
    `📋 *Resumen de tu cita:*\n\n` +
    `👤 ${session.clientName}\n` +
    `✂️  ${session.service.name} · $${session.service.price}\n` +
    `📅 ${selectedSlot.dateLabel}\n` +
    `🕐 ${selectedSlot.label}\n\n` +
    `¿Confirmas? Responde *1 Sí* o *2 No*`
  )
}

async function handleConfirmation(phone, text, session) {
  if (text === '1' || text.includes('si') || text.includes('sí') || text.includes('confirmo')) {
    // Revalidar justo antes de crear la cita, por si alguien ocupó el horario mientras se decidía
    const taken = await isSlotTaken('default', session.slot.datetime)
    if (taken) {
      const availableDays = await getAvailableSlots('default', 14, session.service.duration)

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
      const { message } = formatDaysMessage(availableDays)
      return wa.sendText(phone, message)
    }

    const appointmentId = await db.createAppointment({
      clientPhone: phone,
      clientName: session.clientName,
      service: session.service.name,
      servicePrice: session.service.price,
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

    console.log(`✅ Cita creada: ${appointmentId} para ${session.clientName}`)
  } else if (text === '2' || text.includes('no')) {
    await db.saveSession(phone, { state: STATES.MAIN_MENU, clientName: session.clientName })
    await showMainMenu(phone, session.clientName)
  } else {
    await wa.sendText(phone, 'Responde *1* para confirmar o *2* para volver al menú.')
  }
}

// ─── VER CITA ACTUAL ──────────────────────────────────────────

async function showCurrentAppointment(phone, session) {
  const appointment = await db.getAppointmentByPhone(phone)

  if (!appointment) {
    await wa.sendText(phone, '📭 No tienes ninguna cita activa.\n\nEscribe *cita* para agendar una.')
    return db.deleteSession(phone)
  }

  await wa.sendText(phone,
    `📅 *Tu cita actual:*\n\n` +
    `✂️  ${appointment.service}\n` +
    `📅 ${appointment.date}\n` +
    `🕐 ${appointment.time}\n\n` +
    `Para cancelarla escribe *cancelar*.`
  )
  await db.deleteSession(phone)
}

// ─── CANCELAR CITA ────────────────────────────────────────────

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

module.exports = { handleMessage }
