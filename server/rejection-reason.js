const MAX_REJECTION_REASON_LENGTH = 100;

function validateRejectionReason(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { error: 'A rejection reason is required.' };
  }

  const reason = value.trim();
  if (reason.length > MAX_REJECTION_REASON_LENGTH) {
    return { error: `Rejection reason must be ${MAX_REJECTION_REASON_LENGTH} characters or fewer.` };
  }

  return { reason };
}

module.exports = {
  MAX_REJECTION_REASON_LENGTH,
  validateRejectionReason
};
