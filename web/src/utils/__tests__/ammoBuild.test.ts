import { describe, it, expect } from 'vitest'
import { calculateAmmoBuildCost } from '../ammoBuild'
import type { EconomySpecs } from '@/types/faction'

/** MLA anti_nuke_launcher: builds at 60 metal/s while drawing 4000 energy/s */
const antiNukeEconomy: EconomySpecs = {
  buildCost: 12000,
  buildRate: 60,
  toolConsumption: { metal: 60, energy: 4000 },
}

describe('calculateAmmoBuildCost', () => {
  it('derives build time from the ammo cost and the unit build rate', () => {
    const cost = calculateAmmoBuildCost(5000, antiNukeEconomy)

    expect(cost?.metal).toBe(5000)
    expect(cost?.seconds).toBeCloseTo(83.333, 3)
  })

  it('bills energy for the whole build, not per second', () => {
    const cost = calculateAmmoBuildCost(5000, antiNukeEconomy)

    // 4000 energy/s over 83.33s
    expect(cost?.energy).toBe(333333)
  })

  it('returns undefined when the ammo has no build cost', () => {
    expect(calculateAmmoBuildCost(undefined, antiNukeEconomy)).toBeUndefined()
    expect(calculateAmmoBuildCost(0, antiNukeEconomy)).toBeUndefined()
  })

  it('returns undefined when the unit has no build arm to construct the round', () => {
    expect(calculateAmmoBuildCost(5000, undefined)).toBeUndefined()
    expect(calculateAmmoBuildCost(5000, { buildCost: 8000 })).toBeUndefined()
    expect(calculateAmmoBuildCost(5000, { buildCost: 8000, buildRate: 0 })).toBeUndefined()
  })

  it('reports zero energy for a build arm that draws no energy', () => {
    const cost = calculateAmmoBuildCost(300, { buildCost: 100, buildRate: 30 })

    expect(cost).toEqual({ metal: 300, energy: 0, seconds: 10 })
  })
})
