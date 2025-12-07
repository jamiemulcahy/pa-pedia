import type { Weapon } from '@/types/faction';

/**
 * Calculates the overlap between two sets of target layers.
 * Higher score means better match.
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
 * Matches weapons from one unit to weapons from another based on target layer compatibility.
 * Returns an array of weapon pairs where each pair contains [weapon1, matchingWeapon2 or undefined].
 *
 * Algorithm:
 * 1. For each weapon in the first list, find the best matching weapon in the second list
 *    based on target layer overlap
 * 2. Weapons with no overlapping layers get no match (undefined)
 * 3. Each weapon in the second list can only be matched once (first come, first served)
 */
export function matchWeaponsByTargetLayers(
  weapons1: Weapon[],
  weapons2: Weapon[]
): [Weapon | undefined, Weapon | undefined][] {
  const result: [Weapon | undefined, Weapon | undefined][] = [];
  const usedIndices2 = new Set<number>();

  // Track which weapons from list 2 have been matched
  const matched2: boolean[] = new Array(weapons2.length).fill(false);

  // For each weapon in list 1, find the best match in list 2
  for (const weapon1 of weapons1) {
    let bestMatchIndex = -1;
    let bestMatchScore = 0;

    for (let j = 0; j < weapons2.length; j++) {
      if (usedIndices2.has(j)) continue;

      const score = calculateLayerOverlap(weapon1.targetLayers, weapons2[j].targetLayers);

      // Only match if there's actual overlap
      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatchIndex = j;
      }
    }

    if (bestMatchIndex >= 0 && bestMatchScore > 0) {
      result.push([weapon1, weapons2[bestMatchIndex]]);
      usedIndices2.add(bestMatchIndex);
      matched2[bestMatchIndex] = true;
    } else {
      // No compatible weapon found
      result.push([weapon1, undefined]);
    }
  }

  // Add any unmatched weapons from list 2
  for (let j = 0; j < weapons2.length; j++) {
    if (!matched2[j]) {
      result.push([undefined, weapons2[j]]);
    }
  }

  return result;
}
