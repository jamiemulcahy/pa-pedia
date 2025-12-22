import type { Weapon } from '@/types/faction';

/**
 * Calculates the overlap between two sets of target layers.
 *
 * @param layers1 - First weapon's target layers
 * @param layers2 - Second weapon's target layers
 * @returns Number of overlapping layers (0 if no overlap or either is undefined/empty)
 *
 * @example
 * calculateLayerOverlap(['LandHorizontal', 'WaterSurface'], ['LandHorizontal', 'Air']) // returns 1
 * calculateLayerOverlap(['LandHorizontal'], ['Air']) // returns 0
 */
function calculateLayerOverlap(layers1?: string[], layers2?: string[]): number {
  if (!layers1?.length || !layers2?.length) {
    // If either has no layers, they might match anything - low score
    return 0;
  }

  const set1 = new Set(layers1);
  const set2 = new Set(layers2);

  let overlap = 0;
  for (const layer of set1) {
    if (set2.has(layer)) {
      overlap++;
    }
  }

  return overlap;
}

/**
 * Calculates a hierarchical match score between two weapons.
 *
 * Priority tiers:
 * - Tier 1 (1000): Exact safeName match (e.g., both are "uber_cannon")
 * - Tier 2 (500+): All target layers match (100% overlap)
 * - Tier 3 (1-499): Partial target layer overlap
 * - No match (0): Incomparable weapons (no shared targets)
 *
 * @example
 * // Same safeName - highest priority
 * calculateMatchScore({safeName: 'uber_cannon', ...}, {safeName: 'uber_cannon', ...}) // returns 1000
 *
 * // Different names but same targets
 * calculateMatchScore({safeName: 'a', targetLayers: ['Air']}, {safeName: 'b', targetLayers: ['Air']}) // returns 501
 *
 * // Partial overlap
 * calculateMatchScore({safeName: 'a', targetLayers: ['Air', 'Land']}, {safeName: 'b', targetLayers: ['Air']}) // returns 1
 */
function calculateMatchScore(weapon1: Weapon, weapon2: Weapon): number {
  // Tier 1: Exact safeName match (highest priority)
  if (weapon1.safeName === weapon2.safeName) {
    return 1000;
  }

  // Tier 2-3: Target layer overlap
  const overlap = calculateLayerOverlap(weapon1.targetLayers, weapon2.targetLayers);
  if (overlap === 0) return 0; // No match for incomparable weapons

  // Calculate if this is complete or partial overlap
  const layers1Count = weapon1.targetLayers?.length ?? 0;
  const layers2Count = weapon2.targetLayers?.length ?? 0;
  const maxLayers = Math.max(layers1Count, layers2Count);

  if (overlap === maxLayers && maxLayers > 0) {
    // Tier 2: All same targets (100% overlap)
    return 500 + overlap;
  }

  // Tier 3: Partial overlap
  return overlap;
}

/**
 * Matches weapons from one unit to weapons from another based on compatibility.
 * Returns an array of weapon pairs where each pair contains [weapon1, matchingWeapon2 or undefined].
 *
 * Matching priority:
 * 1. Exact safeName match (e.g., "uber_cannon" vs "uber_cannon")
 * 2. All same target layers (100% overlap)
 * 3. Partial target layer overlap
 * 4. No match - incomparable weapons (e.g., torpedo vs anti-air)
 *
 * Each weapon in the second list can only be matched once (first come, first served).
 */
export function matchWeaponsByTargetLayers(
  weapons1: Weapon[],
  weapons2: Weapon[]
): [Weapon | undefined, Weapon | undefined][] {
  const result: [Weapon | undefined, Weapon | undefined][] = [];
  const usedIndices2 = new Set<number>();

  // For each weapon in list 1, find the best match in list 2
  for (const weapon1 of weapons1) {
    let bestMatchIndex = -1;
    let bestMatchScore = 0;

    for (let j = 0; j < weapons2.length; j++) {
      if (usedIndices2.has(j)) continue;

      const score = calculateMatchScore(weapon1, weapons2[j]);

      // Only match if there's a valid score (safeName match or target layer overlap)
      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatchIndex = j;
      }
    }

    if (bestMatchIndex >= 0 && bestMatchScore > 0) {
      result.push([weapon1, weapons2[bestMatchIndex]]);
      usedIndices2.add(bestMatchIndex);
    } else {
      // No compatible weapon found
      result.push([weapon1, undefined]);
    }
  }

  // Add any unmatched weapons from list 2
  for (let j = 0; j < weapons2.length; j++) {
    if (!usedIndices2.has(j)) {
      result.push([undefined, weapons2[j]]);
    }
  }

  return result;
}
