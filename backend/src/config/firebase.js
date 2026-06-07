const admin = require('firebase-admin')
const path = require('path')

let db

function initFirebase() {
  if (admin.apps.length > 0) return admin.firestore()

  const credentialsPath = path.resolve(process.env.FIREBASE_CREDENTIALS_PATH)
  const serviceAccount = require(credentialsPath)

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
