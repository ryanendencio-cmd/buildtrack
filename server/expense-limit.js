function getProjectExpenseLimit(project) {
  if (!project || typeof project !== 'object') return null
  const limits = [project.budget, project.contract_amount]
    .filter(value => value !== undefined && value !== null && value !== '')
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 0)
  return limits.length ? Math.min(...limits) : null
}

module.exports = { getProjectExpenseLimit }
