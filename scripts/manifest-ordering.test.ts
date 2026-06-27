import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, byTimestampDesc } from './manifest-ordering'

test('numeric segment compare beats string compare (0.7.10 > 0.7.8)', () => {
  assert.ok(compareVersions('0.7.10', '0.7.8') > 0)
  assert.ok(compareVersions('0.7.8', '0.7.10') < 0)
})

test('compares segment-by-segment left to right', () => {
  assert.ok(compareVersions('0.7.7.0', '0.7.8') < 0) // 7 < 8 at 3rd segment
  assert.ok(compareVersions('0.7.20', '0.7.10') > 0)
  assert.ok(compareVersions('0.8', '0.7.99') > 0)
})

test('missing trailing segments treated as 0', () => {
  assert.equal(compareVersions('0.7.6', '0.7.6.0'), 0)
  assert.ok(compareVersions('0.7', '0.7.1') < 0)
})

test('byTimestampDesc orders the real Exiles release newest-first by extraction time', () => {
  // Real release assets — extraction timestamps reflect when PA-Pedia snapshotted
  // each upstream version. Upstream versioning is non-monotonic (0.7.10 -> 0.7.20
  // -> 0.7.3 -> 0.7.4.3), so version-number ordering wrongly crowns 0.7.20. The
  // newest extraction (0.7.4.3) is the actual current release.
  const input = [
    { version: '0.7.1', timestamp: 20260405234526 },
    { version: '0.7.3.4', timestamp: 20260412103425 },
    { version: '0.7.5.0', timestamp: 20260605175957 },
    { version: '0.7.6.0', timestamp: 20260605180326 },
    { version: '0.7.7.0', timestamp: 20260606000000 },
    { version: '0.7.8', timestamp: 20260607000000 },
    { version: '0.7.10', timestamp: 20260608000000 },
    { version: '0.7.20', timestamp: 20260614140054 },
    { version: '0.7.3', timestamp: 20260625071220 },
    { version: '0.7.4.2', timestamp: 20260626071835 },
    { version: '0.7.4.3', timestamp: 20260627070557 },
  ]
  const ordered = [...input].sort(byTimestampDesc).map((v) => v.version)
  assert.deepEqual(ordered, [
    '0.7.4.3', // latest = newest extraction, not numerically-largest
    '0.7.4.2',
    '0.7.3',
    '0.7.20',
    '0.7.10',
    '0.7.8',
    '0.7.7.0',
    '0.7.6.0',
    '0.7.5.0',
    '0.7.3.4',
    '0.7.1',
  ])
})

test('newest extraction wins even when its version number is lower', () => {
  // 0.7.4.3 (newer extraction) must beat 0.7.20 (older extraction, bigger number)
  const input = [
    { version: '0.7.20', timestamp: 20260614140054 },
    { version: '0.7.4.3', timestamp: 20260627070557 },
  ]
  const ordered = [...input].sort(byTimestampDesc).map((v) => v.version)
  assert.deepEqual(ordered, ['0.7.4.3', '0.7.20'])
})

test('version number breaks ties only when timestamps are identical', () => {
  const input = [
    { version: '0.7.4.2', timestamp: 20260627070557 },
    { version: '0.7.4.3', timestamp: 20260627070557 },
  ]
  const ordered = [...input].sort(byTimestampDesc).map((v) => v.version)
  assert.deepEqual(ordered, ['0.7.4.3', '0.7.4.2'])
})
