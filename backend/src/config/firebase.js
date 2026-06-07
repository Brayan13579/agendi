const admin = require('firebase-admin')
const path = require('path')

let db

function initFirebase() {
  if (admin.apps.length > 0) return admin.firestore()

  // En producción (Railway) las credenciales vienen como variable de entorno
  // (el archivo .json no se sube al repo por seguridad). En local se sigue
  // soportando la ruta a un archivo para no romper el flujo de desarrollo.
  const serviceAccount = process.env.FIREBASE_CREDENTIALS_JSON
    ? JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON)
    : require(path.resolve(process.env.FIREBASE_CREDENTIALS_PATH))

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  db = admin.firestore()
  console.log('✅ Firebase conectado')
  return db
}

function getDb() {
  if (!db) return initFirebase()
  return db
}

module.exports = { initFirebase, getDb }
