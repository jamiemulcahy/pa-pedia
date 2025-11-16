/* Type definitions for PA-Pedia faction data */

// Faction Metadata
export interface FactionMetadata {
  identifier: string;
  displayName: string;
  version: string;
  author?: string;
  description?: string;
  dateCreated?: string;
  build?: string;
  type: 'base-game' | 'mod';
  mods?: string[];
}

// Faction Index
export interface UnitFile {
  path: string;
  source: string;
}

export interface UnitIndexEntry {
  identifier: string;
  displayName: string;
  unitTypes: string[];
  source: string;
  files: UnitFile[];
  resolvedFile?: string;
}

export interface FactionIndex {
  units: UnitIndexEntry[];
}

// Unit specifications (resolved data)
export interface Resources {
  metal?: number;
  energy?: number;
}

export interface CombatSpecs {
  health: number;
  armor?: number;
  armorType?: string;
}

export interface EconomySpecs {
  buildCost: Resources;
  buildTime: number;
  buildRate?: number;
  production?: Resources;
  consumption?: Resources;
  storage?: Resources;
  netProduction?: Resources;
}

export interface MobilitySpecs {
  moveSpeed?: number;
  acceleration?: number;
  brakeRate?: number;
  turnSpeed?: number;
  turnAcceleration?: number;
}

export interface ReconSpecs {
  visionRadius?: number;
  radarRadius?: number;
  sonarRadius?: number;
  observableDistance?: number;
}

export interface StorageSpecs {
  metal?: number;
  energy?: number;
}

export interface SpecialSpecs {
  hasNuke?: boolean;
  hasAntiNuke?: boolean;
  hasTeleporter?: boolean;
  isCommander?: boolean;
}

export interface UnitSpecs {
  combat: CombatSpecs;
  economy: EconomySpecs;
  mobility?: MobilitySpecs;
  recon?: ReconSpecs;
  storage?: StorageSpecs;
  special?: SpecialSpecs;
}

export interface Weapon {
  identifier: string;
  displayName?: string;
  dps?: number;
  range?: number;
  rateOfFire?: number;
  damage?: number;
  damageType?: string;
  targetLayers?: string[];
  maxVelocity?: number;
  splash?: {
    radius?: number;
    damage?: number;
    fullDamageRadius?: number;
  };
}

export interface BuildArm {
  identifier: string;
  buildRate: number;
}

export interface BuildRelationships {
  builtBy?: string[];
  builds?: string[];
}

export interface Unit {
  identifier: string;
  displayName: string;
  description?: string;
  unitTypes: string[];
  tier: number;
  source: string;
  accessible: boolean;
  specs: UnitSpecs;
  weapons?: Weapon[];
  tools?: BuildArm[];
  buildRelationships?: BuildRelationships;
}
