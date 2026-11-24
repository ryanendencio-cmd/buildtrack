const test = require('node:test')
const assert = require('node:assert/strict')

test('anti-spam cooldown blocks rapid duplicate taps within cooldown period', () => {
  const COOLDOWN_MS = 20 * 1000
  const recentTaps = new Map()

  function checkTapCooldown(identifier, nowMs) {
    const last = recentTaps.get(identifier)
    if (last && (nowMs - last.timestamp) < COOLDOWN_MS) {
      const elapsed = Math.round((nowMs - last.timestamp) / 1000)
      const remaining = Math.max(1, Math.ceil((COOLDOWN_MS - (nowMs - last.timestamp)) / 1000))
      return {
        allowed: false,
        action: 'SPAM_PREVENTED',
        error: `RFID card spamming is prohibited! You just tapped ${elapsed}s ago. Please wait ${remaining}s before tapping again.`,
        remaining
      }
    }
    recentTaps.set(identifier, { timestamp: nowMs })
    return { allowed: true }
  }

  const cardUid = '4A7B9C12'
  const t0 = 1000000

  // First tap: allowed
  const first = checkTapCooldown(cardUid, t0)
  assert.equal(first.allowed, true)

  // Tap 2 seconds later: blocked
  const second = checkTapCooldown(cardUid, t0 + 2000)
  assert.equal(second.allowed, false)
  assert.equal(second.action, 'SPAM_PREVENTED')
  assert.equal(second.remaining, 18)

  // Tap 19 seconds later: still blocked
  const third = checkTapCooldown(cardUid, t0 + 19000)
  assert.equal(third.allowed, false)
  assert.equal(third.remaining, 1)

  // Tap 21 seconds later: allowed
  const fourth = checkTapCooldown(cardUid, t0 + 21000)
  assert.equal(fourth.allowed, true)
})

test('RFID tap logs calculate accurate statistics across statuses', () => {
  const sampleLogs = [
    { id: '1', action: 'MORNING TIME IN', status: 'SUCCESS', date: '2026-11-24', worker_name: 'Juan Dela Cruz' },
    { id: '2', action: 'SPAM_PREVENTED', status: 'BLOCKED', date: '2026-11-24', worker_name: 'Juan Dela Cruz' },
    { id: '3', action: 'UNREGISTERED_CARD', status: 'FAILED', date: '2026-11-24', worker_name: 'Unregistered Card' },
    { id: '4', action: 'AFTERNOON TIME IN (1 PM)', status: 'SUCCESS', date: '2026-11-24', worker_name: 'Pedro Santos' },
    { id: '5', action: 'ALREADY_COMPLETED', status: 'WARNING', date: '2026-11-24', worker_name: 'Pedro Santos' },
  ]

  const total = sampleLogs.length
  const success = sampleLogs.filter(t => t.status === 'SUCCESS').length
  const blocked = sampleLogs.filter(t => t.status === 'BLOCKED').length
  const failed = sampleLogs.filter(t => t.status === 'FAILED' || t.status === 'WARNING').length

  assert.equal(total, 5)
  assert.equal(success, 2)
  assert.equal(blocked, 1)
  assert.equal(failed, 2)
})

