/**
 * Script de migración: single-tenant → multi-tenant
 *
 * Uso:
 *   node scripts/migrate-to-multitenant.js <tenantId> <"Nombre del negocio">
 *
 * Ejemplo:
 *   node scripts/migrate-to-multitenant.js mi-barberia "Mi Barbería"
 *
 * Qué hace:
 *   1. Copia todas las colecciones raíz a tenants/{tenantId}/
 *   2. Crea el documento de metadata del tenant
 *   3. Promueve el usuario existente a super admin
 *   4. Crea la entrada en userIndex para que el admin pueda seguir logueándose
 *
 * NO borra las colecciones originales — hazlo manualmente después de verificar.
 */

require('dotenv').config()
const path = require('path')

// Asegurar que firebase se inicializa desde la ruta correcta
process.chdir(path.join(__dirname, '..'))

const { initFirebase, getDb } = require('../src/config/firebase')

const TENANT_ID = process.argv[2]
const TENANT_NAME = process.argv[3]

if (!TENANT_ID || !TENANT_NAME) {
  console.error('❌ Uso: node scripts/migrate-to-multitenant.js <tenantId> "<Nombre del negocio>"')
  console.error('   Ejemplo: node scripts/migrate-to-multitenant.js mi-barberia "Mi Barbería"')
  process.exit(1)
}

const COLLECTIONS_TO_MIGRATE = [
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

async function migrateCollection(db, collName) {
  const snap = await db.collection(collName).get()
  if (snap.empty) {
    console.log(`   📭 ${collName}: vacía, saltando`)
    return 0
  }

  // Usar batches de 400 (límite de Firestore es 500 por batch)
  const chunks = []
  for (let i = 0; i < snap.docs.length; i += 400) {
    chunks.push(snap.docs.slice(i, i + 400))
  }

  for (const chunk of chunks) {
    const batch = db.batch()
    chunk.forEach(doc => {
      const newRef = db
        .collection('tenants').doc(TENANT_ID)
        .collection(collName).doc(doc.id)
      batch.set(newRef, doc.data())
    })
    await batch.commit()
  }

  console.log(`   ✅ ${collName}: ${snap.size} documentos migrados`)
  return snap.size
}

async function run() {
  initFirebase()
  const db = getDb()

  console.log('\n════════════════════════════════════════')
  console.log(`  Migración → tenant: "${TENANT_ID}"`)
  console.log(`  Nombre: "${TENANT_NAME}"`)
  console.log('════════════════════════════════════════\n')

  // Verificar que el tenant no exista ya
  const existing = await db.collection('tenants').doc(TENANT_ID).get()
  if (existing.exists) {
    console.error(`❌ Ya existe un tenant con ID "${TENANT_ID}". Abortar para no sobreescribir datos.`)
    process.exit(1)
  }

  // 1. Migrar todas las colecciones
  console.log('📦 Migrando colecciones...')
  let totalDocs = 0
  for (const collName of COLLECTIONS_TO_MIGRATE) {
    totalDocs += await migrateCollection(db, collName)
  }
  console.log(`\n📊 Total: ${totalDocs} documentos migrados\n`)

  // 2. Obtener el usuario existente para promoverlo a super admin
  const usersSnap = await db
    .collection('tenants').doc(TENANT_ID)
    .collection('users').get()

  let adminPhone = null

  if (!usersSnap.empty) {
    const existingUser = usersSnap.docs[0].data()
    adminPhone = existingUser.phone || usersSnap.docs[0].id

    console.log(`👤 Usuario existente encontrado: ${adminPhone}`)

    // Crear super admin con la misma contraseña
    const superAdminRef = db.collection('superadmin').doc(adminPhone)
    const superAdminExists = await superAdminRef.get()

    if (!superAdminExists.exists) {
      await superAdminRef.set({
        phone: adminPhone,
        passwordHash: existingUser.passwordHash,
        role: 'superadmin',
        createdAt: new Date().toISOString()
      })
      console.log(`✅ Super admin creado: ${adminPhone}`)
    } else {
      console.log(`ℹ️  Super admin ya existía: ${adminPhone}`)
    }

    // Crear userIndex para que el admin del tenant pueda loguearse
    await db.collection('userIndex').doc(adminPhone).set({
      tenantId: TENANT_ID,
      role: 'admin'
    })
    console.log(`✅ UserIndex creado: ${adminPhone} → ${TENANT_ID}`)
  } else {
    console.log('⚠️  No se encontraron usuarios — crea el admin desde el panel web')
  }

  // 3. Crear metadata del tenant
  await db.collection('tenants').doc(TENANT_ID).set({
    name: TENANT_NAME,
    phoneNumberId: process.env.WHATSAPP_PHONE_ID || 'PENDIENTE',
    whatsappToken: process.env.WHATSAPP_TOKEN || 'PENDIENTE',
    active: true,
    adminPhone: adminPhone || 'PENDIENTE',
    createdAt: new Date().toISOString()
  })
  console.log(`✅ Metadata del tenant creada`)

  console.log('\n════════════════════════════════════════')
  console.log('  ✅ MIGRACIÓN COMPLETADA')
  console.log('════════════════════════════════════════\n')
  console.log('⚠️  PRÓXIMOS PASOS:')
  console.log('  1. Abre Firebase Console y verifica que los datos estén en')
  console.log(`     tenants/${TENANT_ID}/`)
  console.log('  2. Prueba el login en la app móvil')
  console.log('  3. Prueba el bot de WhatsApp')
  console.log('  4. Si todo funciona, borra las colecciones ANTIGUAS manualmente')
  console.log('     (appointments, clients, sessions, services, schedules,')
  console.log('      blockedSlots, botConfig, users, otp_codes en la raíz)\n')

  process.exit(0)
}

run().catch(err => {
  console.error('\n❌ Error en migración:', err.message)
  console.error(err.stack)
  process.exit(1)
})
