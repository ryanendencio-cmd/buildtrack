import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateProjectFunding } from './projectFinancials.js'

test('caps spending at client payments and subtracts expenses and paid salaries once', () => {
    const funding = calculateProjectFunding({
        projectId: 'project-1',
        payments: [{ amount: 25000 }],
        expenses: [{ amount: 12000 }],
        payrolls: [
            { project_id: 'project-1', status: 'Paid', summary: { totalNetPayout: 5000 } },
            { project_id: 'project-1', status: 'Draft', summary: { totalNetPayout: 3000 } },
            { project_id: 'project-2', status: 'Paid', summary: { totalNetPayout: 4000 } }
        ],
        configuredExpenseLimit: 50000
    })

    assert.deepEqual(funding, {
        totalPayments: 25000,
        totalExpenses: 12000,
        totalPaidSalaries: 5000,
        expenseLimit: 25000,
        remaining: 8000
    })
})

test('honors the configured project limit when it is below client payments', () => {
    const funding = calculateProjectFunding({
        projectId: 'project-1',
        payments: [{ amount: 25000 }],
        expenses: [{ amount: 3000 }],
        payrolls: [{ project_id: 'project-1', status: 'Paid', summary: { totalNetPayout: 2000 } }],
        configuredExpenseLimit: 10000
    })

    assert.equal(funding.expenseLimit, 10000)
    assert.equal(funding.remaining, 5000)
})
