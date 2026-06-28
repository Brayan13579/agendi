/**
 * Borra las colecciones raíz que ya fueron migradas a tenants/
 * Solo correr DESPUÉS de verificar que los datos están en tenants/{tenantId}/
 */

require('dotenv').config()
const path = require('path')
process.chdir(path.join(__dirname, '..'))

const { initFirebase, getDb } = require('../src/config/firebase')

const TO_DELETE = [
  'appointments',
  'clients',
  'sessions',
  'services',
  'schedules',
  'blockedSlots',
  'botConfig',
  'users',
  'otp_codes'
]

async function deleteCollection(db, collName) {
  const snap = await db.collection(collName).get()
  if (snap.empty) {
    console.log(`   📭 ${collName}: ya estaba vacía`)
    return 0
  }

  const chunks = []
  for (let i = 0; i < snap.docs.length; i += 400) {
    chunks.push(snap.docs.slice(i, i + 400))
  }

  for (const chunk of chunks) {
    const batch = db.batch()
    chunk.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
  }

  console.log(`   🗑️  ${collName}: ${snap.size} documentos eliminados`)
  return snap.size
}

async function run() {
  initFirebase()
  const db = getDb()

  console.log('\n════════════════════════════════════════')
  console.log('  Limpieza de colecciones antiguas')
  console.log('════════════════════════════════════════\n')

  let total = 0
  for (const coll of TO_DELETE) {
    total += await deleteCollection(db, coll)
  }

  console.log(`\n✅ Listo — ${total} documentos eliminados de las colecciones raíz`)
  process.exit(0)
}

run().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
