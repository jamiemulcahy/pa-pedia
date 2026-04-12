import type { Unit } from '@/types/faction'

/**
 * Calculate the effective DPS for a unit, accounting for ammo-limited weapons.
 *
 * When any weapon has a sustained DPS (ammo recovery limits fire rate),
 * returns the total sustained DPS across all weapons. Otherwise returns
 * the burst DPS from combat.dps.
 *
 * This ensures consistent DPS display across table view, detail view,
 * and SEO metadata.
 */
export function getEffectiveUnitDps(unit: Unit): number | undefined {
  const burstDps = unit.specs.combat.dps
  const weapons = unit.specs.combat.weapons
  if (!weapons?.length) return burstDps

  const hasSustainedWeapons = weapons.some(
    w => !w.selfDestruct && !w.deathExplosion &&
         w.sustainedDps !== undefined && w.sustainedDps !== w.dps
  )

  if (!hasSustainedWeapons) return burstDps

  return weapons.reduce((sum, w) => {
    if (w.selfDestruct || w.deathExplosion) return sum
    return sum + (w.sustainedDps ?? w.dps ?? 0) * (w.count ?? 1)
  }, 0)
}
