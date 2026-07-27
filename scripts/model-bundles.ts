/**
 * Correlating 3D model bundles with faction-data versions.
 *
 * Model bundles are produced by the `faction-models` workflow, which is
 * MANUAL-dispatch only (a full run drives headless Blender over ~600 units).
 * Faction data, by contrast, is refreshed by a DAILY workflow that snapshots
 * whatever upstream has released.
 *
 * Those two cadences drift, and the drift used to silently kill the feature:
 * bundles were attached to a version entry only on an exact
 * `{factionId}@{version}` match, so the first upstream release after a model
 * regen left every version entry with no `models` field, and the web app's
 * "View 3D Model" button went permanently disabled for that faction. Exiles —
 * the most actively developed faction — went 0.7.4.6 -> 0.7.5 -> 0.7.6 -> 0.8
 * -> 0.8.1 in the two weeks after its bundle was built, and lost the viewer on
 * every one of its 109 units.
 *
 * So an exact match is preferred but no longer required: a faction's newest
 * bundle is attached as a FALLBACK when no bundle was built for that exact
 * version. Unit geometry is near-static across mod point releases (the 0.7.4.6
 * bundle covers 108 of the 109 units in 0.8.1), and per-unit availability is
 * still decided by the bundle's own `models.json` — so a unit genuinely added
 * since the regen correctly reports "no model" rather than showing the wrong
 * mesh. Fallback selections are flagged with `builtFromVersion` so the UI can
 * say which version the model actually came from instead of implying it is the
 * displayed version's.
 */

/** A release asset as returned by `gh release view --json assets`. */
export interface ModelBundleAsset {
  name: string
  size: number
  url: string
}

/** A model bundle asset whose filename parsed successfully. */
export interface ParsedModelBundle {
  factionId: string
  version: string
  /** 14-digit `pedia<YYYYMMDDHHmmss>` build stamp from the filename. */
  timestamp: number
  asset: ModelBundleAsset
}

export interface ModelBundleSelection {
  bundle: ParsedModelBundle
  /** True when the bundle was built from the requested version itself. */
  exact: boolean
}

// Model bundle filename: {factionId}-{version}-pedia{timestamp}-models.zip
const MODEL_ZIP_FILENAME_PATTERN =
  /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([0-9][0-9.-]*)-pedia(\d{14})-models\.zip$/i

export function parseModelBundleName(
  name: string
): { factionId: string; version: string; timestamp: number } | null {
  const match = name.match(MODEL_ZIP_FILENAME_PATTERN)
  if (!match) return null
  return {
    factionId: match[1],
    version: match[2],
    timestamp: parseInt(match[3], 10),
  }
}

/**
 * Group model bundle assets by lowercased faction id, newest build stamp first.
 * Non-matching asset names (e.g. the odd manually-uploaded file) are ignored.
 */
export function indexModelBundles(assets: ModelBundleAsset[]): Map<string, ParsedModelBundle[]> {
  const byFaction = new Map<string, ParsedModelBundle[]>()

  for (const asset of assets) {
    const parsed = parseModelBundleName(asset.name)
    if (!parsed) continue

    const key = parsed.factionId.toLowerCase()
    const bundles = byFaction.get(key)
    const entry: ParsedModelBundle = { ...parsed, asset }
    if (bundles) {
      bundles.push(entry)
    } else {
      byFaction.set(key, [entry])
    }
  }

  // Newest stamp first, so "the newest bundle for this faction" is index 0 and
  // rebuilds of the same version resolve to the most recent one.
  for (const bundles of byFaction.values()) {
    bundles.sort((a, b) => b.timestamp - a.timestamp)
  }

  return byFaction
}

/**
 * Pick the model bundle to attach to one faction version entry.
 *
 * Exact version match wins (newest rebuild of it). Failing that, the faction's
 * newest bundle is returned as a fallback — better an accurate model built from
 * a neighbouring release than a dead button on every unit. Returns `null` only
 * when the faction has no bundles at all.
 */
export function selectModelBundle(
  byFaction: Map<string, ParsedModelBundle[]>,
  factionId: string,
  version: string
): ModelBundleSelection | null {
  const bundles = byFaction.get(factionId.toLowerCase())
  if (!bundles || bundles.length === 0) return null

  const exact = bundles.find((bundle) => bundle.version === version)
  if (exact) return { bundle: exact, exact: true }

  return { bundle: bundles[0], exact: false }
}
