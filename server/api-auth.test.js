const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const { createApiAuthMiddleware, resolveJwtSecret } = require('./api-auth')

function makeRequest(method, path, headers = {}) {
  return {
    method,
    baseUrl: '/api',
    path,
    get: name => headers[name.toLowerCase()]
  }
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

test('requires a stable production JWT secret and rejects weak configured secrets', () => {
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET must be configured/)
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }), /at least 32 bytes/)
  assert.equal(resolveJwtSecret({ NODE_ENV: 'development' }).length, 64)
})

test('allows only explicitly public routes without an Admin token', async () => {
  const authenticate = createApiAuthMiddleware({ db: {}, jwtSecret: 'a'.repeat(32) })
  const response = makeResponse()
  let continued = false

  await authenticate(makeRequest('POST', '/admin/login'), response, () => {
    continued = true
  })
  assert.equal(continued, true)

  const protectedResponse = makeResponse()
  await authenticate(makeRequest('GET', '/payroll'), protectedResponse, () => {})
  assert.equal(protectedResponse.statusCode, 401)
})

test('requires an active Admin record for protected routes', async () => {
  const secret = 'a'.repeat(32)
  const adminToken = jwt.sign({ id: 'admin-1', type: 'admin' }, secret)
  const workerToken = jwt.sign({ id: 'worker-1', type: 'worker' }, secret)
  const db = {
    collection: () => ({
      doc: id => ({
        get: async () => id === 'admin-1'
          ? { exists: true, data: () => ({ role: 'Administrator' }) }
          : id === 'inactive-admin'
            ? { exists: true, data: () => ({ role: 'Administrator', status: 'Inactive' }) }
            : { exists: false }
      })
    })
  }
  const authenticate = createApiAuthMiddleware({ db, jwtSecret: secret })

  const adminResponse = makeResponse()
  let adminContinued = false
  await authenticate(makeRequest('GET', '/payroll', { authorization: `Bearer ${adminToken}` }), adminResponse, () => {
    adminContinued = true
  })
  assert.equal(adminContinued, true)
  assert.equal(adminResponse.statusCode, 200)

  const workerResponse = makeResponse()
  await authenticate(makeRequest('GET', '/payroll', { authorization: `Bearer ${workerToken}` }), workerResponse, () => {})
  assert.equal(workerResponse.statusCode, 403)

  const inactiveToken = jwt.sign({ id: 'inactive-admin', type: 'admin' }, secret)
  const inactiveResponse = makeResponse()
  await authenticate(makeRequest('GET', '/payroll', { authorization: `Bearer ${inactiveToken}` }), inactiveResponse, () => {})
  assert.equal(inactiveResponse.statusCode, 403)
})

test('requires the configured API key for physical attendance scans', async () => {
  assert.throws(() => createApiAuthMiddleware({
    db: {},
    jwtSecret: 'a'.repeat(32),
    rfidApiKey: 'short'
  }), /RFID_API_KEY must be at least 32 bytes/)

  const authenticate = createApiAuthMiddleware({
    db: {},
    jwtSecret: 'a'.repeat(32),
    rfidApiKey: 'b'.repeat(32)
  })
  const response = makeResponse()
  let continued = false

  await authenticate(makeRequest('POST', '/attendance/scan', { 'x-rfid-api-key': 'b'.repeat(32) }), response, () => {
    continued = true
  })
  assert.equal(continued, true)

  const invalidResponse = makeResponse()
  await authenticate(makeRequest('POST', '/attendance/scan'), invalidResponse, () => {})
  assert.equal(invalidResponse.statusCode, 401)
})
