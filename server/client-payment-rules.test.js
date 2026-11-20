const test = require('node:test')
const assert = require('node:assert/strict')
const {
  getMinimumDownPayment,
  validateDownPaymentPolicy,
  validateClientPaymentReceipt,
  validateReceiptRequirement
} = require('./client-payment-rules')

test('minimum downpayment is 20 percent of the contract amount', () => {
  assert.equal(getMinimumDownPayment(800000), 160000)
  assert.equal(
    validateDownPaymentPolicy({
      amount: 159999,
      paymentType: 'Downpayment',
      contractAmount: 800000,
      downPaymentReceived: 0
    }),
    'Downpayment must reach at least 20% of the contract amount (₱160,000).'
  )
  assert.equal(
    validateDownPaymentPolicy({
      amount: 320000,
      paymentType: 'Downpayment',
      contractAmount: 800000,
      downPaymentReceived: 0
    }),
    null
  )
})

test('progress payments require the minimum downpayment to be recorded first', () => {
  assert.match(
    validateDownPaymentPolicy({
      amount: 50000,
      paymentType: 'Progress Payment',
      contractAmount: 800000,
      downPaymentReceived: 100000
    }),
    /Remaining downpayment: ₱60,000/
  )
  assert.equal(
    validateDownPaymentPolicy({
      amount: 50000,
      paymentType: 'Progress Payment',
      contractAmount: 800000,
      downPaymentReceived: 160000
    }),
    null
  )
})

test('non-cash receipts must be valid supported image data', () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64')
  assert.ok(validateClientPaymentReceipt(`data:image/png;base64,${png}`).receiptImage)
  assert.match(validateClientPaymentReceipt('data:text/plain;base64,Zm9v').error, /JPG, PNG, or WebP/)
  assert.equal(validateReceiptRequirement('Cash', null), null)
  assert.match(validateReceiptRequirement('Bank Transfer', null), /receipt image/)
  assert.equal(validateReceiptRequirement('Bank Transfer', 'data:image/png;base64,receipt'), null)
})
