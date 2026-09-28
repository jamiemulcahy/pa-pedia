/**
 * Detects whether this tab is running an older build than the one deployed.
 *
 * Every Cloudflare Pages deploy replaces the hashed asset set, so a tab opened
 * before a deploy asks for chunk URLs that no longer exist the next time it
 * lazy-loads something. Retrying that request cannot help — the file is gone —
 * and the only fix is a new document. But a chunk can also fail for reasons a
 * reload would not fix (offline, a flaky connection), and reloading then would
 * throw away a working page for nothing.
 *
 * So we ask the server: fetch the current index.html and compare its entry
 * script with the one this document booted from. Entry filenames are content
 * hashes that change whenever any chunk they reference changes, so a mismatch
 * means a deploy has happened since this tab loaded.
 */

/** `stale`: a newer build is deployed. `current`: same build. `unknown`: couldn't tell. */
export type BuildStatus = 'stale' | 'current' | 'unknown'

const CHECK_TIMEOUT_MS = 5000

const ENTRY_SCRIPT_SELECTOR = 'script[type="module"][src]'

/** Entry module src of a parsed document, as written in the HTML. */
export function entryScriptOf(doc: Document): string | null {
  return doc.querySelector(ENTRY_SCRIPT_SELECTOR)?.getAttribute('src') ?? null
}

/**
 * Compares the running build with the deployed one. Never throws: any failure
 * (offline, timeout, unexpected HTML) is `unknown`, which callers must treat
 * as "don't reload".
 */
export async function checkForNewBuild(
  fetchImpl: typeof fetch = fetch,
  doc: Document = document,
): Promise<BuildStatus> {
  const running = entryScriptOf(doc)
  if (!running) return 'unknown'

  try {
    const res = await fetchImpl(import.meta.env.BASE_URL, {
      // Bypass the HTTP cache: a cached index.html is the old build by definition.
      cache: 'no-store',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    })
    if (!res.ok) return 'unknown'

    const deployed = entryScriptOf(
      new DOMParser().parseFromString(await res.text(), 'text/html'),
    )
    if (!deployed) return 'unknown'
    return deployed === running ? 'current' : 'stale'
  } catch {
    return 'unknown'
  }
}
