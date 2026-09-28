import { describe, it, expect, beforeAll } from 'vitest'
import { getLocalFactionIds } from '../localFactionStorage'

// Its own file: storage opens its database once per module.

describe('localFactionStorage when an old tab blocks the upgrade', () => {
  beforeAll(async () => {
    // A tab running the previous release: it holds v1 open and has no
    // versionchange handler, so it never lets the v2 upgrade through.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('pa-pedia-local-factions', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('factions', { keyPath: 'id' })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })

  // Uploads are the visitor's own data, so this fails rather than reading as
  // empty; discoverFactions catches it and the rest of the site still loads.
  it('fails straight away instead of waiting for that tab to close', async () => {
    await expect(getLocalFactionIds()).rejects.toThrow(/blocked/)
  }, 5000)
})
