/**
 * IndexedDB transaction helpers.
 */

/**
 * Marks a transaction's `done` promise as handled.
 *
 * `idb` creates `tx.done` eagerly — the moment `db.transaction()` is wrapped,
 * long before our code reaches `await tx.done` at the end of a write. If an
 * earlier request in that transaction rejects, we throw out of the function and
 * never reach the `await`, leaving an already-rejected `tx.done` with no
 * handler. It then surfaces as an unhandled rejection with no stack and no
 * useful message: `AbortError: AbortError`, which is what `idb` rejects with
 * when the transaction aborted without setting `tx.error`.
 *
 * The trigger in the wild is the browser tearing storage down underneath an
 * open transaction (site data cleared, origin evicted under storage pressure) —
 * Chromium aborts every in-flight transaction with "Connection is closing
 * because of: Force close delete origin".
 *
 * Attaching a no-op handler drops only the duplicate. `.catch()` returns a new
 * promise and leaves `tx.done` itself untouched, so the real failure still
 * propagates through the awaited request, and a later `await tx.done` still
 * observes commit-time errors.
 *
 * Call this immediately after creating a transaction, before the first `await`.
 */
export function claimTransactionDone(tx: { done: Promise<void> }): void {
  tx.done.catch(() => {})
}
