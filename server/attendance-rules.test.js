const test = require('node:test')
const assert = require('node:assert/strict')
const {
  DEFAULT_ATTENDANCE_SETTINGS,
  validateAttendanceSettings,
  classifyTimeIn,
  resolveRfidAttendanceAction,
  evaluateTwoSessions,
  calculateOvertimePay,
  calculateDailyEarnings
} = require('./attendance-rules')

test('morning time-in boundaries classify all configured tiers', () => {
  const rules = DEFAULT_ATTENDANCE_SETTINGS
  assert.deepEqual(classifyTimeIn('07:00', 'morning', rules), { status: 'Present', deduction: 0 })
  assert.deepEqual(classifyTimeIn('08:00', 'morning', rules), { status: 'Present', deduction: 0 })
  assert.deepEqual(classifyTimeIn('08:01', 'morning', rules), { status: 'Late', deduction: 100 })
  assert.deepEqual(classifyTimeIn('08:10', 'morning', rules), { status: 'Late', deduction: 100 })
  assert.deepEqual(classifyTimeIn('08:11', 'morning', rules), { status: 'Late', deduction: 200 })
  assert.deepEqual(classifyTimeIn('08:20', 'morning', rules), { status: 'Late', deduction: 200 })
  assert.deepEqual(classifyTimeIn('08:21', 'morning', rules), { status: 'Absent', deduction: 0 })
})

test('afternoon time-in applies the matching configured windows', () => {
  const rules = DEFAULT_ATTENDANCE_SETTINGS
  assert.equal(classifyTimeIn('12:30', 'afternoon', rules).status, 'Present')
  assert.equal(classifyTimeIn('13:00', 'afternoon', rules).status, 'Present')
  assert.equal(classifyTimeIn('13:01', 'afternoon', rules).deduction, 100)
  assert.equal(classifyTimeIn('13:11', 'afternoon', rules).deduction, 200)
  assert.equal(classifyTimeIn('13:21', 'afternoon', rules).status, 'Absent')
})

test('late deductions are fixed per late session and half-day pay is preserved', () => {
  const twoSessions = evaluateTwoSessions('08:01', '13:11', 600)
  assert.equal(twoSessions.status, 'Double Late')
  assert.equal(twoSessions.lateDeductions, 300)
  assert.equal(twoSessions.earnedAmount, 300)

  const oneSession = evaluateTwoSessions('08:11', '—', 600)
  assert.equal(oneSession.status, 'Halfday (Late)')
  assert.equal(oneSession.lateDeductions, 200)
  assert.equal(oneSession.earnedAmount, 100)
})

test('daily salary applies each late deduction once and only pays approved required overtime', () => {
  const record = {
    overtime_approved: true,
    overtime_minutes: 30
  }
  const paid = calculateDailyEarnings({
    morningIn: '08:01',
    afternoonIn: '13:11',
    dailyRate: 600,
    attendance: record,
    overtimeRequired: true
  })
  assert.equal(paid.baseEarned, 600)
  assert.equal(paid.attendanceDeduction, 300)
  assert.equal(paid.overtimePay, 100)
  assert.equal(paid.totalEarnings, 400)

  const notRequired = calculateDailyEarnings({
    morningIn: '08:01',
    afternoonIn: '13:11',
    dailyRate: 600,
    attendance: record,
    overtimeRequired: false
  })
  assert.equal(notRequired.overtimePay, 0)
  assert.equal(notRequired.attendanceDeduction, 300)
})

test('overtime pays only complete approved intervals', () => {
  assert.equal(calculateOvertimePay(14), 0)
  assert.equal(calculateOvertimePay(15), 50)
  assert.equal(calculateOvertimePay(29), 50)
  assert.equal(calculateOvertimePay(30), 100)
})

test('RFID actions enforce configured time-in and time-out windows', () => {
  const rules = DEFAULT_ATTENDANCE_SETTINGS
  assert.equal(resolveRfidAttendanceAction(8 * 60 + 21, null, rules).action, 'ATTENDANCE_WINDOW_CLOSED')
  assert.equal(resolveRfidAttendanceAction(12 * 60 + 29, null, rules).action, 'NO_TIME_IN')
  assert.equal(resolveRfidAttendanceAction(12 * 60 + 30, null, rules).action, 'AFTERNOON TIME IN (1 PM)')
  assert.equal(
    resolveRfidAttendanceAction(12 * 60, { morning_in: '08:00 AM' }, rules).action,
    'MORNING TIME OUT (12 PM)'
  )
  assert.equal(
    resolveRfidAttendanceAction(17 * 60, { afternoon_in: '01:00 PM' }, rules).action,
    'AFTERNOON TIME OUT (5 PM)'
  )
  assert.equal(resolveRfidAttendanceAction(17 * 60 + 31, { afternoon_in: '01:00 PM' }, rules).action, 'ATTENDANCE_WINDOW_CLOSED')
})

test('settings validation rejects unordered or malformed time windows', () => {
  assert.equal(typeof validateAttendanceSettings({ ...DEFAULT_ATTENDANCE_SETTINGS, morning_time_in_close: '08:05' }), 'string')
  assert.equal(typeof validateAttendanceSettings({ ...DEFAULT_ATTENDANCE_SETTINGS, afternoon_time_out_close: 'bad' }), 'string')
  assert.equal(typeof validateAttendanceSettings(DEFAULT_ATTENDANCE_SETTINGS), 'object')
})
