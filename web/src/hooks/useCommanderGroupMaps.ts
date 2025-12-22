import { useMemo } from 'react'
import type { CommanderGroup } from '@/utils/commanderDedup'

/**
 * Result of building commander group lookup maps.
 */
export interface CommanderGroupMaps {
  /**
   * Maps unit identifier to its CommanderGroup.
   * Includes both representatives and variants.
   */
  groupMap: Map<string, CommanderGroup>
  /**
   * Set of variant identifiers (units that should be hidden when collapsed).
   * Does not include representatives.
   */
  variantIdentifiers: Set<string>
}

/**
 * Builds lookup maps for commander group membership.
 *
 * This hook is used by table and list views to efficiently:
 * - Check if a unit is a variant (should be hidden when collapsed)
 * - Get the group info for any commander (to show expand button, count variants)
 *
 * @param commanderGroups - Array of CommanderGroup objects, or undefined if not applicable
 * @returns Maps for quick lookups, both empty if commanderGroups is undefined
 */
export function useCommanderGroupMaps(
  commanderGroups: CommanderGroup[] | undefined
): CommanderGroupMaps {
  const groupMap = useMemo(() => {
    const map = new Map<string, CommanderGroup>()
    if (!commanderGroups) return map

    for (const group of commanderGroups) {
      // Map representative
      map.set(group.representative.identifier, group)
      // Map variants
      for (const variant of group.variants) {
        map.set(variant.identifier, group)
      }
    }
    return map
  }, [commanderGroups])

  const variantIdentifiers = useMemo(() => {
    const set = new Set<string>()
    if (!commanderGroups) return set

    for (const group of commanderGroups) {
      for (const variant of group.variants) {
        set.add(variant.identifier)
      }
    }
    return set
  }, [commanderGroups])

  return { groupMap, variantIdentifiers }
}
