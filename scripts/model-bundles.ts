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

/** One unit's asset paths inside a bundle — a `models.json` entry. */
export interface ModelEntry {
  glb: string
  diffuse?: string
  mask?: string
  material?: string
}

/** A bundle's `models.json`, as written by the CLI's `extract-models`. */
export interface ModelsIndex {
  generated?: string
  unitCount: number
  units: Record<string, ModelEntry>
}

/**
 * Contents of a bundle's sidecar index asset: the bundle's full `models.json`
 * plus which faction version it was built from.
 *
 * It is what the web app reads on every unit page to decide whether to offer
 * the 3D viewer. The deploy bakes every sidecar into the site at
 * {@link MODEL_INDEX_PATH}, so that check is a plain same-origin GET of a small
 * JSON file and never touches the (20-80 MB) bundle or HTTP Range.
 *
 * Sidecars published before the index moved in here carry only the first four
 * fields; {@link hasUnitIndex} tells them apart, and `generate-manifest`
 * rebuilds those from the bundle once.
 */
export interface ModelBundleSidecar extends ModelsIndex {
  factionId: string
  version: string
  timestamp: number
}

/**
 * Site path the deploy bakes sidecars into (see deploy.yml). A manifest
 * `models.indexUrl` is this path plus the sidecar's asset name.
 */
export const MODEL_INDEX_PATH = '/model-index/'

/** Whether a parsed sidecar carries the unit index, not just the unit count. */
export function hasUnitIndex(sidecar: unknown): sidecar is ModelBundleSidecar {
  const units = (sidecar as { units?: unknown } | null)?.units
  return typeof units === 'object' && units !== null && !Array.isArray(units)
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
 * The sidecar lets both the web app and the manifest generator read a bundle's
 * `models.json` (at most ~70 KB, ~8 KB compressed) without opening the bundle
 * (tens of MB). See {@link ModelBundleSidecar}.
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
 * rebuild the sidecar from the bundle's own `models.json` rather than treating
 * a missing sidecar as "no units".
 */
export function selectModelBundleSidecar(
  assets: ModelBundleAsset[],
  bundleName: string
): ModelBundleAsset | null {
  const wanted = modelBundleSidecarName(bundleName)
  return assets.find((a) => a.name === wanted) ?? null
}
