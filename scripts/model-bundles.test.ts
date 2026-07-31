import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  indexModelBundles,
  modelBundleSidecarName,
  parseModelBundleName,
  selectModelBundle,
  selectModelBundleSidecar,
  type ModelBundleAsset,
} from './model-bundles'

const asset = (name: string): ModelBundleAsset => ({ name, size: 1, url: `https://example/${name}` })

test('parses faction id, version and build stamp from a bundle filename', () => {
  assert.deepEqual(parseModelBundleName('exiles-0.7.4.6-pedia20260712230210-models.zip'), {
    factionId: 'exiles',
    version: '0.7.4.6',
    timestamp: 20260712230210,
  })
})

test('parses dashed faction ids and numeric-only versions', () => {
  assert.deepEqual(parseModelBundleName('second-wave-0.15.0-pedia20260712084632-models.zip'), {
    factionId: 'second-wave',
    version: '0.15.0',
    timestamp: 20260712084632,
  })
  assert.equal(parseModelBundleName('mla-124664-pedia20260712084632-models.zip')?.version, '124664')
})

test('ignores assets that are not model bundles', () => {
  assert.equal(parseModelBundleName('mla-124664-pedia20260712084632.zip'), null) // spec zip
  assert.equal(parseModelBundleName('manifest.json'), null)
  assert.equal(indexModelBundles([asset('notes.txt')]).size, 0)
})

test('matches a version to the bundle built from it', () => {
  const bundles = indexModelBundles([
    asset('mla-124632-pedia20260711230523-models.zip'),
    asset('mla-124664-pedia20260712084632-models.zip'),
  ])

  assert.equal(selectModelBundle(bundles, 'mla', '124664')?.asset.name, 'mla-124664-pedia20260712084632-models.zip')
  assert.equal(selectModelBundle(bundles, 'mla', '124632')?.asset.name, 'mla-124632-pedia20260711230523-models.zip')
})

// Asset order from the release API is not guaranteed, so the newest rebuild has
// to win regardless of which one is seen first.
test('keeps the newest rebuild when a version was built more than once', () => {
  const older = asset('exiles-0.7.4.6-pedia20260712084632-models.zip')
  const newer = asset('exiles-0.7.4.6-pedia20260712230210-models.zip') // texture fix rebuild

  for (const order of [[older, newer], [newer, older]]) {
    const bundles = indexModelBundles(order)
    assert.equal(bundles.size, 1)
    assert.equal(selectModelBundle(bundles, 'exiles', '0.7.4.6')?.timestamp, 20260712230210)
  }
})

// The intended behaviour, not an oversight. Model bundles come from a manual
// workflow and faction data from a daily one, so a freshly released version has
// no bundle until someone regenerates — and the UI says exactly that rather than
// showing a model built from some other release.
test('a version with no bundle of its own gets nothing', () => {
  const bundles = indexModelBundles([asset('exiles-0.7.4.6-pedia20260712230210-models.zip')])

  assert.equal(selectModelBundle(bundles, 'exiles', '0.8.1'), null)
})

// The other half of that contract: falling behind on the latest version must
// never cost the versions that DO have models. Browsing back to 0.7.4.6 still
// gets its own bundle and a working viewer.
test('older versions keep their own models when the latest has none', () => {
  const bundles = indexModelBundles([asset('exiles-0.7.4.6-pedia20260712230210-models.zip')])

  assert.equal(selectModelBundle(bundles, 'exiles', '0.8.1'), null)
  assert.equal(selectModelBundle(bundles, 'exiles', '0.7.4.6')?.version, '0.7.4.6')
})

test('faction id matching is case-insensitive', () => {
  const bundles = indexModelBundles([asset('exiles-0.7.4.6-pedia20260712230210-models.zip')])
  assert.equal(selectModelBundle(bundles, 'Exiles', '0.7.4.6')?.version, '0.7.4.6')
})

test('returns null for a faction with no bundles at all', () => {
  const bundles = indexModelBundles([asset('exiles-0.7.4.6-pedia20260712230210-models.zip')])
  assert.equal(selectModelBundle(bundles, 'replicate', '0.5'), null)
  assert.equal(selectModelBundle(new Map(), 'exiles', '0.7.4.6'), null)
})

// --- sidecar index -------------------------------------------------------
// The sidecar exists so manifest generation doesn't download tens of MB per
// bundle to read one integer. See modelBundleSidecarName in model-bundles.ts.

test('derives the sidecar name from a bundle name', () => {
  assert.equal(
    modelBundleSidecarName('exiles-0.7.4.6-pedia20260712230210-models.zip'),
    'exiles-0.7.4.6-pedia20260712230210-models.index.json'
  )
})

test('sidecars are not mistaken for bundles', () => {
  const assets = [
    asset('exiles-0.7.4.6-pedia20260712230210-models.zip'),
    asset('exiles-0.7.4.6-pedia20260712230210-models.index.json'),
  ]
  // Only the zip is a bundle; indexing the sidecar too would double-count and
  // could win the newest-stamp race with a non-downloadable asset.
  assert.equal(indexModelBundles(assets).size, 1)
  assert.equal(parseModelBundleName('exiles-0.7.4.6-pedia20260712230210-models.index.json'), null)
})

test('finds a bundle sidecar among release assets', () => {
  const assets = [
    asset('mla-124664-pedia20260712084632-models.zip'),
    asset('exiles-0.7.4.6-pedia20260712230210-models.zip'),
    asset('exiles-0.7.4.6-pedia20260712230210-models.index.json'),
  ]
  assert.equal(
    selectModelBundleSidecar(assets, 'exiles-0.7.4.6-pedia20260712230210-models.zip')?.name,
    'exiles-0.7.4.6-pedia20260712230210-models.index.json'
  )
})

// Bundles published before sidecars existed have none. That must read as "fall
// back to opening the bundle", never as "this bundle has no units".
test('reports no sidecar for bundles predating them', () => {
  const assets = [asset('mla-124632-pedia20260711230523-models.zip')]
  assert.equal(selectModelBundleSidecar(assets, 'mla-124632-pedia20260711230523-models.zip'), null)
})
