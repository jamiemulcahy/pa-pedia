import { describe, it, expect, vi } from 'vitest'
import { checkForNewBuild, entryScriptOf } from '../staleBuild'

/** A document shaped like Vite's built index.html. */
function htmlWithEntry(src: string | null): string {
  return `<!doctype html><html><head>
    <script type="application/ld+json">{}</script>
    ${src ? `<script type="module" crossorigin src="${src}"></script>` : ''}
  </head><body><div id="root"></div></body></html>`
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function respond(body: string, init: ResponseInit = {}): typeof fetch {
  return vi.fn(async () => new Response(body, init)) as unknown as typeof fetch
}

const running = parse(htmlWithEntry('/assets/index-OLD.js'))

describe('entryScriptOf', () => {
  it('returns the module entry, ignoring non-module scripts', () => {
    expect(entryScriptOf(running)).toBe('/assets/index-OLD.js')
  })

  it('returns null when there is no module entry', () => {
    expect(entryScriptOf(parse(htmlWithEntry(null)))).toBeNull()
  })
})

describe('checkForNewBuild', () => {
  it('is stale when the deployed entry differs from the running one', async () => {
    const fetchImpl = respond(htmlWithEntry('/assets/index-NEW.js'))
    expect(await checkForNewBuild(fetchImpl, running)).toBe('stale')
  })

  it('bypasses the HTTP cache', async () => {
    const fetchImpl = respond(htmlWithEntry('/assets/index-NEW.js'))
    await checkForNewBuild(fetchImpl, running)
    expect(fetchImpl).toHaveBeenCalledWith('/', expect.objectContaining({ cache: 'no-store' }))
  })

  it('is current when the deployed entry matches — so a reloaded tab is never told to reload again', async () => {
    const fetchImpl = respond(htmlWithEntry('/assets/index-OLD.js'))
    expect(await checkForNewBuild(fetchImpl, running)).toBe('current')
  })

  it('is unknown when offline', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect(await checkForNewBuild(fetchImpl, running)).toBe('unknown')
  })

  it('is unknown on an error response', async () => {
    const fetchImpl = respond(htmlWithEntry('/assets/index-NEW.js'), { status: 503 })
    expect(await checkForNewBuild(fetchImpl, running)).toBe('unknown')
  })

  it('is unknown when the response has no entry script', async () => {
    expect(await checkForNewBuild(respond('<html></html>'), running)).toBe('unknown')
  })

  it('is unknown without fetching when the running entry cannot be found', async () => {
    const fetchImpl = respond(htmlWithEntry('/assets/index-NEW.js'))
    expect(await checkForNewBuild(fetchImpl, parse(htmlWithEntry(null)))).toBe('unknown')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
