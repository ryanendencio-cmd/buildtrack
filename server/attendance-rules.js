const DEFAULT_ATTENDANCE_SETTINGS = Object.freeze({
  morning_time_in_start: '07:00',
  morning_time_in_on_time_end: '08:00',
  morning_time_in_late_1_end: '08:10',
  morning_time_in_close: '08:20',
  morning_time_out_start: '12:00',
  morning_time_out_close: '12:30',
  afternoon_time_in_start: '12:30',
  afternoon_time_in_on_time_end: '13:00',
  afternoon_time_in_late_1_end: '13:10',
  afternoon_time_in_close: '13:20',
  afternoon_time_out_start: '17:00',
  afternoon_time_out_close: '17:30',
  late_tier_1_deduction: 100,
  late_tier_2_deduction: 200,
  overtime_rate_per_interval: 50,
  overtime_interval_minutes: 15
})

const TIME_SETTING_KEYS = Object.keys(DEFAULT_ATTENDANCE_SETTINGS)
  .filter(key => key.includes('_time_'))

function parseTimeToMinutes(timeStr) {
  if (!timeStr || timeStr === '—' || timeStr === '--:--') return null
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i)
  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridian = match[3]?.toUpperCase()
  if (minutes > 59 || hours > 24 || (meridian && hours > 12)) return null
  if (meridian === 'PM' && hours < 12) hours += 12
  if (meridian === 'AM' && hours === 12) hours = 0
  if (hours === 24 && minutes !== 0) return null
  return hours * 60 + minutes
}

function normalizeAttendanceSettings(settings = {}) {
  return { ...DEFAULT_ATTENDANCE_SETTINGS, ...settings }
}

function validateAttendanceSettings(settings) {
  const normalized = normalizeAttendanceSettings(settings)
  const minuteValues = {}
  for (const key of TIME_SETTING_KEYS) {
    if (!/^\d{2}:\d{2}$/.test(String(normalized[key] || ''))) {
      return `Attendance time ${key} must use HH:mm format.`
    }
    minuteValues[key] = parseTimeToMinutes(normalized[key])
    if (minuteValues[key] === null || minuteValues[key] > 1439) {
      return `Attendance time ${key} is invalid.`
    }
  }

  const ranges = [
    ['morning_time_in_start', 'morning_time_in_on_time_end', 'morning_time_in_late_1_end', 'morning_time_in_close'],
    ['afternoon_time_in_start', 'afternoon_time_in_on_time_end', 'afternoon_time_in_late_1_end', 'afternoon_time_in_close']
  ]
  if (ranges.some(keys => keys.some((key, index) =>
    index > 0 && minuteValues[key] < minuteValues[keys[index - 1]]))) {
    return 'Time-in schedules must be ordered from start through close.'
  }
  if (minuteValues.morning_time_out_close <= minuteValues.morning_time_out_start ||
      minuteValues.afternoon_time_out_close <= minuteValues.afternoon_time_out_start) {
    return 'Time-out closing times must be later than their start times.'
  }

  for (const key of ['late_tier_1_deduction', 'late_tier_2_deduction', 'overtime_rate_per_interval']) {
    const value = Number(normalized[key])
    if (!Number.isFinite(value) || value < 0 || value > 100000) {
      return `${key} must be a non-negative amount.`
    }
    normalized[key] = value
  }
  const interval = Number(normalized.overtime_interval_minutes)
  if (!Number.isInteger(interval) || interval < 1 || interval > 1440) {
    return 'Overtime interval must be between 1 and 1440 minutes.'
  }
  normalized.overtime_interval_minutes = interval
  return { settings: normalized }
}

function classifyTimeIn(timeStr, session, settings = {}) {
  const normalized = normalizeAttendanceSettings(settings)
  const minutes = parseTimeToMinutes(timeStr)
  if (minutes === null) return { status: 'Absent', deduction: 0 }

  const prefix = session === 'morning' ? 'morning' : 'afternoon'
  const start = parseTimeToMinutes(normalized[`${prefix}_time_in_start`])
  const onTimeEnd = parseTimeToMinutes(normalized[`${prefix}_time_in_on_time_end`])
  const tierOneEnd = parseTimeToMinutes(normalized[`${prefix}_time_in_late_1_end`])
  const close = parseTimeToMinutes(normalized[`${prefix}_time_in_close`])
  if (minutes < start || minutes > close) return { status: 'Absent', deduction: 0 }
  if (minutes <= onTimeEnd) return { status: 'Present', deduction: 0 }
  if (minutes <= tierOneEnd) {
    return { status: 'Late', deduction: Number(normalized.late_tier_1_deduction) }
  }
  return { status: 'Late', deduction: Number(normalized.late_tier_2_deduction) }
}

function resolveRfidAttendanceAction(minutes, record, settings = {}) {
  const normalized = normalizeAttendanceSettings(settings)
  const hasTime = value => Boolean(value && value !== '—' && value !== '--:--')
  const within = (startKey, closeKey) => {
    const start = parseTimeToMinutes(normalized[startKey])
    const close = parseTimeToMinutes(normalized[closeKey])
    return minutes !== null && start !== null && close !== null &&
      minutes >= start && minutes <= close
  }
  const hasMorningIn = hasTime(record?.morning_in)
  const hasMorningOut = hasTime(record?.morning_out)
  const hasAfternoonIn = hasTime(record?.afternoon_in)
  const hasAfternoonOut = hasTime(record?.afternoon_out)

  if (within('morning_time_out_start', 'morning_time_out_close')) {
    const afternoonStartsNow = minutes === parseTimeToMinutes(normalized.morning_time_out_close) &&
      within('afternoon_time_in_start', 'afternoon_time_in_close')
    if (!hasMorningIn && !afternoonStartsNow) {
      return { error: 'Cannot record morning Time Out without a morning Time In.', action: 'NO_TIME_IN' }
    }
    if (hasMorningIn && !hasMorningOut) return { action: 'MORNING TIME OUT (12 PM)' }
  }

  if (within('morning_time_in_start', 'morning_time_in_close')) {
    return hasMorningIn
      ? { error: 'Morning Time In has already been recorded.', action: 'ALREADY_COMPLETED' }
      : { action: 'MORNING TIME IN' }
  }
  if (within('afternoon_time_out_start', 'afternoon_time_out_close')) {
    if (!hasAfternoonIn) {
      return { error: 'Cannot record afternoon Time Out without an afternoon Time In.', action: 'NO_TIME_IN' }
    }
    return hasAfternoonOut
      ? { error: 'Afternoon shift is already completed.', action: 'ALREADY_COMPLETED' }
      : { action: 'AFTERNOON TIME OUT (5 PM)' }
  }
  if (within('afternoon_time_in_start', 'afternoon_time_in_close')) {
    return hasAfternoonIn
      ? { error: 'Afternoon Time In has already been recorded.', action: 'ALREADY_COMPLETED' }
      : { action: 'AFTERNOON TIME IN (1 PM)' }
  }
  return { error: 'Attendance is closed at this time.', action: 'ATTENDANCE_WINDOW_CLOSED' }
}

function evaluateTwoSessions(morningIn, afternoonIn, baseRate, rules = {}) {
  const rate = Math.max(0, Number(baseRate) || 0)
  const morning = classifyTimeIn(morningIn, 'morning', rules)
  const afternoon = classifyTimeIn(afternoonIn, 'afternoon', rules)
  const hasMorning = morning.status !== 'Absent'
  const hasAfternoon = afternoon.status !== 'Absent'
  const lateDeductions = (hasMorning ? morning.deduction : 0) +
    (hasAfternoon ? afternoon.deduction : 0)

  let earnedAmount = 0
  let status = 'Absent'
  if (hasMorning && hasAfternoon) {
    earnedAmount = Math.max(0, rate - lateDeductions)
    status = morning.status === 'Late' && afternoon.status === 'Late'
      ? 'Double Late'
      : (lateDeductions > 0 ? 'Late' : 'Present')
  } else if (hasMorning || hasAfternoon) {
    earnedAmount = Math.max(0, Math.round((rate / 2) * 100) / 100 - lateDeductions)
    const sessionStatus = hasMorning ? morning.status : afternoon.status
    status = sessionStatus === 'Late' ? 'Halfday (Late)' : 'Halfday'
  }

  return {
    status,
    morningStatus: morning.status,
    afternoonStatus: afternoon.status,
    lateDeductions,
    earnedAmount: Math.round(earnedAmount * 100) / 100
  }
}

function calculateOvertimePay(minutes, settings = {}) {
  const normalized = normalizeAttendanceSettings(settings)
  const validMinutes = Math.max(0, Math.floor(Number(minutes) || 0))
  const intervals = Math.floor(validMinutes / normalized.overtime_interval_minutes)
  return Math.round(intervals * normalized.overtime_rate_per_interval * 100) / 100
}

function calculateDailyEarnings({
  morningIn,
  afternoonIn,
  dailyRate,
  attendance = {},
  overtimeRequired = false,
  settings = {}
}) {
  const rate = Math.max(0, Number(dailyRate) || 0)
  const evaluation = evaluateTwoSessions(morningIn, afternoonIn, rate, settings)
  const isRestDay = String(attendance.status || '').includes('Rest Day') ||
    String(attendance.status || '').includes('Non-Working')
  const isAbsent = isRestDay || attendance.status === 'Absent' || evaluation.status === 'Absent'
  const validSessions = isAbsent
    ? 0
    : Number(evaluation.morningStatus !== 'Absent') + Number(evaluation.afternoonStatus !== 'Absent')
  const baseEarned = validSessions === 2
    ? rate
    : validSessions === 1 ? Math.round((rate / 2) * 100) / 100 : 0
  const attendanceDeduction = Math.min(baseEarned, evaluation.lateDeductions)
  const overtimeMinutes = !isAbsent && overtimeRequired && attendance.overtime_approved === true
    ? Math.max(0, Number(attendance.overtime_minutes) || 0)
    : 0
  const overtimePay = validSessions > 0
    ? calculateOvertimePay(overtimeMinutes, settings)
    : 0
  const dailySalary = Math.max(0, baseEarned - attendanceDeduction)

  return {
    status: isRestDay ? attendance.status : isAbsent ? 'Absent' : evaluation.status,
    hours: validSessions * 4,
    baseEarned,
    attendanceDeduction,
    overtimeMinutes,
    overtimePay,
    dailySalary,
    totalEarnings: dailySalary + overtimePay,
    evaluation
  }
}

module.exports = {
  DEFAULT_ATTENDANCE_SETTINGS,
  normalizeAttendanceSettings,
  parseTimeToMinutes,
  validateAttendanceSettings,
  classifyTimeIn,
  resolveRfidAttendanceAction,
  evaluateTwoSessions,
  calculateOvertimePay,
  calculateDailyEarnings
}
