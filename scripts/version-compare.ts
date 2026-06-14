/**
 * Version comparison for faction manifest ordering.
 *
 * Faction versions come from upstream mod `modinfo.json` and are dotted-numeric
 * strings of varying length (e.g. "0.7.20", "0.7.7.0", "1.32.1", "124651").
 *
 * The manifest must order versions and pick "latest" by *version number*, NOT by
 * build timestamp. Timestamp ordering breaks when versions are built/merged out
 * of order (e.g. merging v0.7.7.0's PR after v0.7.20 would otherwise make the
 * older version look newest). Version-number ordering is stable regardless of
 * the order in which versions happen to be published.
 *
 * Comparison is segment-by-segment, numeric where both segments parse as numbers
 * (so 0.7.10 > 0.7.8, which a string compare gets wrong). Missing trailing
 * segments are treated as 0, so "0.7.6" === "0.7.6.0". Non-numeric segments fall
 * back to a numeric-aware locale compare.
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
 * Sort comparator for ordering versions newest-first (descending by version),
 * with build timestamp as a stable tie-breaker for identical version strings.
 */
export function byVersionDesc(
  a: { version: string; timestamp: number },
  b: { version: string; timestamp: number }
): number {
  return compareVersions(b.version, a.version) || b.timestamp - a.timestamp
}
