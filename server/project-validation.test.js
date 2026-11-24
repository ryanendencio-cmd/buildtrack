const test = require('node:test')
const assert = require('node:assert/strict')

const MAX_TITLE_LENGTH = 50
const MAX_FLOORS = 1000
const MAX_LOT_AREA = 100000000
const MAX_FLOOR_AREA = 5000000

function validateProjectPayload({ name, number_of_floors, lot_area, floor_area }) {
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return { valid: false, error: 'Project title is required and cannot be empty or spaces only.' }
    }
    if (/\d/.test(name)) {
      return { valid: false, error: 'Numbers are not allowed in the project title. Use letters, spaces, and punctuation only.' }
    }
    if (name.trim().length > MAX_TITLE_LENGTH) {
      return { valid: false, error: 'Project title cannot exceed 50 characters.' }
    }
  }

  if (number_of_floors !== undefined && number_of_floors !== null && String(number_of_floors).trim() !== '') {
    const fc = Number(number_of_floors)
    if (!Number.isInteger(fc) || fc < 1 || fc > MAX_FLOORS) {
      return { valid: false, error: 'Number of floors must be a whole number between 1 and 1,000.' }
    }
  }

  if (lot_area !== undefined && lot_area !== null && String(lot_area).trim() !== '') {
    const la = Number(lot_area)
    if (!Number.isFinite(la) || la <= 0 || la > MAX_LOT_AREA) {
      return { valid: false, error: 'Lot Area must be greater than 0 and cannot exceed 100,000,000 m².' }
    }
  }

  if (floor_area !== undefined && floor_area !== null && String(floor_area).trim() !== '') {
    const fa = Number(floor_area)
    if (!Number.isFinite(fa) || fa <= 0 || fa > MAX_FLOOR_AREA) {
      return { valid: false, error: 'Floor Area must be greater than 0 and cannot exceed 5,000,000 m².' }
    }
  }

  return { valid: true }
}

test('project title rejects numbers in title', () => {
  const result1 = validateProjectPayload({ name: '7273' })
  assert.equal(result1.valid, false)
  assert.match(result1.error, /Numbers are not allowed in the project title/)

  const result2 = validateProjectPayload({ name: 'Building 1' })
  assert.equal(result2.valid, false)
  assert.match(result2.error, /Numbers are not allowed in the project title/)
})

test('project title rejects empty or blank whitespace strings', () => {
  const empty = validateProjectPayload({ name: '' })
  assert.equal(empty.valid, false)
  assert.match(empty.error, /cannot be empty or spaces only/)

  const spaces = validateProjectPayload({ name: '     ' })
  assert.equal(spaces.valid, false)
  assert.match(spaces.error, /cannot be empty or spaces only/)
})

test('project title rejects titles exceeding 50 characters', () => {
  const longName = 'A'.repeat(51)
  const result = validateProjectPayload({ name: longName })
  assert.equal(result.valid, false)
  assert.match(result.error, /cannot exceed 50 characters/)
})

test('project title accepts valid titles without numbers up to 50 characters', () => {
  const valid = validateProjectPayload({ name: 'Modern House Villa Construction' })
  assert.equal(valid.valid, true)
})

test('number of floors rejects values <= 0 or > 1000 or decimals', () => {
  assert.equal(validateProjectPayload({ name: 'Valid Villa', number_of_floors: 0 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', number_of_floors: -5 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', number_of_floors: 1001 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', number_of_floors: 99999 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', number_of_floors: 2.5 }).valid, false)
})

test('number of floors accepts valid whole numbers between 1 and 1000', () => {
  assert.equal(validateProjectPayload({ name: 'Valid Villa', number_of_floors: 1 }).valid, true)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', number_of_floors: 15 }).valid, true)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', number_of_floors: 1000 }).valid, true)
})

test('lot area rejects <= 0 or > 100,000,000', () => {
  assert.equal(validateProjectPayload({ name: 'Valid Villa', lot_area: 0 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', lot_area: -10 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', lot_area: 100000001 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', lot_area: 500 }).valid, true)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', lot_area: 100000000 }).valid, true)
})

test('floor area rejects <= 0 or > 5,000,000', () => {
  assert.equal(validateProjectPayload({ name: 'Valid Villa', floor_area: 0 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', floor_area: -1 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', floor_area: 5000001 }).valid, false)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', floor_area: 250 }).valid, true)
  assert.equal(validateProjectPayload({ name: 'Valid Villa', floor_area: 5000000 }).valid, true)
})

