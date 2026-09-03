/**
 * Build cost of a single round of factory-sourced ammo.
 *
 * Launchers such as the anti-nuke launcher and nuke launcher do not drain metal
 * as they fire. They run a build arm to construct the next round, exactly like a
 * factory building a unit, paying the ammo blueprint's build_metal_cost. PA charges
 * that at the launcher's own build rate, so the reload time and the energy bill are
 * derived rather than stated anywhere in the blueprints.
 *
 * This is distinct from a metal-sourced weapon like the Ward, which refills an ammo
 * pool from the economy and never reads build_metal_cost at all - even though it
 * shares the very same ammo blueprint file as the anti-nuke launcher.
 */

import type { EconomySpecs } from '@/types/faction';

/**
 * A build_metal_cost of exactly 1 is a sentinel, not a price: it means the round's
 * cost is accounted for elsewhere. The unit cannon and Legion's orbital dropper both
 * use it, because what you actually pay for is the unit loaded into them, built
 * separately. Modders write 1 rather than 0 because 0 tends to read as "free" or
 * "instant" downstream. Every genuine cost in the data is at least 2000, so this
 * threshold sits in a wide gap rather than being tuned to a boundary.
 */
const PLACEHOLDER_METAL_COST = 1;

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
 * describe a buildable round: no build arm on the unit, or no real cost on the ammo.
 */
export function calculateAmmoBuildCost(
  metalCost: number | undefined,
  economy: EconomySpecs | undefined
): AmmoBuildCost | undefined {
  const buildRate = economy?.buildRate;

  if (!metalCost || metalCost <= PLACEHOLDER_METAL_COST || !buildRate || buildRate <= 0) {
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
