const test = require('node:test')
const assert = require('node:assert/strict')
const { getProjectExpenseLimit } = require('./expense-limit')

test('uses the lower contract amount or expense budget as the limit', () => {
  assert.equal(getProjectExpenseLimit({ budget: 5000000, contract_amount: 800000 }), 800000)
})

test('uses the available project amount when only one limit is present', () => {
  assert.equal(getProjectExpenseLimit({ budget: 250000 }), 250000)
  assert.equal(getProjectExpenseLimit({ contract_amount: 125000 }), 125000)
})

test('preserves a zero limit and returns null when no amount is configured', () => {
  assert.equal(getProjectExpenseLimit({ budget: 0, contract_amount: 800000 }), 0)
  assert.equal(getProjectExpenseLimit({}), null)
  assert.equal(getProjectExpenseLimit(null), null)
})
