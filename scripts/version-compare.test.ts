import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, byVersionDesc } from './version-compare'

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

test('equal versions return 0', () => {
  assert.equal(compareVersions('0.7.20', '0.7.20'), 0)
  assert.equal(compareVersions('124651', '124651'), 0)
})

test('handles each factions versioning scheme', () => {
  assert.ok(compareVersions('1.38', '1.37') > 0) // Bugs
  assert.ok(compareVersions('0.15.0', '0.14.5') > 0) // Second-Wave
  assert.ok(compareVersions('124651', '124632') > 0) // MLA build numbers
  assert.ok(compareVersions('1.32.1', '1.32.0') > 0) // Legion
})

test('byVersionDesc orders a full Exiles version list newest-first', () => {
  const input = [
    { version: '0.7.1', timestamp: 1 },
    { version: '0.7.20', timestamp: 2 },
    { version: '0.7.7.0', timestamp: 3 },
    { version: '0.7.10', timestamp: 4 },
    { version: '0.7.6.0', timestamp: 5 },
    { version: '0.7.8', timestamp: 6 },
    { version: '0.7.3.4', timestamp: 7 },
    { version: '0.7.5.0', timestamp: 8 },
  ]
  const ordered = [...input].sort(byVersionDesc).map((v) => v.version)
  assert.deepEqual(ordered, [
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

test('out-of-order timestamps do not change version ordering', () => {
  // v0.7.7.0 published (timestamp) AFTER v0.7.20 — version order must still win
  const input = [
    { version: '0.7.20', timestamp: 100 },
    { version: '0.7.7.0', timestamp: 999 },
  ]
  const ordered = [...input].sort(byVersionDesc).map((v) => v.version)
  assert.deepEqual(ordered, ['0.7.20', '0.7.7.0'])
})

test('timestamp only breaks ties for identical versions', () => {
  const input = [
    { version: '0.7.20', timestamp: 10 },
    { version: '0.7.20', timestamp: 20 },
  ]
  const ordered = [...input].sort(byVersionDesc).map((v) => v.timestamp)
  assert.deepEqual(ordered, [20, 10])
})
