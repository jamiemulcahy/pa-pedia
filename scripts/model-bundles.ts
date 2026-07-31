/**
 * Correlating 3D model bundles with faction-data versions.
 *
 * A version entry gets a model bundle only when one was BUILT FROM THAT EXACT
 * VERSION. Serving a neighbouring version's bundle instead was considered and
 * rejected: a model shown against a version it was not built from is a quiet
 * lie about what the unit currently looks like. Saying "no models yet" is
 * honest, and the fix for a stale faction is to regenerate, not to approximate.
 *
 * The `faction-models` workflow regenerates a faction automatically whenever
 * its data changes (chained off `Faction Data Release`), which is what makes
 * that strictness affordable — a new version arrives with its own bundle in
 * minutes. It previously ran only on manual dispatch, so a mod that shipped a
 * new release showed "no 3D model available" until someone remembered: Exiles
 * went 0.7.4.6 -> 0.7.5 -> 0.7.6 -> 0.8 -> 0.8.1 in the two weeks after its
 * bundle was built, with no models on any of them.
 *
 * Exact-version matching also guards a case that automation alone does not:
 * upstream mods sometimes ship changed data WITHOUT bumping their version. It
 * is only safe to keep matching on version because every update rebuilds the
 * bundle, so the newest bundle for a version was always built from the newest
 * data for it.
 *
 * What this DOES guarantee is that older versions keep their own models: each
 * version entry is matched independently, so Exiles 0.7.4.6 keeps its bundle
 * (and its working 3D viewer) no matter how far the latest version has moved
 * on. Bundles are never deleted on upload for the same reason.
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
 * Index model bundle assets by `${factionId}@${version}`, keeping the newest
 * build stamp when a version has been rebuilt (e.g. a texture fix regen).
 * Non-matching asset names are ignored.
 */
export function indexModelBundles(assets: ModelBundleAsset[]): Map<string, ParsedModelBundle> {
  const byVersion = new Map<string, ParsedModelBundle>()

  for (const asset of assets) {
    const parsed = parseModelBundleName(asset.name)
    if (!parsed) continue

    const key = `${parsed.factionId.toLowerCase()}@${parsed.version}`
    const existing = byVersion.get(key)
    if (!existing || parsed.timestamp > existing.timestamp) {
      byVersion.set(key, { ...parsed, asset })
    }
  }

  return byVersion
}

/**
 * The model bundle for one faction version, or `null` when none was built from
 * it. `null` is a normal, honest state — see the note at the top of this file.
 */
export function selectModelBundle(
  byVersion: Map<string, ParsedModelBundle>,
  factionId: string,
  version: string
): ParsedModelBundle | null {
  return byVersion.get(`${factionId.toLowerCase()}@${version}`) ?? null
}
