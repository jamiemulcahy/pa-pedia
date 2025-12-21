/**
 * Commander Deduplication Utility
 *
 * Detects duplicate commander variants based on gameplay stats and groups them together.
 * Commanders with identical stats (health, DPS, weapons, mobility, etc.) are considered
 * duplicates, while those with different stats are unique units.
 */

import type { UnitIndexEntry, Weapon, Unit } from '@/types/faction';

/**
 * Represents a group of commanders with identical gameplay stats.
 * The representative is shown by default, variants are hidden until expanded.
 */
export interface CommanderGroup {
  /** The commander shown by default (alphabetically first by displayName) */
  representative: UnitIndexEntry;
  /** Other commanders with identical stats (excludes representative) */
  variants: UnitIndexEntry[];
  /** Hash of gameplay-affecting stats for this group */
  statsHash: string;
}

/**
 * Result of grouping units into commanders (grouped) and non-commanders (unchanged).
 */
export interface CommanderGroupingResult {
  /** Commander groups, each with a representative and variants */
  commanders: CommanderGroup[];
  /** Non-commander units, passed through unchanged */
  nonCommanders: UnitIndexEntry[];
}

/**
 * Checks if a unit is a commander based on its unit types.
 */
export function isCommander(unit: UnitIndexEntry): boolean {
  return unit.unitTypes.includes('Commander');
}

/**
 * Computes a signature string for a weapon that captures gameplay-affecting properties.
 * Weapons are considered identical if their signatures match.
 */
function computeWeaponSignature(weapon: Weapon): string {
  const parts = [
    weapon.safeName,
    weapon.count,
    weapon.damage,
    weapon.dps,
    weapon.rateOfFire,
    weapon.maxRange ?? 0,
    weapon.splashDamage ?? 0,
    weapon.splashRadius ?? 0,
    weapon.selfDestruct ?? false,
    weapon.deathExplosion ?? false,
    weapon.ammoSource ?? '',
    weapon.ammoPerShot ?? 0,
  ];
  return parts.join('|');
}

/**
 * Computes a combined signature for all weapons on a unit.
 * Weapons are sorted by safeName to ensure consistent ordering.
 */
function computeWeaponsSignature(weapons: Weapon[] | undefined): string {
  if (!weapons || weapons.length === 0) return '';

  const signatures = weapons
    .map(computeWeaponSignature)
    .sort(); // Sort for consistent ordering

  return signatures.join(';');
}

/**
 * Computes a hash string for a unit based on all gameplay-affecting stats.
 * Two units with the same hash are considered gameplay-identical (duplicates).
 *
 * Includes:
 * - Combat: health, DPS, salvo damage, all weapons
 * - Economy: build cost, build rate, metal/energy rates
 * - Mobility: move speed, turn speed, acceleration, brake
 * - Recon: vision, radar, sonar ranges
 * - Special: amphibious, hover, spawn on death
 */
export function computeCommanderStatsHash(unit: Unit): string {
  const { specs } = unit;

  const parts: (string | number | boolean | undefined)[] = [
    // Combat
    specs.combat.health,
    specs.combat.dps,
    specs.combat.salvoDamage,
    computeWeaponsSignature(specs.combat.weapons),

    // Economy
    specs.economy.buildCost,
    specs.economy.buildRate,
    specs.economy.metalRate,
    specs.economy.energyRate,
    specs.economy.buildRange,

    // Mobility
    specs.mobility?.moveSpeed,
    specs.mobility?.turnSpeed,
    specs.mobility?.acceleration,
    specs.mobility?.brake,

    // Recon
    specs.recon?.visionRadius,
    specs.recon?.radarRadius,
    specs.recon?.sonarRadius,
    specs.recon?.orbitalVisionRadius,
    specs.recon?.orbitalRadarRadius,

    // Special
    specs.special?.amphibious ?? false,
    specs.special?.hover ?? false,
    specs.special?.spawnUnitOnDeath ?? '',
  ];

  return parts.map((p) => String(p ?? '')).join('::');
}

/**
 * Groups commanders by their gameplay stats, keeping non-commanders separate.
 *
 * Within each group:
 * - The representative is the commander with the alphabetically first displayName
 * - Variants are all other commanders in the group (sorted alphabetically)
 *
 * @param units - All units to process (commanders and non-commanders)
 * @returns Object with grouped commanders and unchanged non-commanders
 */
export function groupCommanderVariants(
  units: UnitIndexEntry[]
): CommanderGroupingResult {
  const commanders: UnitIndexEntry[] = [];
  const nonCommanders: UnitIndexEntry[] = [];

  // Separate commanders from non-commanders
  for (const unit of units) {
    if (isCommander(unit)) {
      commanders.push(unit);
    } else {
      nonCommanders.push(unit);
    }
  }

  // Group commanders by stats hash
  const groupMap = new Map<string, UnitIndexEntry[]>();

  for (const commander of commanders) {
    const hash = computeCommanderStatsHash(commander.unit);
    const existing = groupMap.get(hash);
    if (existing) {
      existing.push(commander);
    } else {
      groupMap.set(hash, [commander]);
    }
  }

  // Convert groups to CommanderGroup objects
  const commanderGroups: CommanderGroup[] = [];

  for (const [statsHash, group] of groupMap) {
    // Sort alphabetically by displayName
    const sorted = [...group].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );

    const [representative, ...variants] = sorted;

    commanderGroups.push({
      representative,
      variants,
      statsHash,
    });
  }

  // Sort groups by representative displayName
  commanderGroups.sort((a, b) =>
    a.representative.displayName.localeCompare(b.representative.displayName)
  );

  return {
    commanders: commanderGroups,
    nonCommanders,
  };
}

/**
 * Gets the total count of commanders in a grouping result.
 */
export function getTotalCommanderCount(result: CommanderGroupingResult): number {
  return result.commanders.reduce(
    (sum, group) => sum + 1 + group.variants.length,
    0
  );
}

/**
 * Gets the count of hidden variants (commanders not shown as representatives).
 */
export function getHiddenVariantCount(result: CommanderGroupingResult): number {
  return result.commanders.reduce((sum, group) => sum + group.variants.length, 0);
}
