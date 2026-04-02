import type { Page } from '@playwright/test'

/**
 * Test fixture faction constants.
 * These match the data in e2e/fixtures/factions/.
 */
export const FACTIONS = {
  BASE_GAME: {
    id: 'TestBaseGame',
    name: 'Test Base Game',
    author: 'Test Author',
    description: 'A test base game faction for E2E testing',
    version: '1.0.0',
    unitCount: 5, // accessible units (6 total, 1 inaccessible)
    totalUnitCount: 6,
    inaccessibleCount: 1,
  },
  FACTION: {
    id: 'TestFaction',
    name: 'Test Faction',
    author: 'Test Mod Author',
    description: 'A test mod faction for E2E testing',
    version: '1.0.0',
    unitCount: 4,
    totalUnitCount: 4,
    inaccessibleCount: 0,
  },
  ADDON: {
    id: 'TestAddon',
    name: 'Test Addon',
    author: 'Test Addon Author',
    description: 'A test addon faction extending Test Base Game and Test Faction',
    version: '1.0.0',
    unitCount: 2,
    totalUnitCount: 2,
    inaccessibleCount: 0,
    baseFactions: ['Test Base Game', 'Test Faction'],
  },
} as const

export const ALL_FACTION_IDS = [FACTIONS.BASE_GAME.id, FACTIONS.FACTION.id, FACTIONS.ADDON.id]

/**
 * Known test units with their key properties for assertions.
 */
export const KNOWN_UNITS = {
  commander: {
    factionId: FACTIONS.BASE_GAME.id,
    id: 'test_commander',
    name: 'Test Commander',
    health: 12500,
    weaponCount: 3,
  },
  factory: {
    factionId: FACTIONS.BASE_GAME.id,
    id: 'test_air_factory',
    name: 'Test Air Factory',
    health: 6000,
    buildCost: 600,
    builds: ['test_fighter', 'test_tank', 'test_bot'],
  },
  tank: {
    factionId: FACTIONS.BASE_GAME.id,
    id: 'test_tank',
    name: 'Test Tank',
    health: 250,
    dps: 46.2,
    buildCost: 150,
  },
  bot: {
    factionId: FACTIONS.BASE_GAME.id,
    id: 'test_bot',
    name: 'Test Bot',
    health: 80,
    buildCost: 100,
  },
  fighter: {
    factionId: FACTIONS.BASE_GAME.id,
    id: 'test_fighter',
    name: 'Test Fighter',
    health: 120,
    buildCost: 220,
  },
  inaccessible: {
    factionId: FACTIONS.BASE_GAME.id,
    id: 'test_mine',
    name: 'Test Mine',
    accessible: false,
  },
  tfCommander: {
    factionId: FACTIONS.FACTION.id,
    id: 'tf_commander',
    name: 'Test Faction Commander',
  },
  tfHeavyTank: {
    factionId: FACTIONS.FACTION.id,
    id: 'tf_heavy_tank',
    name: 'Test Faction Heavy Tank',
    health: 500,
    buildCost: 350,
  },
} as const

/**
 * Wait for the faction detail page to finish loading units.
 * Waits for the unit count text (e.g. "5 units") to appear.
 */
export async function waitForFactionLoad(page: Page): Promise<void> {
  await page.getByText(/\d+ units/i).waitFor({ state: 'visible' })
}

/**
 * Wait for the unit detail page to finish loading.
 * Waits for the Overview section heading to appear.
 */
export async function waitForUnitLoad(page: Page): Promise<void> {
  await page.getByText('Overview').first().waitFor({ state: 'visible' })
}
