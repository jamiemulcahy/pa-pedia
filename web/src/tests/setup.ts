import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import 'fake-indexeddb/auto'

// Override global fetch to handle relative URLs in tests
// Node.js fetch requires absolute URLs, but browser fetch resolves relative URLs
// This mock allows relative URLs by converting them to absolute before processing
const originalFetch = globalThis.fetch
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url: string
  if (typeof input === 'string') {
    url = input
  } else if (input instanceof URL) {
    url = input.href
  } else if (input instanceof Request) {
    url = input.url
  } else {
    url = String(input)
  }

  // Convert relative URLs to absolute for Node.js fetch compatibility
  // Tests will mock fetch separately, this just ensures URL parsing works
  if (url.startsWith('/')) {
    url = `http://localhost${url}`
  }

  return originalFetch(url, init)
}

// Mock URL.createObjectURL and revokeObjectURL
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = vi.fn()
}

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
