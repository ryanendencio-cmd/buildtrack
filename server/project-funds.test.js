const assert = require('node:assert/strict')
const test = require('node:test')
const { calculateProjectFunding } = require('./project-funds')

test('caps the project limit by client payments and subtracts expenses and paid salary once', () => {
  const funding = calculateProjectFunding({
    project: { budget: 50000, contract_amount: 80000 },
    projectId: 'project-1',
    payments: [{ amount: 25000 }],
    expenses: [{ amount: 12000 }],
    payrolls: [
      { id: 'paid-1', project_id: 'project-1', status: 'Paid', summary: { totalNetPayout: 5000 } },
      { id: 'draft-1', project_id: 'project-1', status: 'Draft', summary: { totalNetPayout: 3000 } },
      { id: 'other-1', project_id: 'project-2', status: 'Paid', summary: { totalNetPayout: 4000 } }
    ]
  })

  assert.deepEqual(funding, {
    totalPayments: 25000,
    totalExpenses: 12000,
    totalPaidSalaries: 5000,
    expenseLimit: 25000,
    remaining: 8000
  })
})

test('excludes the payroll being changed to Paid from existing salary totals', () => {
  const funding = calculateProjectFunding({
    project: { budget: 100000, contract_amount: 100000 },
    projectId: 'project-1',
    payments: [{ amount: 40000 }],
    expenses: [{ amount: 10000 }],
    payrolls: [
      { id: 'current', project_id: 'project-1', status: 'Paid', summary: { totalNetPayout: 5000 } },
      { id: 'other', project_id: 'project-1', status: 'Paid', summary: { totalNetPayout: 3000 } }
    ],
    excludePayrollId: 'current'
  })

  assert.equal(funding.remaining, 27000)
})

test('excludes the expense being updated before checking its replacement amount', () => {
  const funding = calculateProjectFunding({
    project: { budget: 30000 },
    projectId: 'project-1',
    payments: [{ amount: 30000 }],
    expenses: [
      { id: 'current-expense', amount: 12000 },
      { id: 'other-expense', amount: 5000 }
    ],
    payrolls: [],
    excludeExpenseId: 'current-expense'
  })

  assert.equal(funding.remaining, 25000)
})
