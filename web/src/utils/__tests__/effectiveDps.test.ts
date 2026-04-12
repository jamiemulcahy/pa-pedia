import { describe, it, expect } from 'vitest'
import { getEffectiveUnitDps } from '@/utils/effectiveDps'
import type { Unit } from '@/types/faction'

/** Minimal unit helper - only fills fields relevant to DPS calculation */
function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'test',
    resourceName: '/pa/units/test/test.json',
    displayName: 'Test Unit',
    tier: 1,
    unitTypes: [],
    accessible: true,
    specs: {
      combat: { health: 100 },
      economy: { buildCost: 100 },
    },
    buildRelationships: {},
    ...overrides,
  } as Unit
}

describe('getEffectiveUnitDps', () => {
  it('returns burst DPS when no weapons', () => {
    const unit = makeUnit({
      specs: {
        combat: { health: 100, dps: 50 },
        economy: { buildCost: 100 },
      },
    } as Partial<Unit>)
    expect(getEffectiveUnitDps(unit)).toBe(50)
  })

  it('returns burst DPS when weapons have no sustained DPS', () => {
    const unit = makeUnit({
      specs: {
        combat: {
          health: 100,
          dps: 200,
          weapons: [
            { safeName: 'gun', resourceName: '/gun.json', count: 2, rateOfFire: 10, damage: 10, dps: 100 },
          ],
        },
        economy: { buildCost: 100 },
      },
    } as Partial<Unit>)
    expect(getEffectiveUnitDps(unit)).toBe(200)
  })

  it('returns sustained DPS when weapons are ammo-limited (Cub scenario)', () => {
    const unit = makeUnit({
      specs: {
        combat: {
          health: 110,
          dps: 200,
          weapons: [
            {
              safeName: 'can_tool_weapon',
              resourceName: '/pa/units/land/can/can_tool_weapon.json',
              count: 2,
              rateOfFire: 10,
              damage: 10,
              dps: 100,
              sustainedDps: 13.33,
            },
          ],
        },
        economy: { buildCost: 70 },
      },
    } as Partial<Unit>)
    expect(getEffectiveUnitDps(unit)).toBeCloseTo(26.66, 1)
  })

  it('mixes sustained and non-sustained weapons correctly', () => {
    const unit = makeUnit({
      specs: {
        combat: {
          health: 500,
          dps: 150,
          weapons: [
            { safeName: 'gun', resourceName: '/gun.json', count: 1, rateOfFire: 5, damage: 10, dps: 50 },
            { safeName: 'cannon', resourceName: '/cannon.json', count: 1, rateOfFire: 10, damage: 10, dps: 100, sustainedDps: 20 },
          ],
        },
        economy: { buildCost: 200 },
      },
    } as Partial<Unit>)
    // gun: no sustained -> uses dps=50, cannon: sustained=20
    expect(getEffectiveUnitDps(unit)).toBe(70)
  })

  it('excludes death explosion weapons', () => {
    const unit = makeUnit({
      specs: {
        combat: {
          health: 100,
          dps: 200,
          weapons: [
            { safeName: 'gun', resourceName: '/gun.json', count: 1, rateOfFire: 10, damage: 10, dps: 100, sustainedDps: 20 },
            { safeName: 'boom', resourceName: '/boom.json', count: 1, rateOfFire: 1, damage: 500, dps: 500, deathExplosion: true },
          ],
        },
        economy: { buildCost: 100 },
      },
    } as Partial<Unit>)
    expect(getEffectiveUnitDps(unit)).toBe(20)
  })

  it('excludes self-destruct weapons', () => {
    const unit = makeUnit({
      specs: {
        combat: {
          health: 100,
          dps: 200,
          weapons: [
            { safeName: 'gun', resourceName: '/gun.json', count: 1, rateOfFire: 10, damage: 10, dps: 100, sustainedDps: 30 },
            { safeName: 'nuke', resourceName: '/nuke.json', count: 1, rateOfFire: 1, damage: 1000, dps: 1000, selfDestruct: true },
          ],
        },
        economy: { buildCost: 100 },
      },
    } as Partial<Unit>)
    expect(getEffectiveUnitDps(unit)).toBe(30)
  })

  it('returns undefined when no combat DPS', () => {
    const unit = makeUnit({
      specs: {
        combat: { health: 100 },
        economy: { buildCost: 100 },
      },
    } as Partial<Unit>)
    expect(getEffectiveUnitDps(unit)).toBeUndefined()
  })

  it('returns burst DPS when sustained equals burst', () => {
    const unit = makeUnit({
      specs: {
        combat: {
          health: 100,
          dps: 100,
          weapons: [
            { safeName: 'gun', resourceName: '/gun.json', count: 1, rateOfFire: 10, damage: 10, dps: 100, sustainedDps: 100 },
          ],
        },
        economy: { buildCost: 100 },
      },
    } as Partial<Unit>)
    // sustainedDps === dps, so no sustained weapons detected
    expect(getEffectiveUnitDps(unit)).toBe(100)
  })
})
