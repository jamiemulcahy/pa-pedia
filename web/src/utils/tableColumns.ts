import type { UnitIndexEntry } from '@/types/faction'

// All available column IDs
export type ColumnId =
  | 'name'
  | 'faction'
  | 'category'
  | 'tier'
  | 'cost'
  | 'hp'
  | 'dps'
  | 'speed'
  | 'accel'
  | 'brake'
  | 'turn'
  | 'range'
  | 'vision'
  | 'underwater'
  | 'buildRate'
  | 'buildEnergy'
  | 'energyPerMetal'
  | 'buildRange'
  | 'metalRate'
  | 'energyRate'
  | 'metalStorage'
  | 'energyStorage'
  | 'radar'
  | 'sonar'
  | 'orbitalVision'
  | 'orbitalRadar'

// Column definition with accessor and formatting
export interface ColumnDef {
  id: ColumnId
  label: string
  shortLabel?: string // For mobile/narrow screens
  align: 'left' | 'center' | 'right'
  getValue: (entry: UnitIndexEntry) => number | string | undefined
  format: (value: number | string | undefined) => string
  responsive?: string // Tailwind class for hiding on smaller screens
}

// Preset identifiers
export type PresetId = 'default' | 'combat' | 'builders' | 'factories' | 'commanders' | 'economy' | 'recon'

// Format helpers
function formatNumber(value: number | string | undefined): string {
  if (value === undefined || value === '') return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toFixed(0)
}

function formatDecimal(value: number | string | undefined): string {
  if (value === undefined || value === '' || value === 0) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return num.toFixed(1)
}

function formatRate(value: number | string | undefined): string {
  if (value === undefined || value === '' || value === 0) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  // Show positive rates with + sign
  const prefix = num > 0 ? '+' : ''
  return `${prefix}${num.toFixed(0)}`
}

// Get max range from all weapons
function getMaxRange(entry: UnitIndexEntry): number {
  return entry.unit.specs.combat.weapons?.reduce(
    (max, w) => Math.max(max, w.maxRange ?? 0),
    0
  ) ?? 0
}

// Get build energy consumption from build arms
function getBuildEnergy(entry: UnitIndexEntry): number {
  const toolConsumption = entry.unit.specs.economy.toolConsumption?.energy
  if (toolConsumption) return toolConsumption

  // Fall back to summing build arm consumption
  return entry.unit.specs.economy.buildArms?.reduce(
    (sum, arm) => sum + (arm.energyConsumption * arm.count),
    0
  ) ?? 0
}

// Get energy per metal ratio for builders
function getEnergyPerMetal(entry: UnitIndexEntry): number | undefined {
  const buildArms = entry.unit.specs.economy.buildArms
  if (!buildArms || buildArms.length === 0) return undefined

  const totalMetal = buildArms.reduce((sum, arm) => sum + (arm.metalConsumption * arm.count), 0)
  const totalEnergy = buildArms.reduce((sum, arm) => sum + (arm.energyConsumption * arm.count), 0)

  if (totalMetal === 0) return undefined
  return totalEnergy / totalMetal
}

// All column definitions
export const COLUMN_DEFS: Record<ColumnId, ColumnDef> = {
  name: {
    id: 'name',
    label: 'Name',
    align: 'left',
    getValue: (entry) => entry.displayName,
    format: (v) => String(v ?? '-'),
  },
  faction: {
    id: 'faction',
    label: 'Faction',
    align: 'left',
    getValue: () => undefined, // Handled specially in table component
    format: (v) => String(v ?? '-'),
    responsive: 'hidden sm:table-cell',
  },
  category: {
    id: 'category',
    label: 'Category',
    align: 'left',
    getValue: () => undefined, // Handled specially in table component
    format: (v) => String(v ?? '-'),
    responsive: 'hidden sm:table-cell',
  },
  tier: {
    id: 'tier',
    label: 'Tier',
    align: 'center',
    getValue: (entry) => entry.unit.tier,
    format: (v) => {
      const tier = typeof v === 'number' ? v : undefined
      switch (tier) {
        case 1: return 'T1'
        case 2: return 'T2'
        case 3: return 'T3'
        default: return '-'
      }
    },
    responsive: 'hidden md:table-cell',
  },
  cost: {
    id: 'cost',
    label: 'Cost',
    align: 'right',
    getValue: (entry) => entry.unit.specs.economy.buildCost,
    format: formatNumber,
    responsive: 'hidden md:table-cell',
  },
  hp: {
    id: 'hp',
    label: 'Health',
    shortLabel: 'HP',
    align: 'right',
    getValue: (entry) => entry.unit.specs.combat.health,
    format: formatNumber,
  },
  dps: {
    id: 'dps',
    label: 'DPS',
    align: 'right',
    getValue: (entry) => entry.unit.specs.combat.dps,
    format: formatDecimal,
    responsive: 'hidden sm:table-cell',
  },
  speed: {
    id: 'speed',
    label: 'Speed',
    align: 'right',
    getValue: (entry) => entry.unit.specs.mobility?.moveSpeed,
    format: formatNumber,
    responsive: 'hidden xl:table-cell',
  },
  accel: {
    id: 'accel',
    label: 'Accel',
    align: 'right',
    getValue: (entry) => entry.unit.specs.mobility?.acceleration,
    format: formatNumber,
    responsive: 'hidden xl:table-cell',
  },
  brake: {
    id: 'brake',
    label: 'Brake',
    align: 'right',
    getValue: (entry) => entry.unit.specs.mobility?.brake,
    format: formatNumber,
    responsive: 'hidden xl:table-cell',
  },
  turn: {
    id: 'turn',
    label: 'Turn',
    align: 'right',
    getValue: (entry) => entry.unit.specs.mobility?.turnSpeed,
    format: formatNumber,
    responsive: 'hidden xl:table-cell',
  },
  range: {
    id: 'range',
    label: 'Range',
    align: 'right',
    getValue: getMaxRange,
    format: (v) => (v && v !== 0) ? formatNumber(v) : '-',
    responsive: 'hidden lg:table-cell',
  },
  vision: {
    id: 'vision',
    label: 'Vision',
    align: 'right',
    getValue: (entry) => entry.unit.specs.recon?.visionRadius,
    format: formatNumber,
    responsive: 'hidden lg:table-cell',
  },
  underwater: {
    id: 'underwater',
    label: 'Underwater',
    shortLabel: 'UW',
    align: 'right',
    getValue: (entry) => entry.unit.specs.recon?.underwaterVisionRadius,
    format: formatNumber,
    responsive: 'hidden xl:table-cell',
  },
  buildRate: {
    id: 'buildRate',
    label: 'Build Rate',
    shortLabel: 'Rate',
    align: 'right',
    getValue: (entry) => entry.unit.specs.economy.buildRate,
    format: formatNumber,
    responsive: 'hidden md:table-cell',
  },
  buildEnergy: {
    id: 'buildEnergy',
    label: 'Build Energy',
    shortLabel: 'E Cost',
    align: 'right',
    getValue: getBuildEnergy,
    format: formatNumber,
    responsive: 'hidden lg:table-cell',
  },
  energyPerMetal: {
    id: 'energyPerMetal',
    label: 'E/M Ratio',
    shortLabel: 'E/M',
    align: 'right',
    getValue: getEnergyPerMetal,
    format: formatDecimal,
    responsive: 'hidden xl:table-cell',
  },
  buildRange: {
    id: 'buildRange',
    label: 'Build Range',
    shortLabel: 'B.Range',
    align: 'right',
    getValue: (entry) => entry.unit.specs.economy.buildRange,
    format: formatNumber,
    responsive: 'hidden lg:table-cell',
  },
  metalRate: {
    id: 'metalRate',
    label: 'Metal Rate',
    shortLabel: 'Metal',
    align: 'right',
    getValue: (entry) => {
      const prod = entry.unit.specs.economy.production?.metal ?? 0
      const cons = entry.unit.specs.economy.consumption?.metal ?? 0
      return prod - cons
    },
    format: formatRate,
    responsive: 'hidden md:table-cell',
  },
  energyRate: {
    id: 'energyRate',
    label: 'Energy Rate',
    shortLabel: 'Energy',
    align: 'right',
    getValue: (entry) => {
      const prod = entry.unit.specs.economy.production?.energy ?? 0
      const cons = entry.unit.specs.economy.consumption?.energy ?? 0
      return prod - cons
    },
    format: formatRate,
    responsive: 'hidden md:table-cell',
  },
  metalStorage: {
    id: 'metalStorage',
    label: 'Metal Storage',
    shortLabel: 'M Store',
    align: 'right',
    getValue: (entry) => entry.unit.specs.economy.storage?.metal,
    format: formatNumber,
    responsive: 'hidden lg:table-cell',
  },
  energyStorage: {
    id: 'energyStorage',
    label: 'Energy Storage',
    shortLabel: 'E Store',
    align: 'right',
    getValue: (entry) => entry.unit.specs.economy.storage?.energy,
    format: formatNumber,
    responsive: 'hidden lg:table-cell',
  },
  radar: {
    id: 'radar',
    label: 'Radar',
    align: 'right',
    getValue: (entry) => entry.unit.specs.recon?.radarRadius,
    format: formatNumber,
    responsive: 'hidden lg:table-cell',
  },
  sonar: {
    id: 'sonar',
    label: 'Sonar',
    align: 'right',
    getValue: (entry) => entry.unit.specs.recon?.sonarRadius,
    format: formatNumber,
    responsive: 'hidden xl:table-cell',
  },
  orbitalVision: {
    id: 'orbitalVision',
    label: 'Orbital Vision',
    shortLabel: 'Orb Vis',
    align: 'right',
    getValue: (entry) => entry.unit.specs.recon?.orbitalVisionRadius,
    format: formatNumber,
    responsive: 'hidden xl:table-cell',
  },
  orbitalRadar: {
    id: 'orbitalRadar',
    label: 'Orbital Radar',
    shortLabel: 'Orb Rad',
    align: 'right',
    getValue: (entry) => entry.unit.specs.recon?.orbitalRadarRadius,
    format: formatNumber,
    responsive: 'hidden xl:table-cell',
  },
}

// Column presets - which columns appear for each preset
// Note: 'name', 'faction', and 'category' are always included but faction is conditional on showFactionColumn

// Default columns (used when no specific filter or multiple filters)
const DEFAULT_COLUMNS: ColumnId[] = ['name', 'category', 'tier', 'hp', 'dps', 'range', 'cost', 'speed']

// Combat preset (Land, Air, Naval, Orbital, Hover, Titans, Bots, Vehicles, Mobile, Tank)
const COMBAT_COLUMNS: ColumnId[] = ['name', 'cost', 'dps', 'hp', 'speed', 'accel', 'brake', 'turn', 'range', 'vision', 'underwater']

// Builders preset (Builder, Construction, FabBuild, FabAdvBuild)
const BUILDERS_COLUMNS: ColumnId[] = ['name', 'cost', 'hp', 'buildRate', 'buildEnergy', 'energyPerMetal', 'buildRange', 'speed', 'accel', 'brake', 'turn']

// Factories preset (Factory)
const FACTORIES_COLUMNS: ColumnId[] = ['name', 'cost', 'hp', 'buildRate', 'buildEnergy', 'energyPerMetal', 'buildRange']

// Commanders preset (Commander)
const COMMANDERS_COLUMNS: ColumnId[] = ['name', 'cost', 'hp', 'buildRate', 'buildEnergy', 'energyPerMetal', 'buildRange', 'speed', 'accel', 'brake', 'turn']

// Economy preset (Economy, MetalProduction, EnergyProduction, EnergyStorage, MetalStorage)
const ECONOMY_COLUMNS: ColumnId[] = ['name', 'cost', 'hp', 'metalRate', 'energyRate', 'metalStorage', 'energyStorage']

// Recon preset (Recon, Radar, Scout)
const RECON_COLUMNS: ColumnId[] = ['name', 'cost', 'hp', 'energyRate', 'vision', 'radar', 'orbitalVision', 'orbitalRadar', 'sonar']

// Map of preset ID to column IDs
export const PRESET_COLUMNS: Record<PresetId, ColumnId[]> = {
  default: DEFAULT_COLUMNS,
  combat: COMBAT_COLUMNS,
  builders: BUILDERS_COLUMNS,
  factories: FACTORIES_COLUMNS,
  commanders: COMMANDERS_COLUMNS,
  economy: ECONOMY_COLUMNS,
  recon: RECON_COLUMNS,
}

// Filter values that map to each preset (lowercase, matched case-insensitively)
// Based on PA-Pedia unit types and PA Lobby category mappings
const COMBAT_FILTERS = [
  // Domain types (PA Lobby categories)
  'land', 'air', 'naval', 'orbital', 'hover', 'waterhover', 'mobile',
  // Unit class types
  'bot', 'bots', 'tank', 'vehicle', 'vehicles', 'titan', 'titans',
  // Combat subtypes
  'fighter', 'bomber', 'gunship', 'artillery', 'sub', 'transport',
  // Defense types (structures but combat-focused)
  'defense', 'airdefense', 'surfacedefense', 'orbitaldefense', 'missiledefense',
  'tacticaldefense', 'nukedefense',
]
const BUILDER_FILTERS = [
  // PA Lobby categories
  'builders', 'repair',
  // PA-Pedia unit types for builders
  'fabber', 'fabbuild', 'fabadvbuild', 'faborbbuild',
  'combatfabbuild', 'combatfabadvbuild', 'construction',
]
const FACTORY_FILTERS = ['factory']
const COMMANDER_FILTERS = ['commander', 'commanders']
const ECONOMY_FILTERS = [
  'economy', 'metalproduction', 'energyproduction',
  // Note: storage types don't exist as unit types but included for completeness
]
const RECON_FILTERS = ['recon', 'radar', 'radarjammer', 'scout']

/**
 * Detect which column preset to use based on active type filters.
 * Only triggers a preset when exactly one filter is active.
 */
export function detectPresetFromFilters(typeFilters: string[]): PresetId {
  // Multiple filters or no filters = default preset
  if (typeFilters.length !== 1) return 'default'

  const filter = typeFilters[0].toLowerCase()

  // Check each preset category
  if (BUILDER_FILTERS.includes(filter)) return 'builders'
  if (FACTORY_FILTERS.includes(filter)) return 'factories'
  if (COMMANDER_FILTERS.includes(filter)) return 'commanders'
  if (ECONOMY_FILTERS.includes(filter)) return 'economy'
  if (RECON_FILTERS.includes(filter)) return 'recon'
  if (COMBAT_FILTERS.includes(filter)) return 'combat'

  // Unknown filter type = default
  return 'default'
}

/**
 * Get column definitions for a preset, optionally including faction column.
 */
export function getColumnsForPreset(presetId: PresetId, includeFactionColumn: boolean): ColumnDef[] {
  const columnIds = PRESET_COLUMNS[presetId]
  const columns: ColumnDef[] = []

  for (const id of columnIds) {
    // Insert faction column after name if needed
    if (id === 'name') {
      columns.push(COLUMN_DEFS[id])
      if (includeFactionColumn) {
        columns.push(COLUMN_DEFS.faction)
      }
    } else if (id !== 'faction') {
      // Skip faction column in the preset list (we handle it above)
      columns.push(COLUMN_DEFS[id])
    }
  }

  return columns
}
