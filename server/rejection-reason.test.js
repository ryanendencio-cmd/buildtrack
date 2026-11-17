const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_REJECTION_REASON_LENGTH,
  validateRejectionReason
} = require('./rejection-reason');

test('requires a non-blank rejection reason', () => {
  assert.match(validateRejectionReason('').error, /required/);
  assert.match(validateRejectionReason('   ').error, /required/);
  assert.match(validateRejectionReason(null).error, /required/);
});

test('trims and accepts reasons up to the configured maximum', () => {
  const reason = ` ${'x'.repeat(MAX_REJECTION_REASON_LENGTH)} `;
  assert.equal(validateRejectionReason(reason).reason, 'x'.repeat(MAX_REJECTION_REASON_LENGTH));
});

test('rejects reasons longer than the configured maximum', () => {
  assert.match(
    validateRejectionReason('x'.repeat(MAX_REJECTION_REASON_LENGTH + 1)).error,
    /100 characters or fewer/
  );
});
