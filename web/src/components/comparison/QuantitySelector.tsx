import { useState, useEffect, useCallback } from 'react'

interface QuantitySelectorProps {
  value: number
  onChange: (quantity: number) => void
  min?: number
  /** Debounce delay in ms for input changes */
  debounceMs?: number
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  debounceMs = 150,
}: QuantitySelectorProps) {
  const [localValue, setLocalValue] = useState(value.toString())

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value.toString())
  }, [value])

  // Debounced onChange
  const debouncedOnChange = useCallback(
    (newValue: number) => {
      const timeoutId = setTimeout(() => {
        onChange(newValue)
      }, debounceMs)
      return () => clearTimeout(timeoutId)
    },
    [onChange, debounceMs]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value

    // Allow empty input while typing
    if (inputValue === '') {
      setLocalValue('')
      return
    }

    // Only allow digits
    if (!/^\d+$/.test(inputValue)) return

    const num = parseInt(inputValue, 10)
    if (isNaN(num)) return

    setLocalValue(inputValue)

    // Apply minimum bound
    const boundedValue = Math.max(min, num)
    debouncedOnChange(boundedValue)
  }

  const handleBlur = () => {
    // On blur, ensure we have a valid value
    const num = parseInt(localValue, 10)
    if (isNaN(num) || num < min) {
      setLocalValue(min.toString())
      onChange(min)
    } else {
      setLocalValue(num.toString())
      onChange(num)
    }
  }

  const handleDecrement = () => {
    const newValue = Math.max(min, value - 1)
    setLocalValue(newValue.toString())
    onChange(newValue)
  }

  const handleIncrement = () => {
    const newValue = value + 1
    setLocalValue(newValue.toString())
    onChange(newValue)
  }

  // Handle large increments with shift+click
  const handleIncrementLarge = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      const newValue = value + 10
      setLocalValue(newValue.toString())
      onChange(newValue)
    } else {
      handleIncrement()
    }
  }

  const handleDecrementLarge = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      const newValue = Math.max(min, value - 10)
      setLocalValue(newValue.toString())
      onChange(newValue)
    } else {
      handleDecrement()
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={handleDecrementLarge}
        disabled={value <= min}
        className="w-6 h-6 flex items-center justify-center rounded-l bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
        aria-label="Decrease quantity"
        title="Shift+click for -10"
      >
        -
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={localValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="w-12 text-center px-1 py-0.5 text-sm border-y border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={handleIncrementLarge}
        className="w-6 h-6 flex items-center justify-center rounded-r bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
        aria-label="Increase quantity"
        title="Shift+click for +10"
      >
        +
      </button>
    </div>
  )
}
