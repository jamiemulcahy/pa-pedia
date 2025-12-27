/**
 * Types for group comparison mode
 * Allows comparing aggregated stats across groups of units
 */

/** A single unit with quantity in a group */
export interface GroupMember {
  factionId: string
  unitId: string
  quantity: number
}

/** Source information for aggregated weapons */
export interface WeaponSource {
  factionId: string
  unitId: string
  displayName: string
  quantity: number
}

/** Weapon aggregated across multiple units in a group */
export interface AggregatedWeapon {
  /** Weapon identifier for matching */
  safeName: string
  /** Human-readable weapon name */
  displayName: string
  /** Target layers this weapon can hit */
  targetLayers: string[]
  /** Total weapon instances (weapon.count * unit quantity summed) */
  totalCount: number
  /** Total burst DPS from all instances (peak damage output) */
  totalDps: number
  /** Total sustained DPS from all instances (effective DPS with ammo limitations) */
  totalSustainedDps?: number
  /** Total damage per volley from all instances */
  totalDamage: number
  /** Maximum range (MAX across all instances) */
  maxRange?: number
  /** Rate of fire (preserved from first weapon for display) */
  rateOfFire?: number
  /** Units contributing to this aggregated weapon */
  sourceUnits: WeaponSource[]
}

/** Aggregated stats for a group of units */
export interface AggregatedGroupStats {
  // ===== SUM stats (total group capability) =====
  /** Total health points */
  totalHp: number
  /** Total metal build cost */
  totalBuildCost: number
  /** Total burst DPS (peak damage output) */
  totalDps: number
  /** Total sustained DPS (effective DPS with ammo limitations) */
  totalSustainedDps?: number
  /** Total damage in single volley */
  totalSalvoDamage: number
  /** Total metal production per second */
  totalMetalProduction: number
  /** Total energy production per second */
  totalEnergyProduction: number
  /** Total metal consumption per second */
  totalMetalConsumption: number
  /** Total energy consumption per second */
  totalEnergyConsumption: number
  /** Total metal storage capacity */
  totalMetalStorage: number
  /** Total energy storage capacity */
  totalEnergyStorage: number
  /** Combined build rate */
  totalBuildRate: number
  /** Total energy consumed during construction (tool consumption) */
  totalToolEnergyConsumption: number

  // ===== MIN stats (slowest limits group) =====
  /** Minimum movement speed (slowest unit) */
  minMoveSpeed?: number
  /** Minimum acceleration (slowest unit) */
  minAcceleration?: number
  /** Minimum braking rate (slowest unit) */
  minBrake?: number
  /** Minimum turn speed (slowest unit) */
  minTurnSpeed?: number

  // ===== MAX stats (best capability) =====
  /** Maximum vision radius (best scout) */
  maxVisionRadius?: number
  /** Maximum underwater vision radius */
  maxUnderwaterVisionRadius?: number
  /** Maximum radar radius */
  maxRadarRadius?: number
  /** Maximum sonar radius */
  maxSonarRadius?: number
  /** Maximum weapon range */
  maxWeaponRange?: number
  /** Maximum build range */
  maxBuildRange?: number

  // ===== DERIVED efficiency metrics =====
  /** DPS per metal cost */
  dpsPerMetal?: number
  /** HP per metal cost */
  hpPerMetal?: number

  // ===== BOOLEAN aggregations =====
  /** At least one unit is amphibious */
  anyAmphibious: boolean
  /** All units are amphibious */
  allAmphibious: boolean
  /** At least one unit hovers */
  anyHover: boolean
  /** All units hover */
  allHover: boolean

  // ===== WEAPON aggregations =====
  /** Distinct weapons aggregated across all units */
  weapons: AggregatedWeapon[]

  // ===== SET aggregations (unique values from all units) =====
  /** All unique target layers the group can hit */
  allTargetLayers: string[]
  /** All unique unit IDs the group can build */
  allBuilds: string[]
  /** Effective build rate for each buildable unit (only units that can build it contribute) */
  buildRateByUnit: Record<string, number>

  // ===== GROUP metadata =====
  /** Total number of units (sum of quantities) */
  unitCount: number
  /** Number of distinct unit types */
  distinctUnitTypes: number
}

/** Comparison mode */
export type ComparisonMode = 'unit' | 'group'
