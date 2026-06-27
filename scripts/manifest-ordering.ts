/**
 * Ordering for faction manifest versions.
 *
 * "Latest" is chosen by *extraction recency*, NOT by version number. Faction
 * versions come from upstream mod `modinfo.json` and are NOT guaranteed to
 * increase monotonically — e.g. Exiles went 0.7.10 -> 0.7.20 -> 0.7.3 ->
 * 0.7.4.3, renumbering downward. Ordering by version number crowns the
 * numerically-largest string (0.7.20), which is an old build, instead of the
 * current upstream release (0.7.4.3).
 *
 * The extraction timestamp baked into each zip filename (`...-pedia{timestamp}`)
 * is the only reliable "this is the current upstream state" signal, because the
 * automated daily workflow only ever snapshots whatever upstream is at that
 * moment. The newest-timestamp zip always corresponds to the currently-committed
 * faction folder. So we order newest-extraction-first.
 *
 * (Trade-off: a human merging a stale auto-generated PR out of order could
 * mislabel "latest". That is rare and avoidable; non-monotonic upstream
 * versioning is real and recurring.)
 *
 * `compareVersions` remains only as a deterministic tie-breaker for the
 * essentially-impossible case of two distinct versions sharing an extraction
 * timestamp. It compares segment-by-segment, numeric where both segments parse
 * as numbers (so 0.7.10 > 0.7.8). Missing trailing segments are treated as 0.
 */

/**
 * Compare two version strings.
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  const len = Math.max(pa.length, pb.length)

  for (let i = 0; i < len; i++) {
    const sa = pa[i] ?? '0'
    const sb = pb[i] ?? '0'
    const na = Number(sa)
    const nb = Number(sb)

    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      if (na !== nb) return na - nb
    } else {
      const c = sa.localeCompare(sb, undefined, { numeric: true })
      if (c !== 0) return c
    }
  }

  return 0
}

/**
 * Sort comparator for ordering versions newest-first by extraction timestamp,
 * with version number as a stable tie-breaker for identical timestamps.
 */
export function byTimestampDesc(
  a: { version: string; timestamp: number },
  b: { version: string; timestamp: number }
): number {
  return b.timestamp - a.timestamp || compareVersions(b.version, a.version)
}
