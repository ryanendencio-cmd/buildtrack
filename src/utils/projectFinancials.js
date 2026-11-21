const sumAmounts = (records, label) => records.reduce((sum, record) => {
    const amount = Number(record?.amount ?? 0)
    if (!Number.isFinite(amount)) {
        throw new TypeError(`Invalid ${label} amount.`)
    }
    return sum + amount
}, 0)

export const calculateProjectFunding = ({
    projectId,
    payments,
    expenses,
    payrolls,
    configuredExpenseLimit
}) => {
    if (![payments, expenses, payrolls].every(Array.isArray)) {
        throw new TypeError('Payments, expenses, and payrolls must be arrays.')
    }

    const totalPayments = sumAmounts(payments, 'client payment')
    const totalExpenses = sumAmounts(expenses, 'expense')
    const totalPaidSalaries = payrolls.reduce((sum, payroll) => {
        if (
            String(payroll?.project_id ?? '') !== String(projectId) ||
            String(payroll?.status || '').toLowerCase() !== 'paid'
        ) {
            return sum
        }

        const payout = Number(payroll.summary?.totalNetPayout ?? 0)
        if (!Number.isFinite(payout)) {
            throw new TypeError('Invalid paid salary amount.')
        }
        return sum + payout
    }, 0)

    const configuredLimit = configuredExpenseLimit == null
        ? totalPayments
        : Number(configuredExpenseLimit)
    if (!Number.isFinite(configuredLimit) || configuredLimit < 0) {
        throw new TypeError('Invalid configured expense limit.')
    }

    const expenseLimit = Math.min(totalPayments, configuredLimit)
    return {
        totalPayments,
        totalExpenses,
        totalPaidSalaries,
        expenseLimit,
        remaining: expenseLimit - totalExpenses - totalPaidSalaries
    }
}
