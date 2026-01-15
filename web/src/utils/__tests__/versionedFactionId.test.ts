import { describe, it, expect } from 'vitest'
import {
  parseFactionRef,
  buildFactionRef,
  parseComparisonRef,
  buildComparisonRef,
} from '../versionedFactionId'

describe('versionedFactionId', () => {
  describe('parseFactionRef', () => {
    it('should parse faction ID without version', () => {
      const result = parseFactionRef('MLA')
      expect(result).toEqual({ factionId: 'MLA', version: null })
    })

    it('should parse faction ID with version', () => {
      const result = parseFactionRef('exiles@0.7.0')
      expect(result).toEqual({ factionId: 'exiles', version: '0.7.0' })
    })

    it('should handle lowercase faction ID with version', () => {
      const result = parseFactionRef('mla@1.0.0')
      expect(result).toEqual({ factionId: 'mla', version: '1.0.0' })
    })

    it('should handle hyphenated faction IDs', () => {
      const result = parseFactionRef('second-wave@0.14.5')
      expect(result).toEqual({ factionId: 'second-wave', version: '0.14.5' })
    })

    it('should handle empty string', () => {
      const result = parseFactionRef('')
      expect(result).toEqual({ factionId: '', version: null })
    })

    it('should handle multiple @ symbols (use first)', () => {
      const result = parseFactionRef('test@1.0@extra')
      expect(result).toEqual({ factionId: 'test', version: '1.0@extra' })
    })

    it('should handle empty version string after @', () => {
      const result = parseFactionRef('exiles@')
      expect(result).toEqual({ factionId: 'exiles', version: null })
    })

    it('should handle consecutive @ symbols', () => {
      const result = parseFactionRef('test@@1.0')
      expect(result).toEqual({ factionId: 'test', version: '@1.0' })
    })

    it('should handle special characters in version (semver prerelease)', () => {
      const result = parseFactionRef('exiles@v1.0.0-beta+build.123')
      expect(result).toEqual({ factionId: 'exiles', version: 'v1.0.0-beta+build.123' })
    })

    it('should handle version with only numbers', () => {
      const result = parseFactionRef('mla@123')
      expect(result).toEqual({ factionId: 'mla', version: '123' })
    })
  })

  describe('buildFactionRef', () => {
    it('should build ref without version', () => {
      expect(buildFactionRef('MLA', null)).toBe('MLA')
      expect(buildFactionRef('MLA', undefined)).toBe('MLA')
    })

    it('should build ref with version', () => {
      expect(buildFactionRef('exiles', '0.7.0')).toBe('exiles@0.7.0')
    })

    it('should handle hyphenated faction IDs', () => {
      expect(buildFactionRef('second-wave', '0.14.5')).toBe('second-wave@0.14.5')
    })
  })

  describe('parseComparisonRef', () => {
    it('should parse comparison ref without version', () => {
      const result = parseComparisonRef('MLA/tank:2')
      expect(result).toEqual({
        factionId: 'MLA',
        version: null,
        unitId: 'tank',
        quantity: 2,
      })
    })

    it('should parse comparison ref with version', () => {
      const result = parseComparisonRef('exiles@0.7.0/exodus:1')
      expect(result).toEqual({
        factionId: 'exiles',
        version: '0.7.0',
        unitId: 'exodus',
        quantity: 1,
      })
    })

    it('should default quantity to 1 if not specified', () => {
      const result = parseComparisonRef('MLA/tank')
      expect(result).toEqual({
        factionId: 'MLA',
        version: null,
        unitId: 'tank',
        quantity: 1,
      })
    })

    it('should handle invalid format gracefully', () => {
      const result = parseComparisonRef('invalid')
      expect(result).toEqual({
        factionId: 'invalid',
        version: null,
        unitId: '',
        quantity: 1,
      })
    })

    it('should handle hyphenated faction and unit IDs', () => {
      const result = parseComparisonRef('second-wave@0.14.5/addon-tank:3')
      expect(result).toEqual({
        factionId: 'second-wave',
        version: '0.14.5',
        unitId: 'addon-tank',
        quantity: 3,
      })
    })

    it('should handle empty version in comparison ref', () => {
      const result = parseComparisonRef('exiles@/exodus:2')
      expect(result).toEqual({
        factionId: 'exiles',
        version: null,
        unitId: 'exodus',
        quantity: 2,
      })
    })

    it('should handle invalid quantity gracefully', () => {
      const result = parseComparisonRef('MLA/tank:abc')
      expect(result).toEqual({
        factionId: 'MLA',
        version: null,
        unitId: 'tank',
        quantity: 1,
      })
    })

    it('should handle zero quantity as 1 (falsy fallback)', () => {
      const result = parseComparisonRef('MLA/tank:0')
      expect(result).toEqual({
        factionId: 'MLA',
        version: null,
        unitId: 'tank',
        quantity: 1,
      })
    })

    it('should parse negative quantity (no validation)', () => {
      // Note: negative quantities are parsed as-is, validation is done elsewhere
      const result = parseComparisonRef('MLA/tank:-5')
      expect(result).toEqual({
        factionId: 'MLA',
        version: null,
        unitId: 'tank',
        quantity: -5,
      })
    })
  })

  describe('buildComparisonRef', () => {
    it('should build comparison ref without version', () => {
      const result = buildComparisonRef({
        factionId: 'MLA',
        unitId: 'tank',
        quantity: 2,
      })
      expect(result).toBe('MLA/tank:2')
    })

    it('should build comparison ref with version', () => {
      const result = buildComparisonRef({
        factionId: 'exiles',
        version: '0.7.0',
        unitId: 'exodus',
        quantity: 1,
      })
      expect(result).toBe('exiles@0.7.0/exodus:1')
    })

    it('should handle null version', () => {
      const result = buildComparisonRef({
        factionId: 'Legion',
        version: null,
        unitId: 'legion_tank',
        quantity: 3,
      })
      expect(result).toBe('Legion/legion_tank:3')
    })
  })

  describe('round-trip parsing', () => {
    it('should round-trip faction refs', () => {
      const original = 'exiles@0.7.0'
      const parsed = parseFactionRef(original)
      const rebuilt = buildFactionRef(parsed.factionId, parsed.version)
      expect(rebuilt).toBe(original)
    })

    it('should round-trip comparison refs', () => {
      const original = 'second-wave@0.14.5/addon-tank:3'
      const parsed = parseComparisonRef(original)
      const rebuilt = buildComparisonRef(parsed)
      expect(rebuilt).toBe(original)
    })
  })
})
