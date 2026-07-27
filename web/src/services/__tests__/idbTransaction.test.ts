import { describe, it, expect, afterEach } from 'vitest'
import { openDB, type IDBPDatabase } from 'idb'
import { claimTransactionDone } from '../idbTransaction'

/**
 * Captures unhandled promise rejections for the duration of `run`.
 *
 * Node reports these on `process`, not on jsdom's window, and only at the end
 * of a macrotask — hence the `setTimeout` drain rather than a microtask flush.
 */
async function collectUnhandledRejections(run: () => Promise<void>): Promise<string[]> {
  const seen: string[] = []
  const onRejection = (reason: unknown) => {
    const err = reason as { name?: string; message?: string }
    seen.push(`${err?.name}: ${err?.message}`)
  }

  // Vitest installs its own handler; ours runs alongside it.
  process.on('unhandledRejection', onRejection)
  try {
    await run()
    await new Promise((resolve) => setTimeout(resolve, 0))
  } finally {
    process.off('unhandledRejection', onRejection)
  }
  return seen
}

let dbCounter = 0

async function openTestDB(): Promise<IDBPDatabase> {
  return openDB(`idb-transaction-test-${dbCounter++}`, 1, {
    upgrade(db) {
      db.createObjectStore('factions', { keyPath: 'id' })
      db.createObjectStore('assets')
    },
  })
}

describe('claimTransactionDone', () => {
  let db: IDBPDatabase | null = null

  afterEach(() => {
    db?.close()
    db = null
  })

  /**
   * Locks in the failure mode this helper exists for. Without the claim, a
   * transaction that aborts mid-write leaves `tx.done` rejected and unobserved,
   * which is what reached Sentry as a stackless "AbortError: AbortError".
   */
  it('reproduces the unhandled rejection when tx.done is left unclaimed', async () => {
    const seen = await collectUnhandledRejections(async () => {
      db = await openTestDB()
      try {
        const tx = db.transaction(['factions', 'assets'], 'readwrite')
        const put = tx.objectStore('factions').put({ id: 'mla' })
        tx.abort() // storage yanked out from under an in-flight write
        await put
        await tx.done // never reached
      } catch {
        // The app's catch sites swallow this and degrade gracefully.
      }
    })

    expect(seen).toContain('AbortError: AbortError')
  })

  it('prevents the unhandled rejection when the transaction is claimed', async () => {
    const seen = await collectUnhandledRejections(async () => {
      db = await openTestDB()
      try {
        const tx = db.transaction(['factions', 'assets'], 'readwrite')
        claimTransactionDone(tx)
        const put = tx.objectStore('factions').put({ id: 'mla' })
        tx.abort()
        await put
        await tx.done
      } catch {
        // Same graceful degradation; the difference is what escapes to the
        // global handler.
      }
    })

    expect(seen).toEqual([])
  })

  it('still surfaces the abort to a caller that awaits tx.done', async () => {
    db = await openTestDB()
    const tx = db.transaction(['factions', 'assets'], 'readwrite')
    claimTransactionDone(tx)
    tx.abort()

    // Claiming marks the rejection handled; it does not swallow it.
    await expect(tx.done).rejects.toThrow()
  })

  it('leaves a committing transaction untouched', async () => {
    db = await openTestDB()
    const tx = db.transaction(['factions', 'assets'], 'readwrite')
    claimTransactionDone(tx)
    await tx.objectStore('factions').put({ id: 'mla' })
    await expect(tx.done).resolves.toBeUndefined()

    await expect(db.get('factions', 'mla')).resolves.toEqual({ id: 'mla' })
  })
})
