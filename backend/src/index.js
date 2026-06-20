require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { initFirebase } = require('./config/firebase')
const webhookRoutes = require('./routes/webhook')
const apiRoutes = require('./routes/api')
const authRoutes = require('./routes/auth')
const { startReminderCron } = require('./cron/reminders')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/', webhookRoutes)
app.use('/', authRoutes)
app.use('/api', apiRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

async function start() {
  try {
    initFirebase()
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
      console.log(`📡 Webhook: POST http://localhost:${PORT}/webhook`)
      console.log(`🔧 API:     http://localhost:${PORT}/api`)
    })
    startReminderCron()
  } catch (error) {
    console.error('❌ Error al arrancar:', error.message)
    process.exit(1)
  }
}

start()
