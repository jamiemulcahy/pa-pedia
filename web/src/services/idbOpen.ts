import { openDB, type DBSchema, type IDBPDatabase, type OpenDBCallbacks } from 'idb'

/**
 * Opens an IndexedDB database without ever waiting on another tab.
 *
 * When a version bump finds an older tab holding the database open, and that
 * tab has no `versionchange` handler (every tab from before its first bump),
 * the open stays pending until the old tab closes. Anything awaiting it,
 * including the page render, stays pending too. So on `blocked` this rejects
 * straight away and the caller runs without the database for the session. If
 * the upgrade later goes through anyway, that late connection is closed.
 *
 * `onBlocking` is our half of the same courtesy: when a newer version wants to
 * upgrade, this connection closes and the caller must forget it (reset its
 * cached promise) so the next call reopens at the new version.
 */
export function openWithoutWaiting<DB extends DBSchema>(
  name: string,
  version: number,
  upgrade: OpenDBCallbacks<DB>['upgrade'],
  onBlocking: () => void
): Promise<IDBPDatabase<DB>> {
  return new Promise((resolve, reject) => {
    let gaveUp = false
    openDB<DB>(name, version, {
      upgrade,
      blocked() {
        gaveUp = true
        reject(new Error(`${name} upgrade blocked by another open tab`))
      },
      blocking(_current, _blocked, event) {
        ;(event.target as IDBDatabase).close()
        onBlocking()
      },
    }).then(
      (db) => {
        // The upgrade finished after we stopped waiting; don't hold it open.
        if (gaveUp) db.close()
        else resolve(db)
      },
      reject
    )
  })
}
