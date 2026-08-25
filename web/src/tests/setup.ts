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

// jsdom does not implement Blob.prototype.stream() (jsdom#2555), and unlike
// arrayBuffer()/text() it is not polyfilled by the vitest jsdom environment
// either. Newer @zip.js/zip.js (2.8.55 onwards here) reads a whole Blob
// through stream() rather than arrayBuffer(), so any test that builds a zip
// in memory dies with
// "sourceBlob.stream is not a function". Node's own Blob is shadowed by
// jsdom's here, so we back the missing method with arrayBuffer().
if (typeof Blob !== 'undefined' && typeof Blob.prototype.stream !== 'function') {
  Blob.prototype.stream = function stream(this: Blob) {
    return new ReadableStream({
      pull: async (controller) => {
        controller.enqueue(new Uint8Array(await this.arrayBuffer()))
        controller.close()
      },
    })
  } as Blob['stream']
}

// Mock URL.createObjectURL and revokeObjectURL
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = vi.fn()
}

// Suppress console output in tests to avoid vitest EnvironmentTeardownError.
// Vitest workers can race between closing RPC and pending console.log messages.
// Silencing console output eliminates the "onUserConsoleLog" RPC calls entirely.
// This also suppresses expected errors/warnings from component code.
const originalError = console.error
const originalWarn = console.warn
const originalLog = console.log

beforeAll(() => {
  // Replace with synchronous no-ops to prevent any console RPC traffic
  console.log = () => {}
  console.error = () => {}
  console.warn = () => {}
})

afterAll(() => {
  console.log = originalLog
  console.error = originalError
  console.warn = originalWarn
})

// Cleanup after each test.
// Flush pending microtasks after cleanup to prevent console output from
// racing with vitest environment teardown ("Closing rpc while
// onUserConsoleLog was pending" flake).
afterEach(async () => {
  cleanup()
  await new Promise(resolve => setTimeout(resolve, 0))
  vi.clearAllMocks()
})
