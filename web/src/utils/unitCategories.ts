/**
 * Unit category mapping utilities for grouping units by domain/type.
 *
 * Categories are mutually exclusive - each unit belongs to exactly one category.
 * Detection priority ensures proper categorization when units have multiple types.
 */

export type UnitCategory =
  | 'Factories'
  | 'Defenses'
  | 'Structures'
  | 'Bots'
  | 'Tanks'
  | 'Vehicles'
  | 'Air'
  | 'Naval'
  | 'Orbital'
  | 'Titans'
  | 'Commanders'
  | 'Other'

/** Display order for categories on the faction page */
export const CATEGORY_ORDER: UnitCategory[] = [
  'Factories',
  'Defenses',
  'Structures',
  'Bots',
  'Tanks',
  'Vehicles',
  'Air',
  'Naval',
  'Orbital',
  'Titans',
  'Commanders',
  'Other',
]

/**
 * Determines which category a unit belongs to based on its unitTypes.
 * Uses first-match priority to ensure mutual exclusivity.
 */
export function getUnitCategory(unitTypes: string[]): UnitCategory {
  const types = new Set(unitTypes)

  // Priority 1: Commanders (always first)
  if (types.has('Commander')) return 'Commanders'

  // Priority 2: Titans (catches all titan types including structures)
  if (types.has('Titan')) return 'Titans'

  // Priority 3-5: Structure subcategories (Factory > Defense > Structure)
  if (types.has('Structure')) {
    if (types.has('Factory')) return 'Factories'
    if (types.has('Defense')) return 'Defenses'
    return 'Structures'
  }

  // Priority 6-8: Land subcategories (Bot > Tank > Vehicle)
  if (types.has('Bot')) return 'Bots'
  if (types.has('Tank')) return 'Tanks'
  if (types.has('Land')) return 'Vehicles'

  // Priority 9-11: Other domains
  if (types.has('Air')) return 'Air'
  if (types.has('Naval')) return 'Naval'
  if (types.has('Orbital')) return 'Orbital'

  return 'Other'
}

/**
 * Groups an array of units by their category.
 * Returns a Map with categories in display order, including empty categories.
 *
 * @typeParam T - Any object with a `unitTypes` string array. Uses a generic rather than
 *   coupling to UnitIndexEntry to allow reuse with different unit representations
 *   (e.g., Unit, UnitIndexEntry, or test mocks).
 * @param units - Array of units to group
 * @returns Map with categories as keys (in CATEGORY_ORDER) and arrays of units as values
 */
export function groupUnitsByCategory<T extends { unitTypes: string[] }>(
  units: T[]
): Map<UnitCategory, T[]> {
  const groups = new Map<UnitCategory, T[]>()

  // Initialize all categories in order
  for (const category of CATEGORY_ORDER) {
    groups.set(category, [])
  }

  // Assign each unit to its category
  for (const unit of units) {
    const category = getUnitCategory(unit.unitTypes)
    groups.get(category)!.push(unit)
  }

  return groups
}
