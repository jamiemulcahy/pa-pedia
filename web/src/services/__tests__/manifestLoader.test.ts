import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadManifest,
  invalidateManifestCache,
  findManifestHttpError,
  ManifestHttpError,
} from '../manifestLoader'

function respond(status: number, statusText: string, headers: Record<string, string> = {}) {
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response('<html>blocked</html>', { status, statusText, headers })),
  ) as unknown as typeof fetch
}

/** Loads the manifest expecting failure, returning what loadManifest threw. */
async function loadFailure(): Promise<unknown> {
  try {
    await loadManifest()
  } catch (error) {
    return error
  }
  throw new Error('expected loadManifest to reject')
}

describe('manifest HTTP failures', () => {
  beforeEach(() => {
    invalidateManifestCache()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // PA-PEDIA-9: a Cloudflare challenge on the manifest fetch. With no cached
  // manifest, the HTTP error is only reachable as the cause.
  it('classifies a challenged 403 as an edge block, with Cloudflare diagnostics', async () => {
    respond(403, 'Forbidden', {
      'cf-mitigated': 'challenge',
      'cf-ray': '8c1f2e3d4c5b6a79-SIN',
      'content-type': 'text/html; charset=UTF-8',
    })

    const error = await loadFailure()
    expect((error as Error).message).toBe('No manifest available (network error and no cache)')

    const httpError = findManifestHttpError(error)
    expect(httpError).toBeInstanceOf(ManifestHttpError)
    expect(httpError?.message).toBe('Failed to load manifest: 403 Forbidden')
    expect(httpError?.diagnostics).toEqual({
      status: 403,
      cfMitigated: 'challenge',
      cfRay: '8c1f2e3d4c5b6a79-SIN',
      contentType: 'text/html; charset=UTF-8',
      edgeBlocked: true,
    })
  })

  // A WAF block rule answers 403 without cf-mitigated; Pages itself never
  // returns 403 for a public static file, so the status alone is enough.
  it('treats a bare 403 as an edge block', async () => {
    respond(403, 'Forbidden')
    expect(findManifestHttpError(await loadFailure())?.edgeBlocked).toBe(true)
  })

  it('treats a 429 as an edge block (Cloudflare rate limiting)', async () => {
    respond(429, 'Too Many Requests')
    expect(findManifestHttpError(await loadFailure())?.edgeBlocked).toBe(true)
  })

  // The case that must stay an error: a broken deploy is a real outage.
  it.each([
    [404, 'Not Found'],
    [500, 'Internal Server Error'],
  ])('does not treat %i as an edge block', async (status, statusText) => {
    respond(status, statusText)
    const httpError = findManifestHttpError(await loadFailure())
    expect(httpError?.status).toBe(status)
    expect(httpError?.edgeBlocked).toBe(false)
  })

  it('finds nothing behind a network failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch
    expect(findManifestHttpError(await loadFailure())).toBeNull()
  })
})

describe('findManifestHttpError', () => {
  it('returns null for non-errors', () => {
    expect(findManifestHttpError(undefined)).toBeNull()
    expect(findManifestHttpError('boom')).toBeNull()
  })

  it('terminates on a cyclic cause chain', () => {
    const a = new Error('a')
    const b = new Error('b', { cause: a })
    ;(a as { cause?: unknown }).cause = b
    expect(findManifestHttpError(a)).toBeNull()
  })
})
