import type { FactionMetadata, FactionIndex, Unit } from '@/types/faction'

/**
 * Mock faction metadata
 */
export const mockMLAMetadata: FactionMetadata = {
  identifier: 'mla',
  displayName: 'MLA',
  version: '1.0.0',
  author: 'Test Author',
  description: 'Machine Legion Army faction for testing',
  dateCreated: '2025-01-15',
  build: '123456',
  type: 'mod',
  mods: ['com.pa.mla']
}

export const mockLegionMetadata: FactionMetadata = {
  identifier: 'legion',
  displayName: 'Legion',
  version: '2.0.0',
  author: 'Legion Team',
  description: 'Legion Expansion faction for testing',
  dateCreated: '2025-01-10',
  build: '789012',
  type: 'mod',
  mods: ['com.pa.legion-expansion']
}

/**
 * Mock faction indexes
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
      resolvedFile: '/pa/units/land/tank/tank_resolved.json'
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
      resolvedFile: '/pa/units/land/bot/bot_resolved.json'
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
      resolvedFile: '/pa/units/air/fighter/fighter_resolved.json'
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
      resolvedFile: '/pa_ex1/units/land/tank/tank_resolved.json'
    }
  ]
}

/**
 * Mock resolved units
 */
export const mockTankUnit: Unit = {
  identifier: 'tank',
  displayName: 'Tank',
  description: 'Basic ground assault unit',
  unitTypes: ['Mobile', 'Land', 'Basic', 'Tank'],
  tier: 1,
  source: '/pa/units/land/tank/tank.json',
  accessible: true,
  specs: {
    combat: {
      health: 200,
      armor: 10,
      armorType: 'light'
    },
    economy: {
      buildCost: {
        metal: 150,
        energy: 0
      },
      buildTime: 12,
      consumption: {
        energy: 5
      }
    },
    mobility: {
      moveSpeed: 10,
      acceleration: 50,
      brakeRate: 50,
      turnSpeed: 120
    },
    recon: {
      visionRadius: 100
    }
  },
  weapons: [
    {
      identifier: 'main_weapon',
      displayName: 'Main Cannon',
      dps: 50,
      range: 100,
      rateOfFire: 1.0,
      damage: 50,
      damageType: 'standard',
      targetLayers: ['WL_LandHorizontal']
    }
  ],
  buildRelationships: {
    builtBy: ['vehicle_factory'],
    builds: []
  }
}

export const mockBotUnit: Unit = {
  identifier: 'bot',
  displayName: 'Bot',
  description: 'Basic infantry unit',
  unitTypes: ['Mobile', 'Land', 'Basic', 'Bot'],
  tier: 1,
  source: '/pa/units/land/bot/bot.json',
  accessible: true,
  specs: {
    combat: {
      health: 80,
      armorType: 'light'
    },
    economy: {
      buildCost: {
        metal: 45,
        energy: 0
      },
      buildTime: 6,
      consumption: {
        energy: 2
      }
    },
    mobility: {
      moveSpeed: 12,
      acceleration: 60,
      brakeRate: 60,
      turnSpeed: 180
    },
    recon: {
      visionRadius: 80
    }
  },
  weapons: [
    {
      identifier: 'rifle',
      displayName: 'Rifle',
      dps: 20,
      range: 80,
      rateOfFire: 2.0,
      damage: 10,
      damageType: 'standard',
      targetLayers: ['WL_LandHorizontal']
    }
  ],
  buildRelationships: {
    builtBy: ['bot_factory'],
    builds: []
  }
}

export const mockFighterUnit: Unit = {
  identifier: 'air_fighter',
  displayName: 'Fighter',
  description: 'Basic air superiority fighter',
  unitTypes: ['Mobile', 'Air', 'Basic', 'Fighter'],
  tier: 1,
  source: '/pa/units/air/fighter/fighter.json',
  accessible: true,
  specs: {
    combat: {
      health: 60
    },
    economy: {
      buildCost: {
        metal: 200,
        energy: 0
      },
      buildTime: 15,
      consumption: {
        energy: 10
      }
    },
    mobility: {
      moveSpeed: 100,
      acceleration: 100,
      brakeRate: 100,
      turnSpeed: 90
    },
    recon: {
      visionRadius: 150
    }
  },
  weapons: [
    {
      identifier: 'missiles',
      displayName: 'Air-to-Air Missiles',
      dps: 75,
      range: 120,
      rateOfFire: 0.5,
      damage: 150,
      damageType: 'explosive',
      targetLayers: ['WL_Air']
    }
  ],
  buildRelationships: {
    builtBy: ['air_factory'],
    builds: []
  }
}

export const mockLegionTankUnit: Unit = {
  identifier: 'legion_tank',
  displayName: 'Legion Tank',
  description: 'Advanced Legion assault tank',
  unitTypes: ['Mobile', 'Land', 'Advanced', 'Tank'],
  tier: 2,
  source: '/pa_ex1/units/land/tank/tank.json',
  accessible: true,
  specs: {
    combat: {
      health: 500,
      armor: 20,
      armorType: 'medium'
    },
    economy: {
      buildCost: {
        metal: 450,
        energy: 0
      },
      buildTime: 30,
      consumption: {
        energy: 15
      }
    },
    mobility: {
      moveSpeed: 8,
      acceleration: 40,
      brakeRate: 40,
      turnSpeed: 90
    },
    recon: {
      visionRadius: 120
    }
  },
  weapons: [
    {
      identifier: 'heavy_cannon',
      displayName: 'Heavy Cannon',
      dps: 125,
      range: 150,
      rateOfFire: 0.5,
      damage: 250,
      damageType: 'heavy',
      targetLayers: ['WL_LandHorizontal'],
      splash: {
        radius: 20,
        damage: 100,
        fullDamageRadius: 5
      }
    }
  ],
  buildRelationships: {
    builtBy: ['advanced_vehicle_factory'],
    builds: []
  }
}

/**
 * Factory function to create mock fetch responses
 */
export function createMockFetchResponse<T>(data: T, ok = true, status?: number): Response {
  const responseStatus = status ?? (ok ? 200 : 404)
  return {
    ok,
    status: responseStatus,
    statusText: ok ? 'OK' : 'Not Found',
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
 */
export function setupMockFetch() {
  global.fetch = vi.fn((url: string | URL | Request) => {
    const urlString = typeof url === 'string' ? url : url.toString()

    // Faction metadata
    if (urlString.includes('/factions/MLA/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockMLAMetadata))
    }
    if (urlString.includes('/factions/Legion/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockLegionMetadata))
    }

    // Faction indexes
    if (urlString.includes('/factions/MLA/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockMLAIndex))
    }
    if (urlString.includes('/factions/Legion/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockLegionIndex))
    }

    // Unit resolved files
    if (urlString.includes('/tank/tank_resolved.json')) {
      return Promise.resolve(createMockFetchResponse(mockTankUnit))
    }
    if (urlString.includes('/bot/bot_resolved.json')) {
      return Promise.resolve(createMockFetchResponse(mockBotUnit))
    }
    if (urlString.includes('/fighter/fighter_resolved.json')) {
      return Promise.resolve(createMockFetchResponse(mockFighterUnit))
    }
    if (urlString.includes('/legion_tank') || urlString.includes('Legion/units/legion_tank')) {
      return Promise.resolve(createMockFetchResponse(mockLegionTankUnit))
    }

    // Default 404
    return Promise.resolve(createMockFetchResponse(null, false))
  }) as unknown as typeof fetch
}
