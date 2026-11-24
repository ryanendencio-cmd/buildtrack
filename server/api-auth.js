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
const WORKER_NOTIFICATIONS_ROUTE = 'GET /api/worker/notifications'
const WORKER_DELETE_NOTIFICATIONS_ROUTE = 'DELETE /api/worker/notifications'
const WORKER_READ_ROUTES = new Set([
  'GET /api/attendance-settings',
  'GET /api/attendance-schedules',
  'GET /api/attendance/ALL',
  'GET /api/attendance/rfid-taps',
  'GET /api/attendance-correction-requests',
  'GET /api/early-out-requests',
  'GET /api/borrow-history/ALL',
  'GET /api/assets',
  'GET /api/projects'
])

const WORKER_WRITE_ROUTES = new Set([
  'POST /api/attendance-correction-requests',
  'POST /api/early-out-requests',
  'POST /api/cash-advances',
  'POST /api/borrow-history',
  'POST /api/worker/device-token',
  'POST /api/device-token'
])

const ATTENDANCE_ROLE_ROUTES = new Set([
  'GET /api/workers',
  'GET /api/non-working-days',
  'GET /api/projects',
  'GET /api/attendance/rfid-taps',
  'POST /api/attendance/scan',
  'POST /api/attendance',
  'POST /api/attendance-settings',
  'POST /api/attendance-schedules',
  'POST /api/non-working-days'
])

const TOOLS_ROLE_ROUTES = new Set([
  'GET /api/workers',
  'GET /api/projects',
  'GET /api/assets',
  'GET /api/assets/summary',
  'POST /api/assets',
  'POST /api/borrow-history',
  'PUT /api/assets'
])

function workerCapabilities(workerData) {
  const roleText = [
    workerData?.role,
    workerData?.roles,
    workerData?.position,
    workerData?.positions
  ]
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter(value => typeof value === 'string')
    .join(' ')
    .toLowerCase()

  return {
    attendance: /attendance|timekeeper/.test(roleText),
    tools: /tools?|custodian/.test(roleText)
  }
}

function isWorkerRouteAllowed(method, requestRoute, workerId, capabilities) {
  if (
    requestRoute === WORKER_NOTIFICATIONS_ROUTE ||
    requestRoute === WORKER_DELETE_NOTIFICATIONS_ROUTE ||
    (method === 'PUT' && /^PUT \/api\/worker\/notifications\/[^/]+\/read$/.test(requestRoute)) ||
    WORKER_READ_ROUTES.has(requestRoute) ||
    WORKER_WRITE_ROUTES.has(requestRoute)
  ) {
    return true
  }

  if (/^GET \/api\/(?:assets|projects)\/[^/]+$/.test(requestRoute)) {
    return true
  }

  const workerResourceMatch = /^(GET|PUT) \/api\/workers\/([^/]+)(?:\/(cash-advances|payroll|salary-summary))?$/.exec(requestRoute)
  if (workerResourceMatch) {
    return workerResourceMatch[1] === 'GET' && matchesWorkerId(workerResourceMatch[2], workerId)
      ? true
      : workerResourceMatch[1] === 'PUT' &&
        !workerResourceMatch[3] &&
        matchesWorkerId(workerResourceMatch[2], workerId)
  }

  if (capabilities.attendance) {
    if (ATTENDANCE_ROLE_ROUTES.has(requestRoute)) return true
    if (/^GET \/api\/attendance\/[^/]+$/.test(requestRoute)) return true
    if (/^GET \/api\/attendance-overtime-days\/[^/]+$/.test(requestRoute)) return true
    if (/^PUT \/api\/attendance\/[^/]+(?:\/(?:status|overtime))?$/.test(requestRoute)) return true
    if (/^PUT \/api\/(?:early-out-requests|attendance-correction-requests)\/[^/]+\/review$/.test(requestRoute)) return true
    if (/^PUT \/api\/attendance-overtime-days\/[^/]+$/.test(requestRoute)) return true
    if (/^DELETE \/api\/(?:non-working-days|attendance-schedules)\/[^/]+$/.test(requestRoute)) return true
  }

  if (capabilities.tools) {
    if (TOOLS_ROLE_ROUTES.has(requestRoute)) return true
    if (/^GET \/api\/assets\/[^/]+$/.test(requestRoute)) return true
    if (/^POST \/api\/assets(?:\/[^/]+)?$/.test(requestRoute)) return true
    if (/^PUT \/api\/assets\/[^/]+$/.test(requestRoute)) return true
    if (/^GET \/api\/borrow-history\/[^/]+$/.test(requestRoute)) return true
  }

  return false
}

function matchesWorkerId(pathId, workerId) {
  try {
    return decodeURIComponent(pathId) === workerId
  } catch {
    return false
  }
}

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

    if (requestRoute === RFID_SCAN_ROUTE &&
        matchesApiKey(req.get('x-rfid-api-key'), rfidApiKey)) {
      return next()
    }

    if (requestRoute === RFID_SCAN_ROUTE && !req.get('authorization') && !rfidApiKey) {
      return res.status(503).json({ error: 'RFID API authentication is not configured.' })
    }

    const authorization = String(req.get('authorization') || '')
    const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]
    if (!token) {
      return res.status(401).json({ error: 'An authenticated login is required.' })
    }

    let claims
    try {
      claims = jwt.verify(token, jwtSecret)
    } catch {
      return res.status(401).json({ error: 'The login is invalid or has expired.' })
    }

    if (claims?.type === 'worker') {
      if (!claims.id) {
        return res.status(403).json({ error: 'Workers cannot access this endpoint.' })
      }

      try {
        const workerSnapshot = await db.collection('workers').doc(String(claims.id)).get()
        if (!workerSnapshot.exists) {
          return res.status(403).json({ error: 'This worker account is no longer available.' })
        }

        const workerData = workerSnapshot.data()
        const approvalStatus = String(workerData?.approval_status || 'Approved').toLowerCase()
        const status = String(workerData?.status || 'Active').toLowerCase()
        if (
          ['pending', 'rejected'].includes(approvalStatus) ||
          ['pending', 'rejected', 'inactive', 'disabled'].includes(status)
        ) {
          return res.status(403).json({ error: 'This worker account is not active.' })
        }

        const workerId = String(claims.id)
        const capabilities = workerCapabilities(workerData)
        if (!isWorkerRouteAllowed(req.method, requestRoute, workerId, capabilities)) {
          return res.status(403).json({ error: 'Workers cannot access this endpoint.' })
        }

        req.worker = {
          id: workerId,
          name: String(
            workerData.full_name ||
            workerData.name ||
            [workerData.first_name, workerData.middle_name, workerData.last_name].filter(Boolean).join(' ')
          ).trim(),
          role: String(workerData.role || 'Worker'),
          position: String(workerData.position || ''),
          projectId: workerData.project_id || null,
          ...capabilities
        }
        return next()
      } catch (error) {
        console.error('Worker API authorization check failed:', error.message)
        return res.status(500).json({ error: 'Unable to authorize this request.' })
      }
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
