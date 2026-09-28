import { describe, it, expect, beforeAll } from 'vitest'
import { getLocalFactionIds, getLocalFactionIndex, saveLocalFaction } from '../localFactionStorage'
import { mockMLAMetadata, mockMLAIndex } from '@/tests/mocks/factionData'

// Its own file: storage opens its database once per module, so the state the
// database is in before that first open is what each file here tests.

describe('localFactionStorage repairs a database left without its stores', () => {
  beforeAll(async () => {
    // The state found in the wild: v1 with none of its stores, closed again.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('pa-pedia-local-factions', 1)
      req.onsuccess = () => {
        req.result.close()
        resolve()
      }
      req.onerror = () => reject(req.error)
    })
  })

  it('recreates the stores on upgrade, so uploads can be saved and read again', async () => {
    expect(await getLocalFactionIds()).toEqual([])

    await saveLocalFaction('my-faction', mockMLAMetadata, mockMLAIndex, new Map())

    expect(await getLocalFactionIds()).toEqual(['my-faction'])
    expect(await getLocalFactionIndex('my-faction')).toEqual(mockMLAIndex)
  })
})
