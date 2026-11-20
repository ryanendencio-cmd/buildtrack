const MINIMUM_DOWN_PAYMENT_RATE = 0.2
const MAX_RECEIPT_BYTES = 512 * 1024

function getMinimumDownPayment(contractAmount) {
  const amount = Number(contractAmount)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.round(amount * MINIMUM_DOWN_PAYMENT_RATE * 100) / 100
}

function validateDownPaymentPolicy({ amount, paymentType, contractAmount, downPaymentReceived }) {
  const minimum = getMinimumDownPayment(contractAmount)
  const received = Number(downPaymentReceived) || 0
  const paymentAmount = Number(amount) || 0
  const minimumCents = Math.round(minimum * 100)
  const receivedCents = Math.round(received * 100)
  const paymentCents = Math.round(paymentAmount * 100)

  if (paymentType === 'Downpayment' && receivedCents + paymentCents < minimumCents) {
    return `Downpayment must reach at least 20% of the contract amount (₱${minimum.toLocaleString()}).`
  }
  if (paymentType !== 'Downpayment' && receivedCents < minimumCents) {
    const remaining = Math.max(0, minimum - received)
    return `Record the minimum 20% downpayment first. Remaining downpayment: ₱${remaining.toLocaleString()}.`
  }
  return null
}

function validateClientPaymentReceipt(value) {
  if (value == null || value === '') return { receiptImage: null }
  if (typeof value !== 'string') return { error: 'Payment receipt must be an image.' }

  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) {
    return { error: 'Payment receipt must be a JPG, PNG, or WebP image.' }
  }

  const [, mimeType, encoded] = match
  const bytes = Buffer.from(encoded, 'base64')
  if (!bytes.length || bytes.length > MAX_RECEIPT_BYTES || bytes.toString('base64') !== encoded) {
    return { error: 'Payment receipt must be 512 KB or smaller.' }
  }

  const isPng = mimeType === 'png' &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isJpeg = mimeType === 'jpeg' &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isWebp = mimeType === 'webp' &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'

  if (!isPng && !isJpeg && !isWebp) {
    return { error: 'The selected payment receipt is not a valid image.' }
  }

  return { receiptImage: value }
}

function validateReceiptRequirement(paymentMethod, receiptImage) {
  return paymentMethod !== 'Cash' && !receiptImage
    ? 'Upload a receipt image for non-cash payments.'
    : null
}

module.exports = {
  getMinimumDownPayment,
  validateDownPaymentPolicy,
  validateClientPaymentReceipt,
  validateReceiptRequirement
}
