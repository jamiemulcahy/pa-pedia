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
  backgroundImage?: string;
  /** True if this is an addon mod that extends existing factions */
  isAddon?: boolean;
  /** Faction display names that this addon extends (e.g. MLA, Legion) */
  baseFactions?: string[];
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
  unit: Unit;
}

export interface FactionIndex {
  units: UnitIndexEntry[];
}

// Unit specifications (resolved data)
export interface Resources {
  metal?: number;
  energy?: number;
}

export interface Ammo {
  resourceName: string;
  safeName: string;
  name?: string;
  damage?: number;
  fullDamageRadius?: number;
  splashDamage?: number;
  splashRadius?: number;
  muzzleVelocity?: number;
  maxVelocity?: number;
  lifetime?: number;
  metalCost?: number;
  spawnUnitOnDeath?: string;
  spawnUnitOnDeathWithVelocity?: boolean;
}

export interface Weapon {
  resourceName: string;
  safeName: string;
  name?: string;
  count: number;
  rateOfFire: number;
  damage: number;
  dps: number;
  /** DPS when ammo-limited (recovery rate determines fire rate) */
  sustainedDps?: number;
  projectilesPerFire?: number;
  muzzleVelocity?: number;
  maxRange?: number;
  splashDamage?: number;
  splashRadius?: number;
  fullDamageRadius?: number;
  /** Weapon triggers on unit self-destruct command (e.g., boom bot) */
  selfDestruct?: boolean;
  /** Weapon triggers on unit death (e.g., commander nuke, titan explosions) */
  deathExplosion?: boolean;
  ammoSource?: string;
  ammoDemand?: number;
  ammoPerShot?: number;
  ammoCapacity?: number;
  ammoDrainTime?: number;
  ammoRechargeTime?: number;
  ammoShotsToDrain?: number;
  metalRate?: number;
  energyRate?: number;
  metalPerShot?: number;
  energyPerShot?: number;
  targetLayers?: string[];
  targetPriorities?: string[];
  yawRange?: number;
  yawRate?: number;
  pitchRange?: number;
  pitchRate?: number;
  ammoDetails?: Ammo;
}

export interface CombatSpecs {
  health: number;
  dps?: number;
  salvoDamage?: number;
  weapons?: Weapon[];
}

export interface BuildArm {
  resourceName: string;
  safeName: string;
  name?: string;
  count: number;
  metalConsumption: number;
  energyConsumption: number;
  range?: number;
}

export interface EconomySpecs {
  buildCost: number;
  production?: Resources;
  consumption?: Resources;
  storage?: Resources;
  toolConsumption?: Resources;
  weaponConsumption?: Resources;
  buildRate?: number;
  buildInefficiency?: number;
  metalRate?: number;
  energyRate?: number;
  buildArms?: BuildArm[];
  buildRange?: number;
}

export interface MobilitySpecs {
  moveSpeed?: number;
  turnSpeed?: number;
  acceleration?: number;
  brake?: number;
}

export interface ReconSpecs {
  visionRadius?: number;
  underwaterVisionRadius?: number;
  orbitalVisionRadius?: number;
  mineVisionRadius?: number;
  radarRadius?: number;
  sonarRadius?: number;
  orbitalRadarRadius?: number;
}

export interface StorageSpecs {
  unitStorage?: number;
  storedUnitType?: string;
}

export interface SpecialSpecs {
  spawnLayers?: string[];
  amphibious?: boolean;
  hover?: boolean;
  spawnUnitOnDeath?: string;
}

export interface UnitSpecs {
  combat: CombatSpecs;
  economy: EconomySpecs;
  mobility?: MobilitySpecs;
  recon?: ReconSpecs;
  storage?: StorageSpecs;
  special?: SpecialSpecs;
}

export interface BuildRelationships {
  builtBy?: string[];
  builds?: string[];
}

export interface Unit {
  id: string;
  resourceName: string;
  displayName: string;
  description?: string;
  image?: string;
  tier: number;
  unitTypes: string[];
  accessible: boolean;
  baseTemplate?: boolean;
  specs: UnitSpecs;
  buildRelationships?: BuildRelationships;
  buildableTypes?: string;
  assistBuildableOnly?: boolean;
}

// Extended types for app usage
export interface FactionWithFolder extends FactionMetadata {
  folderName: string;
  isLocal: boolean;
}
