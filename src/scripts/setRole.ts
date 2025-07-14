// scripts/setRole.ts
import admin from 'firebase-admin'
import path from 'path'

// Load credentials
const serviceAccount = require(path.resolve('./serviceAccountKey.json'))

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
})

// Set role (custom claim)
const uid = "9d5HcRmHdfhxH6B48n33rRFROCS2" // replace with actual Firebase Auth UID

admin.auth().setCustomUserClaims(uid, {role: 'admin'}).then(() => {
    console.log(`✅ Set role 'admin' for UID ${uid}`)
    process.exit(0)
}).catch(console.error)
