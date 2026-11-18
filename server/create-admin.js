const bcrypt = require('bcrypt')
const { MySQLFirestoreAdapter } = require('./mysql-adapter')

function requiredValue(environment, name) {
  const value = environment[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Set ${name} before running this script.`)
  }
  return value.trim()
}

function buildAdminProfile(environment = process.env) {
  const username = requiredValue(environment, 'ADMIN_USERNAME')
  const email = requiredValue(environment, 'ADMIN_EMAIL')
  const firstName = requiredValue(environment, 'ADMIN_FIRST_NAME')
  const lastName = requiredValue(environment, 'ADMIN_LAST_NAME')
  const password = environment.ADMIN_PASSWORD

  if (typeof password !== 'string' || password.trim() === '') {
    throw new Error('Set ADMIN_PASSWORD before running this script.')
  }
  const passwordBytes = Buffer.byteLength(password, 'utf8')
  if (passwordBytes < 12 || passwordBytes > 72) {
    throw new Error('ADMIN_PASSWORD must be between 12 and 72 UTF-8 bytes.')
  }

  const middleName = typeof environment.ADMIN_MIDDLE_NAME === 'string'
    ? environment.ADMIN_MIDDLE_NAME.trim()
    : ''

  return {
    username,
    email,
    password,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    full_name: [firstName, middleName, lastName].filter(Boolean).join(' '),
    phone: typeof environment.ADMIN_PHONE === 'string' ? environment.ADMIN_PHONE.trim() : '',
    home_address: typeof environment.ADMIN_HOME_ADDRESS === 'string'
      ? environment.ADMIN_HOME_ADDRESS.trim()
      : '',
    role: 'Administrator',
    emp_id: typeof environment.ADMIN_EMP_ID === 'string' ? environment.ADMIN_EMP_ID.trim() : '',
    dept: typeof environment.ADMIN_DEPT === 'string' && environment.ADMIN_DEPT.trim()
      ? environment.ADMIN_DEPT.trim()
      : 'Management'
  }
}

async function main() {
  const admin = buildAdminProfile()
  const db = new MySQLFirestoreAdapter({
    type: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'buildtrack_db',
    port: Number(process.env.DB_PORT) || 3306
  })

  try {
    await db.ready
    const existing = await db.collection('admins')
      .where('username', '==', admin.username)
      .limit(1)
      .get()
    if (!existing.empty) {
      console.log(`Admin "${admin.username}" already exists. No changes were made.`)
      return
    }

    const hashedPassword = await bcrypt.hash(admin.password, 10)
    const { password, ...adminData } = admin
    const docRef = await db.collection('admins').add({
      ...adminData,
      password: hashedPassword,
      created_at: new Date().toISOString()
    })

    console.log(`Admin created successfully. Document ID: ${docRef.id}`)
    console.log(`Username: ${admin.username}`)
  } finally {
    await db.close()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Admin creation failed:', error.message)
    process.exitCode = 1
  })
}

module.exports = { buildAdminProfile }
