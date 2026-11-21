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

test('allows active workers only on approved own-data routes', async () => {
  const secret = 'a'.repeat(32)
  const workerToken = jwt.sign({ id: 'worker-1', type: 'worker' }, secret)
  const db = {
    collection: () => ({
      doc: id => ({
        get: async () => id === 'worker-1'
          ? { exists: true, data: () => ({ status: 'Active', approval_status: 'Approved' }) }
          : { exists: false }
      })
    })
  }
  const authenticate = createApiAuthMiddleware({ db, jwtSecret: secret })

  const notificationResponse = makeResponse()
  const notificationRequest = makeRequest(
    'GET',
    '/worker/notifications',
    { authorization: `Bearer ${workerToken}` }
  )
  let notificationContinued = false
  await authenticate(
    notificationRequest,
    notificationResponse,
    () => {
      notificationContinued = notificationRequest.worker?.id === 'worker-1'
    }
  )
  assert.equal(notificationContinued, true)
  assert.equal(notificationResponse.statusCode, 200)

  const readResponse = makeResponse()
  let readContinued = false
  await authenticate(
    makeRequest('PUT', '/worker/notifications/notice-1/read', { authorization: `Bearer ${workerToken}` }),
    readResponse,
    () => {
      readContinued = true
    }
  )
  assert.equal(readContinued, true)

  const deleteNotificationsResponse = makeResponse()
  let deleteNotificationsContinued = false
  await authenticate(
    makeRequest('DELETE', '/worker/notifications', { authorization: `Bearer ${workerToken}` }),
    deleteNotificationsResponse,
    () => {
      deleteNotificationsContinued = true
    }
  )
  assert.equal(deleteNotificationsContinued, true)

  const ownPayrollRequest = makeRequest(
    'GET',
    '/workers/worker-1/payroll',
    { authorization: `Bearer ${workerToken}` }
  )
  const ownPayrollResponse = makeResponse()
  let ownPayrollContinued = false
  await authenticate(ownPayrollRequest, ownPayrollResponse, () => {
    ownPayrollContinued = true
  })
  assert.equal(ownPayrollContinued, true)

  for (const route of [
    ['GET', '/workers/worker-1'],
    ['PUT', '/workers/worker-1'],
    ['GET', '/attendance/ALL'],
    ['GET', '/attendance-schedules'],
    ['GET', '/attendance-settings']
  ]) {
    const response = makeResponse()
    let continued = false
    await authenticate(
      makeRequest(route[0], route[1], { authorization: `Bearer ${workerToken}` }),
      response,
      () => {
        continued = true
      }
    )
    assert.equal(continued, true, `${route[0]} ${route[1]} should be worker-readable`)
  }

  const otherWorkerResponse = makeResponse()
  await authenticate(
    makeRequest('GET', '/workers/worker-2/payroll', { authorization: `Bearer ${workerToken}` }),
    otherWorkerResponse,
    () => {}
  )
  assert.equal(otherWorkerResponse.statusCode, 403)

  const otherWorkerProfileResponse = makeResponse()
  await authenticate(
    makeRequest('PUT', '/workers/worker-2', { authorization: `Bearer ${workerToken}` }),
    otherWorkerProfileResponse,
    () => {}
  )
  assert.equal(otherWorkerProfileResponse.statusCode, 403)

  const workerListResponse = makeResponse()
  await authenticate(
    makeRequest('GET', '/workers', { authorization: `Bearer ${workerToken}` }),
    workerListResponse,
    () => {}
  )
  assert.equal(workerListResponse.statusCode, 403)

  const attendanceWriteResponse = makeResponse()
  await authenticate(
    makeRequest('POST', '/attendance', { authorization: `Bearer ${workerToken}` }),
    attendanceWriteResponse,
    () => {}
  )
  assert.equal(attendanceWriteResponse.statusCode, 403)

  const attendanceScanResponse = makeResponse()
  await authenticate(
    makeRequest('POST', '/attendance/scan', { authorization: `Bearer ${workerToken}` }),
    attendanceScanResponse,
    () => {}
  )
  assert.equal(attendanceScanResponse.statusCode, 403)

  const toolsReadResponse = makeResponse()
  let toolsReadContinued = false
  await authenticate(
    makeRequest('GET', '/assets', { authorization: `Bearer ${workerToken}` }),
    toolsReadResponse,
    () => {
      toolsReadContinued = true
    }
  )
  assert.equal(toolsReadContinued, true)

  const toolsWriteResponse = makeResponse()
  await authenticate(
    makeRequest('PUT', '/assets/asset-1', { authorization: `Bearer ${workerToken}` }),
    toolsWriteResponse,
    () => {}
  )
  assert.equal(toolsWriteResponse.statusCode, 403)

  const adminRouteResponse = makeResponse()
  await authenticate(
    makeRequest('GET', '/payroll', { authorization: `Bearer ${workerToken}` }),
    adminRouteResponse,
    () => {}
  )
  assert.equal(adminRouteResponse.statusCode, 403)
})

test('grants attendance and tools workers only their role-specific mobile routes', async () => {
  const secret = 'a'.repeat(32)
  const tokens = {
    timekeeper: jwt.sign({ id: 'timekeeper-1', type: 'worker' }, secret),
    custodian: jwt.sign({ id: 'custodian-1', type: 'worker' }, secret)
  }
  const workerRecords = {
    'timekeeper-1': { status: 'Active', role: 'Worker', position: 'Attendance Monitoring' },
    'custodian-1': { status: 'Active', role: 'Tools Monitoring' }
  }
  const db = {
    collection: () => ({
      doc: id => ({
        get: async () => workerRecords[id]
          ? { exists: true, data: () => workerRecords[id] }
          : { exists: false }
      })
    })
  }
  const authenticate = createApiAuthMiddleware({ db, jwtSecret: secret })

  for (const [workerRole, permitted, forbidden] of [
    [
      'timekeeper',
      [
        ['GET', '/workers'],
        ['POST', '/attendance'],
        ['POST', '/attendance/scan'],
        ['PUT', '/early-out-requests/request-1/review']
      ],
      [['POST', '/assets'], ['PUT', '/assets/asset-1']]
    ],
    [
      'custodian',
      [['GET', '/workers'], ['GET', '/assets'], ['PUT', '/assets/asset-1'], ['POST', '/borrow-history']],
      [['POST', '/attendance'], ['PUT', '/attendance-correction-requests/request-1/review']]
    ]
  ]) {
    for (const [method, path] of permitted) {
      const request = makeRequest(method, path, {
        authorization: `Bearer ${tokens[workerRole]}`
      })
      const response = makeResponse()
      let continued = false
      await authenticate(request, response, () => {
        continued = true
      })
      assert.equal(continued, true, `${workerRole} should be allowed ${method} ${path}`)
      assert.equal(request.worker?.id, workerRole === 'timekeeper' ? 'timekeeper-1' : 'custodian-1')
    }

    for (const [method, path] of forbidden) {
      const response = makeResponse()
      await authenticate(
        makeRequest(method, path, { authorization: `Bearer ${tokens[workerRole]}` }),
        response,
        () => {}
      )
      assert.equal(response.statusCode, 403, `${workerRole} should not access ${method} ${path}`)
    }
  }
})

test('rejects pending and inactive worker accounts', async () => {
  const secret = 'a'.repeat(32)
  const pendingToken = jwt.sign({ id: 'pending-worker', type: 'worker' }, secret)
  const inactiveToken = jwt.sign({ id: 'inactive-worker', type: 'worker' }, secret)
  const db = {
    collection: () => ({
      doc: id => ({
        get: async () => id === 'pending-worker'
          ? { exists: true, data: () => ({ approval_status: 'Pending', status: 'Inactive' }) }
          : { exists: true, data: () => ({ approval_status: 'Approved', status: 'Inactive' }) }
      })
    })
  }
  const authenticate = createApiAuthMiddleware({ db, jwtSecret: secret })

  for (const token of [pendingToken, inactiveToken]) {
    const response = makeResponse()
    await authenticate(
      makeRequest('GET', '/worker/notifications', { authorization: `Bearer ${token}` }),
      response,
      () => {}
    )
    assert.equal(response.statusCode, 403)
  }
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

test('allows an active attendance worker to scan with its JWT without exposing the RFID key', async () => {
  const secret = 'a'.repeat(32)
  const token = jwt.sign({ id: 'timekeeper-1', type: 'worker' }, secret)
  const db = {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => ({ status: 'Active', role: 'Attendance Monitoring' })
        })
      })
    })
  }
  const authenticate = createApiAuthMiddleware({
    db,
    jwtSecret: secret,
    rfidApiKey: 'b'.repeat(32)
  })
  const request = makeRequest('POST', '/attendance/scan', {
    authorization: `Bearer ${token}`
  })
  const response = makeResponse()
  let continued = false
  await authenticate(request, response, () => {
    continued = request.worker?.attendance === true
  })
  assert.equal(continued, true)
  assert.equal(response.statusCode, 200)
})
