import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readTeamColorPref, writeTeamColorPref, clearTeamColorPref } from '../teamColorPref'

const KEY = 'pa-pedia-team-colors'
const PURPLE = { main: '#8b5cf6', highlight: '#c4b5fd' }

describe('teamColorPref', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns colours picked for the same faction', () => {
    writeTeamColorPref({ ...PURPLE, factionId: 'MLA' })
    expect(readTeamColorPref('MLA')).toEqual({ ...PURPLE, factionId: 'MLA' })
  })

  // The core of the fix: a pick on one faction must not seed another.
  it('returns null for a different faction', () => {
    writeTeamColorPref({ ...PURPLE, factionId: 'MLA' })
    expect(readTeamColorPref('Legion')).toBeNull()
  })

  it('is case-sensitive about the faction id', () => {
    writeTeamColorPref({ ...PURPLE, factionId: 'MLA' })
    expect(readTeamColorPref('mla')).toBeNull()
  })

  it('returns null when nothing is stored', () => {
    expect(readTeamColorPref('MLA')).toBeNull()
  })

  it('lets a later pick take over the single slot', () => {
    writeTeamColorPref({ ...PURPLE, factionId: 'MLA' })
    writeTeamColorPref({ main: '#ff0000', highlight: '#00ff00', factionId: 'Legion' })

    expect(readTeamColorPref('Legion')).toEqual({
      main: '#ff0000',
      highlight: '#00ff00',
      factionId: 'Legion',
    })
    // MLA's earlier pick is gone — one slot, not a per-faction history.
    expect(readTeamColorPref('MLA')).toBeNull()
  })

  it('clears the stored preference', () => {
    writeTeamColorPref({ ...PURPLE, factionId: 'MLA' })
    clearTeamColorPref()
    expect(readTeamColorPref('MLA')).toBeNull()
  })

  describe('malformed storage', () => {
    // A pref written by a build predating faction stamping. It must miss rather
    // than throw, so users silently fall back to faction defaults on upgrade.
    it('ignores a legacy pref with no factionId', () => {
      localStorage.setItem(KEY, JSON.stringify(PURPLE))
      expect(readTeamColorPref('MLA')).toBeNull()
    })

    it('ignores unparseable JSON', () => {
      localStorage.setItem(KEY, 'not json{')
      expect(readTeamColorPref('MLA')).toBeNull()
    })

    it.each([
      ['wrong-typed fields', JSON.stringify({ main: 1, highlight: 2, factionId: 'MLA' })],
      ['null', JSON.stringify(null)],
      ['an array', JSON.stringify([])],
    ])('ignores %s', (_label, raw) => {
      localStorage.setItem(KEY, raw)
      expect(readTeamColorPref('MLA')).toBeNull()
    })
  })

  describe('unavailable storage', () => {
    it('reads as no-preference when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(readTeamColorPref('MLA')).toBeNull()
    })

    it('swallows write failures (quota / private mode)', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      expect(() => writeTeamColorPref({ ...PURPLE, factionId: 'MLA' })).not.toThrow()
    })

    it('swallows clear failures', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(() => clearTeamColorPref()).not.toThrow()
    })
  })
})
