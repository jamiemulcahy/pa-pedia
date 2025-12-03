import type { UnitIndexEntry } from '@/types/faction'

/**
 * Calculate match score between two units based on unit type overlap.
 * Higher score = better match.
 */
export function calculateTypeMatchScore(
  sourceTypes: string[],
  candidateTypes: string[]
): number {
  const sourceSet = new Set(sourceTypes)
  let matchCount = 0

  for (const type of candidateTypes) {
    if (sourceSet.has(type)) matchCount++
  }

  return matchCount
}

/**
 * Find the best matching unit in a faction based on source unit's types.
 * Returns null if no reasonable match found.
 *
 * @param sourceUnitTypes - Unit types from the source unit to match against
 * @param targetUnits - Units in the target faction to search
 * @param minMatchScore - Minimum number of matching types required (default: 2)
 */
export function findBestMatchingUnit(
  sourceUnitTypes: string[],
  targetUnits: UnitIndexEntry[],
  minMatchScore: number = 2
): UnitIndexEntry | null {
  let bestMatch: UnitIndexEntry | null = null
  let bestScore = 0

  // Sort units for stable tie-breaking: by displayName, then by identifier
  const sortedUnits = [...targetUnits].sort((a, b) => {
    const nameCompare = a.displayName.localeCompare(b.displayName)
    if (nameCompare !== 0) return nameCompare
    return a.identifier.localeCompare(b.identifier)
  })

  for (const unit of sortedUnits) {
    const score = calculateTypeMatchScore(sourceUnitTypes, unit.unitTypes)
    if (score > bestScore && score >= minMatchScore) {
      bestScore = score
      bestMatch = unit
    }
  }

  return bestMatch
}
