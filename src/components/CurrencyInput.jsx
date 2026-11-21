import React, { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import {
    formatCurrencyDisplay,
    formatCurrencyEditing,
    normalizeCurrencyInput
} from '../utils/currencyFormatting'

const getCursorPosition = (formattedValue, characterCount) => {
    let position = 0
    let countedCharacters = 0
    while (position < formattedValue.length && countedCharacters < characterCount) {
        if (/[\d.]/.test(formattedValue[position])) countedCharacters += 1
        position += 1
    }
    return position
}

const CurrencyInput = forwardRef(function CurrencyInput({
    value,
    onValueChange,
    className,
    style,
    onFocus,
    onBlur,
    ...inputProps
}, forwardedRef) {
    const inputRef = useRef(null)
    const pendingCursorPosition = useRef(null)
    const rawValue = String(value ?? '')
    const [isFocused, setIsFocused] = useState(false)
    const displayValue = isFocused
        ? formatCurrencyEditing(rawValue)
        : formatCurrencyDisplay(rawValue)

    useLayoutEffect(() => {
        if (pendingCursorPosition.current === null || !inputRef.current) return
        inputRef.current.setSelectionRange(pendingCursorPosition.current, pendingCursorPosition.current)
        pendingCursorPosition.current = null
    })

    const setInputRef = (node) => {
        inputRef.current = node
        if (typeof forwardedRef === 'function') {
            forwardedRef(node)
        } else if (forwardedRef) {
            forwardedRef.current = node
        }
    }

    const handleChange = (event) => {
        const input = event.currentTarget
        const charactersBeforeCursor = input.value
            .slice(0, input.selectionStart ?? input.value.length)
            .replace(/[^\d.]/g, '').length
        const nextRawValue = normalizeCurrencyInput(input.value)
        const nextDisplayValue = formatCurrencyEditing(nextRawValue)

        pendingCursorPosition.current = getCursorPosition(nextDisplayValue, charactersBeforeCursor)
        onValueChange(nextRawValue)
    }

    const handleFocus = (event) => {
        setIsFocused(true)
        onFocus?.(event)
    }

    const handleBlur = (event) => {
        setIsFocused(false)
        onBlur?.(event)
    }

    return (
        <div className="relative w-full">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-gray-500" aria-hidden="true">
                ₱
            </span>
            <input
                {...inputProps}
                ref={setInputRef}
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className={className}
                style={{ ...style, paddingLeft: style?.paddingLeft || '2rem' }}
            />
        </div>
    )
})

export default CurrencyInput
