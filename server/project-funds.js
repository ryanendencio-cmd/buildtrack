const { getProjectExpenseLimit } = require('./expense-limit')

const sumAmounts = (records, label) => records.reduce((sum, record) => {
  const amount = Number(record?.amount ?? 0)
  if (!Number.isFinite(amount)) {
    throw new TypeError(`Invalid ${label} amount.`)
  }
  return sum + amount
}, 0)

function calculateProjectFunding({
  project,
  projectId,
  payments,
  expenses,
  payrolls,
  excludePayrollId = null,
  excludeExpenseId = null
}) {
  if (![payments, expenses, payrolls].every(Array.isArray)) {
    throw new TypeError('Payments, expenses, and payrolls must be arrays.')
  }

  const totalPayments = sumAmounts(payments, 'client payment')
  const totalExpenses = sumAmounts(
    expenses.filter(expense => expense.id !== excludeExpenseId),
    'expense'
  )
  const totalPaidSalaries = payrolls.reduce((sum, payroll) => {
    if (
      payroll.id === excludePayrollId ||
      String(payroll.project_id ?? '') !== String(projectId) ||
      String(payroll.status || '').toLowerCase() !== 'paid'
    ) {
      return sum
    }

    const payout = Number(payroll.summary?.totalNetPayout ?? 0)
    if (!Number.isFinite(payout)) {
      throw new TypeError('Invalid paid salary amount.')
    }
    return sum + payout
  }, 0)

  const configuredLimit = getProjectExpenseLimit(project)
  const expenseLimit = configuredLimit === null
    ? totalPayments
    : Math.min(configuredLimit, totalPayments)

  return {
    totalPayments,
    totalExpenses,
    totalPaidSalaries,
    expenseLimit,
    remaining: expenseLimit - totalExpenses - totalPaidSalaries
  }
}

async function loadProjectFunding(
  db,
  project,
  projectId,
  excludePayrollId = null,
  excludeExpenseId = null
) {
  const [paymentsSnapshot, expensesSnapshot, payrollsSnapshot] = await Promise.all([
    db.collection('client_payments').where('project_id', '==', projectId).get(),
    db.collection('expenses').where('project_id', '==', projectId).get(),
    db.collection('payrolls').where('project_id', '==', projectId).get()
  ])
  const documents = snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

  return calculateProjectFunding({
    project,
    projectId,
    payments: documents(paymentsSnapshot),
    expenses: documents(expensesSnapshot),
    payrolls: documents(payrollsSnapshot),
    excludePayrollId,
    excludeExpenseId
  })
}

module.exports = { calculateProjectFunding, loadProjectFunding }
