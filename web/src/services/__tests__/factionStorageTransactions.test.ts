import { describe, it, expect, vi } from 'vitest'

/**
 * Every write path in the two IndexedDB services opens a transaction, awaits the
 * individual requests, and awaits `tx.done` last. When the browser tears storage
 * down mid-write, the requests reject and we throw before reaching that final
 * await — so `tx.done`, which `idb` created eagerly, is left rejected and
 * unobserved. These tests drive that exact shape through each function and
 * assert nothing escapes to the global rejection handler.
 */

/** A transaction whose requests and `done` promise both reject immediately. */
function makeAbortingTransaction() {
  const opError = new DOMException(
    'Connection is closing because of: Force close delete origin',
    'UnknownError',
  )
  const store = {
    put: () => Promise.reject(opError),
    delete: () => Promise.reject(opError),
    clear: () => Promise.reject(opError),
    getAllKeys: () => Promise.reject(opError),
  }
  return {
    // idb's fallback when the transaction aborted without setting tx.error.
    done: Promise.reject(new DOMException('AbortError', 'AbortError')),
    objectStore: () => store,
  }
}

vi.mock('idb', () => ({
  openDB: () =>
    Promise.resolve({
      // A fresh transaction per call, so the module-level db promise the
      // services cache can be reused across tests.
      transaction: () => makeAbortingTransaction(),
    }),
}))

async function collectUnhandledRejections(run: () => Promise<void>): Promise<string[]> {
  const seen: string[] = []
  const onRejection = (reason: unknown) => {
    const err = reason as { name?: string; message?: string }
    seen.push(`${err?.name}: ${err?.message}`)
  }

  process.on('unhandledRejection', onRejection)
  try {
    await run()
    await new Promise((resolve) => setTimeout(resolve, 0))
  } finally {
    process.off('unhandledRejection', onRejection)
  }
  return seen
}

/** Runs an operation expected to reject, and reports what leaked meanwhile. */
async function leakedRejections(op: () => Promise<unknown>): Promise<string[]> {
  return collectUnhandledRejections(async () => {
    await expect(op()).rejects.toThrow()
  })
}

describe('static faction cache transactions', () => {
  it('cacheStaticFaction does not leak tx.done on abort', async () => {
    const { cacheStaticFaction } = await import('../staticFactionCache')

    const leaked = await leakedRejections(() =>
      cacheStaticFaction(
        'mla',
        '1.0.0',
        20260727000000,
        {} as never,
        {} as never,
        new Map([['assets/pa/units/land/tank/tank.json', new Blob(['{}'])]]),
      ),
    )

    expect(leaked).toEqual([])
  })

  it('deleteStaticFactionCache does not leak tx.done on abort', async () => {
    const { deleteStaticFactionCache } = await import('../staticFactionCache')
    expect(await leakedRejections(() => deleteStaticFactionCache('mla'))).toEqual([])
  })

  it('clearStaticFactionCache does not leak tx.done on abort', async () => {
    const { clearStaticFactionCache } = await import('../staticFactionCache')
    expect(await leakedRejections(() => clearStaticFactionCache())).toEqual([])
  })
})

describe('local faction storage transactions', () => {
  it('saveLocalFaction does not leak tx.done on abort', async () => {
    const { saveLocalFaction } = await import('../localFactionStorage')

    const leaked = await leakedRejections(() =>
      saveLocalFaction('my-faction', {} as never, {} as never, new Map()),
    )

    expect(leaked).toEqual([])
  })

  it('deleteLocalFaction does not leak tx.done on abort', async () => {
    const { deleteLocalFaction } = await import('../localFactionStorage')
    expect(await leakedRejections(() => deleteLocalFaction('my-faction'))).toEqual([])
  })
})
