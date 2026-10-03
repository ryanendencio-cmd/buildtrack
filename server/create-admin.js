/**
 * One-time script to create an admin account in Firestore.
 * Usage: node create-admin.js
 * Delete this file after use.
 */

const bcrypt = require('bcrypt')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const serviceAccount = require('./firebase-service-account.json')

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })

// ── EDIT THESE BEFORE RUNNING ──
const ADMIN = {
  username:    'admin',
  password:    'admin1234',       // change this
  email:       'ajsotalbo@gmail.com',
  first_name:  'Aldrich',
  middle_name: '',
  last_name:   'Sotalbo',
  full_name:   'Admin User',
  phone:       '',
  home_address: '',
  role:        'Administrator',
  emp_id:      'SCON-ADMIN-001',
  dept:        'Management'
}

async function main() {
  // Check if username already exists
  const existing = await db.collection('admins').where('username', '==', ADMIN.username).limit(1).get()
  if (!existing.empty) {
    console.log(`Admin "${ADMIN.username}" already exists. Aborting.`)
    process.exit(0)
  }

  const hashed = await bcrypt.hash(ADMIN.password, 10)
  const docRef = await db.collection('admins').add({
    ...ADMIN,
    password: hashed,
    created_at: new Date().toISOString()
  })

  console.log(`Admin created successfully!`)
  console.log(`  Document ID : ${docRef.id}`)
  console.log(`  Username    : ${ADMIN.username}`)
  console.log(`  Password    : ${ADMIN.password}`)
  console.log(`\nDelete this file (create-admin.js) after use.`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
