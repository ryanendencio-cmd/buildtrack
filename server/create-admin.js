/**
 * One-time script to create an admin account in MySQL (buildtrack_db).
 * Usage: node create-admin.js
 */

const bcrypt = require('bcrypt')
const { MySQLFirestoreAdapter, FieldValue } = require('./mysql-adapter')

const db = new MySQLFirestoreAdapter({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'root',
  database: process.env.DB_NAME || 'buildtrack_db',
  port: Number(process.env.DB_PORT) || 3306
})

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
    await db.close()
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
  await db.close()
  process.exit(0)
}

main().catch(async err => { 
  console.error(err)
  await db.close().catch(() => {})
  process.exit(1) 
})
