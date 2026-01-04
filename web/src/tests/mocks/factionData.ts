import { vi, type Mock } from 'vitest'
import type { FactionIndex, Unit } from '@/types/faction'
import type { FactionMetadataWithLocal } from '@/services/factionLoader'

/**
 * Type for mocked fetch function
 */
export type MockFetch = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

/**
 * Type for fetch call arguments
 */
export type FetchCallArgs = [input: RequestInfo | URL, init?: RequestInit]

/**
 * Mock faction metadata
 */
export const mockMLAMetadata: FactionMetadataWithLocal = {
  identifier: 'mla',
  displayName: 'MLA',
  version: '1.0.0',
  author: 'Test Author',
  description: 'Machine Legion Army faction for testing',
  dateCreated: '2025-01-15',
  build: '123456',
  type: 'mod',
  mods: ['com.pa.mla'],
  isLocal: false,
  folderName: 'MLA'
}

export const mockLegionMetadata: FactionMetadataWithLocal = {
  identifier: 'legion',
  displayName: 'Legion',
  version: '2.0.0',
  author: 'Legion Team',
  description: 'Legion Expansion faction for testing',
  dateCreated: '2025-01-10',
  build: '789012',
  type: 'mod',
  mods: ['com.pa.legion-expansion'],
  isLocal: false,
  folderName: 'Legion'
}

export const mockBugsMetadata: FactionMetadataWithLocal = {
  identifier: 'bugs',
  displayName: 'Bugs',
  version: '3.0.0',
  author: 'Bugs Team',
  description: 'Bugs faction for testing',
  dateCreated: '2025-01-20',
  build: '345678',
  type: 'mod',
  mods: ['com.pa.bugs'],
  isLocal: false,
  folderName: 'Bugs'
}

export const mockExilesMetadata: FactionMetadataWithLocal = {
  identifier: 'exiles',
  displayName: 'Exiles',
  version: '1.0.0',
  author: 'Nik',
  description: 'Exiles faction for testing',
  dateCreated: '2025-01-25',
  build: '456789',
  type: 'mod',
  mods: ['com.pa.nik.exiles'],
  isLocal: false,
  folderName: 'Exiles'
}

export const mockSecondWaveMetadata: FactionMetadataWithLocal = {
  identifier: 'second-wave',
  displayName: 'Second Wave',
  version: '0.14.5',
  author: 'Second Wave Team',
  description: 'Addon units for MLA, Legion, and Bugs',
  dateCreated: '2025-01-30',
  build: '124616',
  type: 'mod',
  mods: ['pa.mla.unit.addon', 'pa.mla.unit.addon.companion'],
  isLocal: false,
  isAddon: true,
  baseFactions: ['Bugs', 'Legion', 'MLA'],
  folderName: 'Second-Wave'
}

/**
 * Mock resolved units (defined before index since index references them)
 */
export const mockTankUnit: Unit = {
  id: 'tank',
  resourceName: '/pa/units/land/tank/tank.json',
  displayName: 'Tank',
  description: 'Basic ground assault unit',
  image: 'assets/pa/units/land/tank/tank_icon_buildbar.png',
  unitTypes: ['Mobile', 'Land', 'Basic', 'Tank'],
  tier: 1,
  accessible: true,
  specs: {
    combat: {
      health: 200,
      weapons: [
        {
          resourceName: '/pa/units/land/tank/tank_weapon.json',
          safeName: 'main_weapon',
          name: 'Main Cannon',
          count: 1,
          rateOfFire: 1.0,
          damage: 50,
          dps: 50,
          maxRange: 100,
          targetLayers: ['WL_LandHorizontal']
        }
      ]
    },
    economy: {
      buildCost: 150,
      consumption: {
        energy: 5
      }
    },
    mobility: {
      moveSpeed: 10,
      acceleration: 50,
      brake: 50,
      turnSpeed: 120
    },
    recon: {
      visionRadius: 100
    }
  },
  buildRelationships: {
    builtBy: ['vehicle_factory'],
    builds: []
  }
}

export const mockBotUnit: Unit = {
  id: 'bot',
  resourceName: '/pa/units/land/bot/bot.json',
  displayName: 'Bot',
  description: 'Basic infantry unit',
  image: 'assets/pa/units/land/bot/bot_icon_buildbar.png',
  unitTypes: ['Mobile', 'Land', 'Basic', 'Bot'],
  tier: 1,
  accessible: true,
  specs: {
    combat: {
      health: 80,
      weapons: [
        {
          resourceName: '/pa/units/land/bot/bot_weapon.json',
          safeName: 'rifle',
          name: 'Rifle',
          count: 1,
          rateOfFire: 2.0,
          damage: 10,
          dps: 20,
          maxRange: 80,
          targetLayers: ['WL_LandHorizontal']
        }
      ]
    },
    economy: {
      buildCost: 45,
      consumption: {
        energy: 2
      }
    },
    mobility: {
      moveSpeed: 12,
      acceleration: 60,
      brake: 60,
      turnSpeed: 180
    },
    recon: {
      visionRadius: 80
    }
  },
  buildRelationships: {
    builtBy: ['bot_factory'],
    builds: []
  }
}

export const mockFighterUnit: Unit = {
  id: 'air_fighter',
  resourceName: '/pa/units/air/fighter/fighter.json',
  displayName: 'Fighter',
  description: 'Basic air superiority fighter',
  image: 'assets/pa/units/air/fighter/air_fighter_icon_buildbar.png',
  unitTypes: ['Mobile', 'Air', 'Basic', 'Fighter'],
  tier: 1,
  accessible: true,
  specs: {
    combat: {
      health: 60,
      weapons: [
        {
          resourceName: '/pa/units/air/fighter/fighter_weapon.json',
          safeName: 'missiles',
          name: 'Air-to-Air Missiles',
          count: 1,
          rateOfFire: 0.5,
          damage: 150,
          dps: 75,
          maxRange: 120,
          targetLayers: ['WL_Air']
        }
      ]
    },
    economy: {
      buildCost: 200,
      consumption: {
        energy: 10
      }
    },
    mobility: {
      moveSpeed: 100,
      acceleration: 100,
      brake: 100,
      turnSpeed: 90
    },
    recon: {
      visionRadius: 150
    }
  },
  buildRelationships: {
    builtBy: ['air_factory'],
    builds: []
  }
}

export const mockVehicleFactoryUnit: Unit = {
  id: 'vehicle_factory',
  resourceName: '/pa/units/land/vehicle_factory/vehicle_factory.json',
  displayName: 'Vehicle Factory',
  description: 'Produces ground vehicles',
  image: 'assets/pa/units/land/vehicle_factory/vehicle_factory_icon_buildbar.png',
  unitTypes: ['Structure', 'Land', 'Basic', 'Factory'],
  tier: 1,
  accessible: true,
  specs: {
    combat: {
      health: 5000
    },
    economy: {
      buildCost: 600,
      buildRate: 15
    },
    recon: {
      visionRadius: 100
    }
  },
  buildRelationships: {
    builtBy: ['commander'],
    builds: ['tank', 'bot']
  }
}

export const mockSeaMineUnit: Unit = {
  id: 'sea_mine',
  resourceName: '/pa/units/sea/sea_mine/sea_mine.json',
  displayName: 'Sea Mine',
  description: 'Naval mine - inaccessible test unit',
  image: 'assets/pa/units/sea/sea_mine/sea_mine_icon_buildbar.png',
  unitTypes: ['Structure', 'Naval', 'Basic', 'Defense'],
  tier: 1,
  accessible: false,
  specs: {
    combat: {
      health: 50,
      weapons: [
        {
          resourceName: '/pa/units/sea/sea_mine/sea_mine_weapon.json',
          safeName: 'detonation',
          name: 'Detonation',
          count: 1,
          rateOfFire: 1.0,
          damage: 500,
          dps: 500,
          maxRange: 10,
          targetLayers: ['WL_WaterSurface']
        }
      ]
    },
    economy: {
      buildCost: 300
    },
    recon: {
      visionRadius: 1
    }
  },
  buildRelationships: {
    builtBy: ['fabrication_ship'],
    builds: []
  }
}

export const mockLegionTankUnit: Unit = {
  id: 'legion_tank',
  resourceName: '/pa_ex1/units/land/tank/tank.json',
  displayName: 'Legion Tank',
  description: 'Advanced Legion assault tank',
  image: 'assets/pa_ex1/units/land/tank/legion_tank_icon_buildbar.png',
  unitTypes: ['Mobile', 'Land', 'Advanced', 'Tank'],
  tier: 2,
  accessible: true,
  specs: {
    combat: {
      health: 500,
      weapons: [
        {
          resourceName: '/pa_ex1/units/land/tank/tank_weapon.json',
          safeName: 'heavy_cannon',
          name: 'Heavy Cannon',
          count: 1,
          rateOfFire: 0.5,
          damage: 250,
          dps: 125,
          maxRange: 150,
          splashDamage: 100,
          splashRadius: 20,
          fullDamageRadius: 5,
          targetLayers: ['WL_LandHorizontal']
        }
      ]
    },
    economy: {
      buildCost: 450,
      consumption: {
        energy: 15
      }
    },
    mobility: {
      moveSpeed: 8,
      acceleration: 40,
      brake: 40,
      turnSpeed: 90
    },
    recon: {
      visionRadius: 120
    }
  },
  buildRelationships: {
    builtBy: ['advanced_vehicle_factory'],
    builds: []
  }
}

/**
 * Mock faction indexes (now embedding unit objects)
 */
export const mockMLAIndex: FactionIndex = {
  units: [
    {
      identifier: 'tank',
      displayName: 'Tank',
      unitTypes: ['Mobile', 'Land', 'Basic', 'Tank'],
      source: '/pa/units/land/tank/tank.json',
      files: [
        {
          path: '/pa/units/land/tank/tank.json',
          source: 'pa'
        },
        {
          path: '/pa/units/land/tank/tank_icon_buildbar.png',
          source: 'pa'
        }
      ],
      unit: mockTankUnit
    },
    {
      identifier: 'bot',
      displayName: 'Bot',
      unitTypes: ['Mobile', 'Land', 'Basic', 'Bot'],
      source: '/pa/units/land/bot/bot.json',
      files: [
        {
          path: '/pa/units/land/bot/bot.json',
          source: 'pa'
        }
      ],
      unit: mockBotUnit
    },
    {
      identifier: 'air_fighter',
      displayName: 'Fighter',
      unitTypes: ['Mobile', 'Air', 'Basic', 'Fighter'],
      source: '/pa/units/air/fighter/fighter.json',
      files: [
        {
          path: '/pa/units/air/fighter/fighter.json',
          source: 'pa'
        }
      ],
      unit: mockFighterUnit
    },
    {
      identifier: 'vehicle_factory',
      displayName: 'Vehicle Factory',
      unitTypes: ['Structure', 'Land', 'Basic', 'Factory'],
      source: '/pa/units/land/vehicle_factory/vehicle_factory.json',
      files: [
        {
          path: '/pa/units/land/vehicle_factory/vehicle_factory.json',
          source: 'pa'
        }
      ],
      unit: mockVehicleFactoryUnit
    },
    {
      identifier: 'sea_mine',
      displayName: 'Sea Mine',
      unitTypes: ['Structure', 'Naval', 'Basic', 'Defense'],
      source: '/pa/units/sea/sea_mine/sea_mine.json',
      files: [
        {
          path: '/pa/units/sea/sea_mine/sea_mine.json',
          source: 'pa'
        }
      ],
      unit: mockSeaMineUnit
    }
  ]
}

export const mockLegionIndex: FactionIndex = {
  units: [
    {
      identifier: 'legion_tank',
      displayName: 'Legion Tank',
      unitTypes: ['Mobile', 'Land', 'Advanced', 'Tank'],
      source: '/pa_ex1/units/land/tank/tank.json',
      files: [
        {
          path: '/pa_ex1/units/land/tank/tank.json',
          source: 'pa_ex1'
        }
      ],
      unit: mockLegionTankUnit
    }
  ]
}

export const mockBugsUnit: Unit = {
  id: 'bug_warrior',
  resourceName: '/pa/units/bugs/warrior/warrior.json',
  displayName: 'Bug Warrior',
  description: 'Basic bugs assault unit',
  image: 'assets/pa/units/bugs/warrior/bug_warrior_icon_buildbar.png',
  unitTypes: ['Mobile', 'Land', 'Basic', 'Bot'],
  tier: 1,
  accessible: true,
  specs: {
    combat: {
      health: 150,
      weapons: [
        {
          resourceName: '/pa/units/bugs/warrior/warrior_weapon.json',
          safeName: 'claws',
          name: 'Claws',
          count: 1,
          rateOfFire: 2.0,
          damage: 30,
          dps: 60,
          maxRange: 20,
          targetLayers: ['WL_LandHorizontal']
        }
      ]
    },
    economy: {
      buildCost: 100,
      consumption: {
        energy: 3
      }
    },
    mobility: {
      moveSpeed: 15,
      acceleration: 80,
      brake: 80,
      turnSpeed: 200
    },
    recon: {
      visionRadius: 80
    }
  },
  buildRelationships: {
    builtBy: ['bug_hive'],
    builds: []
  }
}

export const mockBugsIndex: FactionIndex = {
  units: [
    {
      identifier: 'bug_warrior',
      displayName: 'Bug Warrior',
      unitTypes: ['Mobile', 'Land', 'Basic', 'Bot'],
      source: '/pa/units/bugs/warrior/warrior.json',
      files: [
        {
          path: '/pa/units/bugs/warrior/warrior.json',
          source: 'pa'
        }
      ],
      unit: mockBugsUnit
    }
  ]
}

export const mockExilesIndex: FactionIndex = {
  units: [
    {
      identifier: 'exile_tank',
      displayName: 'Exile Tank',
      unitTypes: ['Mobile', 'Land', 'Basic', 'Tank'],
      source: '/pa/units/exiles/tank/tank.json',
      files: [
        {
          path: '/pa/units/exiles/tank/tank.json',
          source: 'mod'
        }
      ],
      unit: mockTankUnit
    }
  ]
}

export const mockSecondWaveIndex: FactionIndex = {
  units: [
    {
      identifier: 'addon_tank',
      displayName: 'Addon Tank',
      unitTypes: ['Mobile', 'Land', 'Basic', 'Tank'],
      source: '/pa/units/addon/tank/tank.json',
      files: [
        {
          path: '/pa/units/addon/tank/tank.json',
          source: 'pa.mla.unit.addon'
        }
      ],
      unit: mockTankUnit
    }
  ]
}

/**
 * Factory function to create mock fetch responses
 */
export function createMockFetchResponse<T>(data: T, ok = true, status?: number): Response {
  const responseStatus = status ?? (ok ? 200 : 404)
  // Map common status codes to their text
  const statusTextMap: Record<number, string> = {
    200: 'OK',
    404: 'Not Found',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  }
  const statusText = statusTextMap[responseStatus] ?? (ok ? 'OK' : 'Error')
  return {
    ok,
    status: responseStatus,
    statusText,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    type: 'basic',
    url: '',
    clone: function() { return this },
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData()
  } as Response
}

/**
 * Setup mock fetch for all faction data
 * Handles both relative and absolute URLs (including localhost from test setup)
 */
export function setupMockFetch() {
  const mockFn = vi.fn((url: string | URL | Request) => {
    // Handle URL objects and Request objects, extracting pathname for matching
    let urlString: string
    if (typeof url === 'string') {
      // Handle absolute URLs (including localhost from test setup)
      if (url.startsWith('http://localhost')) {
        urlString = url.replace('http://localhost', '')
      } else {
        urlString = url
      }
    } else if (url instanceof URL) {
      urlString = url.pathname + url.search
    } else if (url instanceof Request) {
      try {
        const reqUrl = new URL(url.url)
        urlString = reqUrl.pathname + reqUrl.search
      } catch {
        urlString = url.url
      }
    } else {
      urlString = String(url)
    }

    // Faction metadata
    if (urlString.includes('/factions/MLA/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockMLAMetadata))
    }
    if (urlString.includes('/factions/Legion/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockLegionMetadata))
    }
    if (urlString.includes('/factions/Bugs/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockBugsMetadata))
    }
    if (urlString.includes('/factions/Exiles/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockExilesMetadata))
    }
    if (urlString.includes('/factions/Second-Wave/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockSecondWaveMetadata))
    }

    // Faction indexes (now include embedded units, no need for separate resolved files)
    if (urlString.includes('/factions/MLA/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockMLAIndex))
    }
    if (urlString.includes('/factions/Legion/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockLegionIndex))
    }
    if (urlString.includes('/factions/Bugs/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockBugsIndex))
    }
    if (urlString.includes('/factions/Exiles/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockExilesIndex))
    }
    if (urlString.includes('/factions/Second-Wave/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockSecondWaveIndex))
    }

    // Default: return generic JSON for asset requests
    if (urlString.includes('/factions/') && urlString.includes('/assets/')) {
      return Promise.resolve(createMockFetchResponse({ default: 'asset' }))
    }

    // Default 404
    return Promise.resolve(createMockFetchResponse(null, false))
  }) as unknown as typeof fetch

  global.fetch = mockFn
  return mockFn
}
