import type { Weapon } from '@/types/faction'
import type { AggregatedWeapon } from '@/types/group'

/** Mapping from PA internal target layer names to human-readable display names */
export const TARGET_LAYER_DISPLAY_NAMES: Record<string, string> = {
  LandHorizontal: 'Land',
  WaterSurface: 'Sea',
  Underwater: 'Sub',
  Seafloor: 'Seafloor',
  Air: 'Air',
  Orbital: 'Orbital',
}

/** Canonical display order for target layers */
export const TARGET_LAYER_ORDER: string[] = [
  'LandHorizontal',
  'WaterSurface',
  'Underwater',
  'Seafloor',
  'Air',
  'Orbital',
]

/** Get human-readable display name for a target layer */
export function formatLayerName(layer: string): string {
  return TARGET_LAYER_DISPLAY_NAMES[layer] ?? layer
}

/** Format an array of target layers into a human-readable string */
export function formatTargetLayers(layers?: string[]): string | undefined {
  if (!layers || layers.length === 0) return undefined
  return layers.map(formatLayerName).join(', ')
}

/** DPS values for a single target layer */
export interface LayerDps {
  burst: number
  sustained: number
  burn: number
}

/** DPS breakdown by target layer */
export type DpsByLayer = Record<string, LayerDps>

/**
 * Calculate DPS breakdown by target layer from a unit's weapons.
 * Each weapon contributes its full DPS to every layer it can target.
 * Death explosions and self-destruct weapons are excluded.
 */
export function calculateDpsByLayer(weapons: Weapon[] | undefined): DpsByLayer {
  if (!weapons) return {}

  const result: DpsByLayer = {}

  for (const weapon of weapons) {
    if (weapon.selfDestruct || weapon.deathExplosion) continue
    if (!weapon.targetLayers || weapon.targetLayers.length === 0) continue

    const count = weapon.count ?? 1
    const burstDps = (weapon.dps ?? 0) * count
    const sustainedDps = (weapon.sustainedDps ?? weapon.dps ?? 0) * count
    const burnDps = (weapon.burnDps ?? 0) * count

    for (const layer of weapon.targetLayers) {
      if (!result[layer]) {
        result[layer] = { burst: 0, sustained: 0, burn: 0 }
      }
      result[layer].burst += burstDps
      result[layer].sustained += sustainedDps
      result[layer].burn += burnDps
    }
  }

  // Round values
  for (const layer of Object.keys(result)) {
    result[layer].burst = Math.round(result[layer].burst * 10) / 10
    result[layer].sustained = Math.round(result[layer].sustained * 10) / 10
    result[layer].burn = Math.round(result[layer].burn * 10) / 10
  }

  return result
}

/**
 * Calculate DPS breakdown by target layer from aggregated group weapons.
 */
export function calculateGroupDpsByLayer(weapons: AggregatedWeapon[]): DpsByLayer {
  const result: DpsByLayer = {}

  for (const weapon of weapons) {
    if (!weapon.targetLayers || weapon.targetLayers.length === 0) continue

    const burstDps = weapon.totalDps
    const sustainedDps = weapon.totalSustainedDps ?? weapon.totalDps
    const burnDps = weapon.totalBurnDps ?? 0

    for (const layer of weapon.targetLayers) {
      if (!result[layer]) {
        result[layer] = { burst: 0, sustained: 0, burn: 0 }
      }
      result[layer].burst += burstDps
      result[layer].sustained += sustainedDps
      result[layer].burn += burnDps
    }
  }

  // Round values
  for (const layer of Object.keys(result)) {
    result[layer].burst = Math.round(result[layer].burst * 10) / 10
    result[layer].sustained = Math.round(result[layer].sustained * 10) / 10
    result[layer].burn = Math.round(result[layer].burn * 10) / 10
  }

  return result
}

/**
 * Get sorted layers from a DpsByLayer record, following canonical order.
 * Unknown layers are appended at the end alphabetically.
 */
export function getSortedLayers(dpsByLayer: DpsByLayer): string[] {
  const layers = Object.keys(dpsByLayer)
  return layers.sort((a, b) => {
    const aIdx = TARGET_LAYER_ORDER.indexOf(a)
    const bIdx = TARGET_LAYER_ORDER.indexOf(b)
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })
}
