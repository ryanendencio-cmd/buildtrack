const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'POST /api/login',
  'POST /api/admin/login',
  'POST /api/admin/forgot-password',
  'POST /api/admin/reset-password',
  'POST /api/email-otp/send',
  'POST /api/email-otp/verify',
  'POST /api/password/reset/email',
  'POST /api/register'
])

const RFID_SCAN_ROUTE = 'POST /api/attendance/scan'

function resolveJwtSecret(environment = process.env) {
  const secret = environment.JWT_SECRET
  if (typeof secret === 'string' && secret.length > 0) {
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('JWT_SECRET must be at least 32 bytes.')
    }
    return secret
  }

  if (environment.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production.')
  }
  return crypto.randomBytes(32).toString('hex')
}

function routeKey(req) {
  const routePath = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+$/, '') || '/'
  return `${req.method} ${routePath}`
}

function matchesApiKey(providedKey, configuredKey) {
  if (typeof providedKey !== 'string' || !configuredKey) return false
  const provided = Buffer.from(providedKey, 'utf8')
  const configured = Buffer.from(configuredKey, 'utf8')
  return provided.length === configured.length && crypto.timingSafeEqual(provided, configured)
}

function createApiAuthMiddleware({ db, jwtSecret, rfidApiKey }) {
  if (typeof jwtSecret !== 'string' || !jwtSecret) {
    throw new Error('A JWT secret is required for API authentication.')
  }
  if (rfidApiKey && Buffer.byteLength(rfidApiKey, 'utf8') < 32) {
    throw new Error('RFID_API_KEY must be at least 32 bytes.')
  }

  return async function authenticateApiRequest(req, res, next) {
    const requestRoute = routeKey(req)
    if (req.method === 'OPTIONS' || PUBLIC_ROUTES.has(requestRoute)) {
      return next()
    }

    if (requestRoute === RFID_SCAN_ROUTE) {
      if (!rfidApiKey) {
        return res.status(503).json({ error: 'RFID API authentication is not configured.' })
      }
      if (!matchesApiKey(req.get('x-rfid-api-key'), rfidApiKey)) {
        return res.status(401).json({ error: 'A valid RFID API key is required.' })
      }
      return next()
    }

    const authorization = String(req.get('authorization') || '')
    const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]
    if (!token) {
      return res.status(401).json({ error: 'An Admin login is required.' })
    }

    let claims
    try {
      claims = jwt.verify(token, jwtSecret)
    } catch {
      return res.status(401).json({ error: 'The Admin login is invalid or has expired.' })
    }
    if (!claims || claims.type !== 'admin' || !claims.id) {
      return res.status(403).json({ error: 'Only authenticated Admin accounts can access this endpoint.' })
    }

    try {
      const adminSnapshot = await db.collection('admins').doc(String(claims.id)).get()
      if (!adminSnapshot.exists) {
        return res.status(403).json({ error: 'This Admin account is no longer available.' })
      }
      const adminData = adminSnapshot.data()
      const role = String(adminData?.role || 'Administrator').toLowerCase()
      if (!role.includes('admin')) {
        return res.status(403).json({ error: 'Only Admin accounts can access this endpoint.' })
      }
      if (String(adminData?.status || 'Active').toLowerCase() !== 'active') {
        return res.status(403).json({ error: 'This Admin account is inactive.' })
      }

      req.admin = { id: String(claims.id), role }
      return next()
    } catch (error) {
      console.error('API authorization check failed:', error.message)
      return res.status(500).json({ error: 'Unable to authorize this request.' })
    }
  }
}

module.exports = {
  createApiAuthMiddleware,
  resolveJwtSecret
}
