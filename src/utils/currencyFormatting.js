export const normalizeCurrencyInput = (value, maxIntegerDigits = 12, maxFractionDigits = 2) => {
    const sanitized = String(value ?? '').replace(/[^\d.]/g, '')
    const [rawIntegerPart = '', ...fractionParts] = sanitized.split('.')
    const integerPart = rawIntegerPart.slice(0, maxIntegerDigits)
    if (!fractionParts.length) return integerPart

    const fractionPart = fractionParts.join('').slice(0, maxFractionDigits)

    return `${integerPart}.${fractionPart}`
}

export const formatCurrencyEditing = (value) => {
    const raw = String(value ?? '')
    if (!raw) return ''

    const [integerPart, ...fractionParts] = raw.split('.')
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') ||
        (fractionParts.length ? '0' : '')
    return fractionParts.length
        ? `${groupedInteger}.${fractionParts[0]}`
        : groupedInteger
}

export const formatCurrencyDisplay = (value) => {
    if (String(value ?? '').trim() === '') return ''
    const amount = Number(value)
    return Number.isFinite(amount)
        ? amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(value)
}
