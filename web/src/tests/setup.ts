import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'

// Suppress console errors/warnings in tests (expected errors from code logging)
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = typeof args[0] === 'string' ? args[0] : ''

    // Suppress expected errors
    if (
      message.includes('Not implemented: HTMLFormElement.prototype.submit') ||
      message.includes('Error: Could not parse CSS stylesheet') ||
      message.includes('Error loading faction') ||
      message.includes('Error loading unit') ||
      message.includes('Failed to load faction') ||
      message.includes('Failed to load unit') ||
      message.includes('Network error')
    ) {
      return
    }
    originalError(...args)
  }

  console.warn = (...args: unknown[]) => {
    const message = typeof args[0] === 'string' ? args[0] : ''

    // Suppress expected warnings
    if (
      message.includes('ReactDOM.render') ||
      message.includes('useLayoutEffect') ||
      message.includes('An update to') ||
      message.includes('act(...)')
    ) {
      return
    }
    originalWarn(...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
