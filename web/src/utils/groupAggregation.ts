/**
 * Utility functions for aggregating stats across groups of units
 * Used in group comparison mode
 */

import type { Unit, Weapon } from '@/types/faction'
import type {
  GroupMember,
  AggregatedGroupStats,
  AggregatedWeapon,
  WeaponSource,
} from '@/types/group'

/**
 * Generate a key for grouping "same" weapons.
 * Uses safeName + sorted targetLayers for matching.
 */
export function getWeaponGroupKey(weapon: Weapon): string {
  const layers = (weapon.targetLayers ?? []).slice().sort().join(',')
  return `${weapon.safeName}|${layers}`
}

/**
 * Aggregate weapons from a unit into the collector map
 */
function aggregateWeapons(
  collector: Map<string, AggregatedWeapon>,
  unit: Unit,
  member: GroupMember,
  quantity: number
): void {
  const weapons = unit.specs.combat.weapons ?? []

  for (const weapon of weapons) {
    // Skip self-destruct and death explosions for group aggregation
    if (weapon.selfDestruct || weapon.deathExplosion) continue

    const key = getWeaponGroupKey(weapon)
    const existing = collector.get(key)

    const weaponCount = (weapon.count ?? 1) * quantity
    const weaponDps = (weapon.dps ?? 0) * (weapon.count ?? 1) * quantity
    const weaponSustainedDps = weapon.sustainedDps !== undefined
      ? weapon.sustainedDps * (weapon.count ?? 1) * quantity
      : undefined
    const weaponDamage = (weapon.damage ?? 0) * (weapon.count ?? 1) * quantity

    const source: WeaponSource = {
      factionId: member.factionId,
      unitId: member.unitId,
      displayName: unit.displayName,
      quantity,
    }

    if (existing) {
      existing.totalCount += weaponCount
      existing.totalDps += weaponDps
      if (weaponSustainedDps !== undefined) {
        existing.totalSustainedDps = (existing.totalSustainedDps ?? 0) + weaponSustainedDps
      }
      existing.totalDamage += weaponDamage

      // Check if this source unit is already in the list
      const existingSource = existing.sourceUnits.find(
        s => s.factionId === member.factionId && s.unitId === member.unitId
      )
      if (existingSource) {
        existingSource.quantity += quantity
      } else {
        existing.sourceUnits.push(source)
      }

      // Update MAX range if this weapon has longer range
      if (weapon.maxRange !== undefined) {
        existing.maxRange =
          existing.maxRange === undefined
            ? weapon.maxRange
            : Math.max(existing.maxRange, weapon.maxRange)
      }
    } else {
      collector.set(key, {
        safeName: weapon.safeName,
        displayName: weapon.name ?? weapon.safeName,
        targetLayers: weapon.targetLayers ?? [],
        totalCount: weaponCount,
        totalDps: weaponDps,
        totalSustainedDps: weaponSustainedDps,
        totalDamage: weaponDamage,
        maxRange: weapon.maxRange,
        rateOfFire: weapon.rateOfFire,
        sourceUnits: [source],
      })
    }
  }
}

/**
 * Helper to update MIN value (only mobile units count)
 */
function updateMin(
  current: number | undefined,
  value: number | undefined
): number | undefined {
  if (value === undefined) return current
  if (current === undefined) return value
  return Math.min(current, value)
}

/**
 * Helper to update MAX value
 */
function updateMax(
  current: number | undefined,
  value: number | undefined
): number | undefined {
  if (value === undefined) return current
  if (current === undefined) return value
  return Math.max(current, value)
}

/**
 * Aggregate stats across a group of units.
 *
 * @param members - Array of group members with quantities
 * @param getUnit - Function to retrieve a Unit by factionId and unitId
 * @returns Aggregated stats for the group, or null if no valid units
 */
export function aggregateGroupStats(
  members: GroupMember[],
  getUnit: (factionId: string, unitId: string) => Unit | undefined
): AggregatedGroupStats | null {
  const units = members
    .map(m => ({ member: m, unit: getUnit(m.factionId, m.unitId) }))
    .filter((u): u is { member: GroupMember; unit: Unit } => u.unit !== undefined)

  if (units.length === 0) return null

  // Initialize SUM aggregators
  let totalHp = 0
  let totalBuildCost = 0
  let totalDps = 0
  let totalSalvoDamage = 0
  let totalMetalProduction = 0
  let totalEnergyProduction = 0
  let totalMetalConsumption = 0
  let totalEnergyConsumption = 0
  let totalMetalStorage = 0
  let totalEnergyStorage = 0
  let totalBuildRate = 0
  let totalToolEnergyConsumption = 0

  // Initialize MIN aggregators (undefined until first valid value)
  let minMoveSpeed: number | undefined
  let minAcceleration: number | undefined
  let minBrake: number | undefined
  let minTurnSpeed: number | undefined

  // Initialize MAX aggregators
  let maxVisionRadius: number | undefined
  let maxUnderwaterVisionRadius: number | undefined
  let maxRadarRadius: number | undefined
  let maxSonarRadius: number | undefined
  let maxWeaponRange: number | undefined
  let maxBuildRange: number | undefined

  // Boolean aggregations
  let anyAmphibious = false
  let allAmphibious = true
  let anyHover = false
  let allHover = true

  // Weapon collector
  const weaponCollector: Map<string, AggregatedWeapon> = new Map()

  // SET aggregations (unique values across all units)
  const targetLayerSet = new Set<string>()
  const buildsSet = new Set<string>()

  // Track total unit count
  let unitCount = 0

  for (const { member, unit } of units) {
    const qty = member.quantity
    const { specs } = unit
    unitCount += qty

    // SUM aggregations - multiply by quantity
    totalHp += specs.combat.health * qty
    totalBuildCost += specs.economy.buildCost * qty
    totalDps += (specs.combat.dps ?? 0) * qty
    totalSalvoDamage += (specs.combat.salvoDamage ?? 0) * qty

    // Economy SUMs
    totalMetalProduction += (specs.economy.production?.metal ?? 0) * qty
    totalEnergyProduction += (specs.economy.production?.energy ?? 0) * qty
    totalMetalConsumption += (specs.economy.consumption?.metal ?? 0) * qty
    totalEnergyConsumption += (specs.economy.consumption?.energy ?? 0) * qty
    totalMetalStorage += (specs.economy.storage?.metal ?? 0) * qty
    totalEnergyStorage += (specs.economy.storage?.energy ?? 0) * qty
    totalBuildRate += (specs.economy.buildRate ?? 0) * qty
    totalToolEnergyConsumption += (specs.economy.toolConsumption?.energy ?? 0) * qty

    // MIN aggregations (only applies once per unit type, not per quantity)
    // Group speed is limited by slowest unit, regardless of how many
    minMoveSpeed = updateMin(minMoveSpeed, specs.mobility?.moveSpeed)
    minAcceleration = updateMin(minAcceleration, specs.mobility?.acceleration)
    minBrake = updateMin(minBrake, specs.mobility?.brake)
    minTurnSpeed = updateMin(minTurnSpeed, specs.mobility?.turnSpeed)

    // MAX aggregations (best capability regardless of quantity)
    maxVisionRadius = updateMax(maxVisionRadius, specs.recon?.visionRadius)
    maxUnderwaterVisionRadius = updateMax(
      maxUnderwaterVisionRadius,
      specs.recon?.underwaterVisionRadius
    )
    maxRadarRadius = updateMax(maxRadarRadius, specs.recon?.radarRadius)
    maxSonarRadius = updateMax(maxSonarRadius, specs.recon?.sonarRadius)
    maxBuildRange = updateMax(maxBuildRange, specs.economy.buildRange)

    // Boolean aggregations
    if (specs.special?.amphibious) anyAmphibious = true
    if (!specs.special?.amphibious) allAmphibious = false
    if (specs.special?.hover) anyHover = true
    if (!specs.special?.hover) allHover = false

    // SET aggregations - collect unique values
    // Collect target layers from all weapons
    for (const weapon of specs.combat.weapons ?? []) {
      if (weapon.selfDestruct || weapon.deathExplosion) continue
      for (const layer of weapon.targetLayers ?? []) {
        targetLayerSet.add(layer)
      }
    }

    // Collect buildable units
    for (const buildId of unit.buildRelationships?.builds ?? []) {
      buildsSet.add(buildId)
    }

    // Aggregate weapons
    aggregateWeapons(weaponCollector, unit, member, qty)
  }

  // Calculate max weapon range from aggregated weapons
  for (const weapon of weaponCollector.values()) {
    maxWeaponRange = updateMax(maxWeaponRange, weapon.maxRange)
  }

  // Handle edge case: if all units have undefined booleans, set to false
  if (units.every(u => u.unit.specs.special?.amphibious === undefined)) {
    allAmphibious = false
  }
  if (units.every(u => u.unit.specs.special?.hover === undefined)) {
    allHover = false
  }

  // Sort weapons by DPS (highest first)
  const weapons = Array.from(weaponCollector.values()).sort(
    (a, b) => b.totalDps - a.totalDps
  )

  // Calculate total sustained DPS from aggregated weapons
  // Only include if at least one weapon has sustained DPS different from burst
  let totalSustainedDps: number | undefined
  const hasSustainedWeapons = weapons.some(
    w => w.totalSustainedDps !== undefined && w.totalSustainedDps !== w.totalDps
  )
  if (hasSustainedWeapons) {
    // Sum sustained DPS: use totalSustainedDps if available, otherwise use totalDps
    totalSustainedDps = weapons.reduce(
      (sum, w) => sum + (w.totalSustainedDps ?? w.totalDps),
      0
    )
  }

  // Calculate derived metrics
  const dpsPerMetal = totalBuildCost > 0 ? totalDps / totalBuildCost : undefined
  const hpPerMetal = totalBuildCost > 0 ? totalHp / totalBuildCost : undefined

  return {
    totalHp,
    totalBuildCost,
    totalDps,
    totalSustainedDps,
    totalSalvoDamage,
    totalMetalProduction,
    totalEnergyProduction,
    totalMetalConsumption,
    totalEnergyConsumption,
    totalMetalStorage,
    totalEnergyStorage,
    totalBuildRate,
    totalToolEnergyConsumption,
    minMoveSpeed,
    minAcceleration,
    minBrake,
    minTurnSpeed,
    maxVisionRadius,
    maxUnderwaterVisionRadius,
    maxRadarRadius,
    maxSonarRadius,
    maxWeaponRange,
    maxBuildRange,
    dpsPerMetal,
    hpPerMetal,
    anyAmphibious,
    allAmphibious,
    anyHover,
    allHover,
    weapons,
    allTargetLayers: Array.from(targetLayerSet).sort(),
    allBuilds: Array.from(buildsSet).sort(),
    unitCount,
    distinctUnitTypes: units.length,
  }
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * Format a boolean aggregation for display
 */
export function formatBooleanAggregation(
  any: boolean,
  all: boolean
): string {
  if (all) return 'Yes (all)'
  if (any) return 'Some'
  return 'None'
}

/**
 * Calculate target layer overlap between two weapons
 */
function calculateLayerOverlap(layers1?: string[], layers2?: string[]): number {
  if (!layers1?.length || !layers2?.length) {
    return 0
  }
  const set1 = new Set(layers1)
  let overlap = 0
  for (const layer of layers2) {
    if (set1.has(layer)) {
      overlap++
    }
  }
  return overlap
}

/**
 * Calculate match score between two aggregated weapons.
 * Same logic as single unit comparison mode.
 */
function calculateWeaponMatchScore(
  weapon1: AggregatedWeapon,
  weapon2: AggregatedWeapon
): number {
  // Tier 1: Exact safeName match
  if (weapon1.safeName === weapon2.safeName) {
    return 1000
  }

  // Tier 2-3: Target layer overlap
  const overlap = calculateLayerOverlap(weapon1.targetLayers, weapon2.targetLayers)
  if (overlap === 0) return 0

  const layers1Count = weapon1.targetLayers?.length ?? 0
  const layers2Count = weapon2.targetLayers?.length ?? 0
  const maxLayers = Math.max(layers1Count, layers2Count)

  if (overlap === maxLayers && maxLayers > 0) {
    // Tier 2: All same targets (100% overlap)
    return 500 + overlap
  }

  // Tier 3: Partial overlap
  return overlap
}

/**
 * Match aggregated weapons from two groups for aligned display.
 * Uses two-pass matching to ensure exact safeName matches take priority:
 * 1. First pass: Match all exact safeName matches
 * 2. Second pass: Match remaining by target layer overlap
 *
 * @returns Array of pairs [weapon1 | undefined, weapon2 | undefined]
 */
export function matchAggregatedWeapons(
  weapons1: AggregatedWeapon[],
  weapons2: AggregatedWeapon[]
): [AggregatedWeapon | undefined, AggregatedWeapon | undefined][] {
  const result: [AggregatedWeapon | undefined, AggregatedWeapon | undefined][] = []
  const usedIndices1 = new Set<number>()
  const usedIndices2 = new Set<number>()

  // First pass: Exact safeName matches only
  for (let i = 0; i < weapons1.length; i++) {
    const weapon1 = weapons1[i]
    for (let j = 0; j < weapons2.length; j++) {
      if (usedIndices2.has(j)) continue
      if (weapon1.safeName === weapons2[j].safeName) {
        result.push([weapon1, weapons2[j]])
        usedIndices1.add(i)
        usedIndices2.add(j)
        break
      }
    }
  }

  // Second pass: Target layer matching for remaining weapons
  for (let i = 0; i < weapons1.length; i++) {
    if (usedIndices1.has(i)) continue
    const weapon1 = weapons1[i]

    let bestMatchIndex = -1
    let bestMatchScore = 0

    for (let j = 0; j < weapons2.length; j++) {
      if (usedIndices2.has(j)) continue

      const score = calculateWeaponMatchScore(weapon1, weapons2[j])
      // Only consider target layer matches (score < 1000, since exact matches are done)
      if (score > 0 && score < 1000 && score > bestMatchScore) {
        bestMatchScore = score
        bestMatchIndex = j
      }
    }

    if (bestMatchIndex >= 0) {
      result.push([weapon1, weapons2[bestMatchIndex]])
      usedIndices1.add(i)
      usedIndices2.add(bestMatchIndex)
    } else {
      result.push([weapon1, undefined])
      usedIndices1.add(i)
    }
  }

  // Add unmatched weapons from list 2
  for (let j = 0; j < weapons2.length; j++) {
    if (!usedIndices2.has(j)) {
      result.push([undefined, weapons2[j]])
    }
  }

  return result
}
