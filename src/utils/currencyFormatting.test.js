import assert from 'node:assert/strict'
import test from 'node:test'
import {
    formatCurrencyDisplay,
    formatCurrencyEditing,
    normalizeCurrencyInput
} from './currencyFormatting.js'

test('formats grouped currency values while keeping raw values numeric', () => {
    assert.equal(normalizeCurrencyInput('₱1,234,567.89'), '1234567.89')
    assert.equal(formatCurrencyEditing('1234567.8'), '1,234,567.8')
    assert.equal(formatCurrencyDisplay('1234567.8'), '1,234,567.80')
})

test('limits currency input to one decimal separator and two fractional digits', () => {
    assert.equal(normalizeCurrencyInput('12.3.456'), '12.34')
    assert.equal(normalizeCurrencyInput('12.345'), '12.34')
})

test('limits the integer portion of every currency input to 12 digits', () => {
    assert.equal(normalizeCurrencyInput('1234567890123'), '123456789012')
    assert.equal(normalizeCurrencyInput('1234567890123.456'), '123456789012.45')
})
