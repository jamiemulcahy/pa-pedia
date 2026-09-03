/**
 * Build cost of a single round of factory-sourced ammo.
 *
 * Launchers such as the anti-nuke launcher and nuke launcher do not drain metal
 * as they fire — they run a build arm to construct the next round, exactly like a
 * factory building a unit. PA charges the ammo blueprint's build_metal_cost at the
 * launcher's own build rate, so the reload time and energy bill are derived rather
 * than stated anywhere in the blueprints.
 */

import type { EconomySpecs } from '@/types/faction';

export interface AmmoBuildCost {
  /** Metal cost of one round (the ammo blueprint's build_metal_cost) */
  metal: number;
  /** Energy spent building one round: the build arm's drain over the build time */
  energy: number;
  /** Time to build one round at the unit's build rate */
  seconds: number;
}

/**
 * Returns the cost of building one round, or undefined when the numbers do not
 * describe a buildable round — no cost on the ammo, or no build arm on the unit.
 */
export function calculateAmmoBuildCost(
  metalCost: number | undefined,
  economy: EconomySpecs | undefined
): AmmoBuildCost | undefined {
  const buildRate = economy?.buildRate;

  if (!metalCost || metalCost <= 0 || !buildRate || buildRate <= 0) {
    return undefined;
  }

  const seconds = metalCost / buildRate;
  const energyRate = economy?.toolConsumption?.energy ?? 0;

  return {
    metal: metalCost,
    energy: Math.round(energyRate * seconds),
    seconds,
  };
}
