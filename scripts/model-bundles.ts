/**
 * Correlating 3D model bundles with faction-data versions.
 *
 * A version entry gets a model bundle only when one was BUILT FROM THAT EXACT
 * VERSION. This is deliberate, and it is why a faction can currently show "no
 * 3D model" on its newest release:
 *
 * Model bundles are produced by the `faction-models` workflow, which is
 * manual-dispatch only (a full run drives headless Blender over ~600 units).
 * Faction data is refreshed by a DAILY workflow that snapshots whatever
 * upstream has released. So the moment a mod ships a new version, its newest
 * entry has no bundle and the "View 3D Model" button correctly reports that
 * there are no models for it — until someone regenerates. Exiles went
 * 0.7.4.6 -> 0.7.5 -> 0.7.6 -> 0.8 -> 0.8.1 in the two weeks after its bundle
 * was built, which is exactly this.
 *
 * Serving a neighbouring version's bundle instead was considered and rejected:
 * a model shown against a version it was not built from is a quiet lie about
 * what the unit currently looks like. Saying "no models yet" is honest, and the
 * fix for a stale faction is to regenerate, not to approximate.
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

/**
 * Contents of a bundle's sidecar index asset — the few facts the manifest
 * generator needs about a bundle without opening it.
 */
export interface ModelBundleSidecar {
  factionId: string
  version: string
  timestamp: number
  unitCount: number
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

/**
 * Name of the sidecar index asset published next to a bundle.
 *
 * The sidecar exists so the manifest generator can read a bundle's `unitCount`
 * with a ~100-byte fetch instead of downloading the whole bundle (tens of MB)
 * to read one integer out of its `models.json`. That download runs for every
 * version entry that has a bundle, on every manifest regeneration — i.e. on
 * every faction-data push — so it grows with the bundle history.
 *
 * `-models.zip` -> `-models.index.json`, which cannot collide with a bundle
 * name (the bundle pattern requires a `.zip` suffix, so sidecars are ignored by
 * `indexModelBundles`).
 */
export function modelBundleSidecarName(bundleName: string): string {
  return bundleName.replace(/\.zip$/, '.index.json')
}

/**
 * Locate a bundle's sidecar among the release assets.
 *
 * Returns `null` for bundles published before sidecars existed; callers must
 * fall back to reading `models.json` out of the bundle itself rather than
 * treating a missing sidecar as "no units".
 */
export function selectModelBundleSidecar(
  assets: ModelBundleAsset[],
  bundleName: string
): ModelBundleAsset | null {
  const wanted = modelBundleSidecarName(bundleName)
  return assets.find((a) => a.name === wanted) ?? null
}
