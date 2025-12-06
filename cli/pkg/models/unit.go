package models

// Resources represents metal and energy costs/production
type Resources struct {
	Metal  float64 `json:"metal,omitempty" jsonschema:"description=Metal resource amount"`
	Energy float64 `json:"energy,omitempty" jsonschema:"description=Energy resource amount"`
}

// Unit represents a complete game unit with all specifications
type Unit struct {
	// Core Identification
	ID           string   `json:"id" jsonschema:"required,description=Short identifier derived from resource name (e.g. 'tank')"`
	ResourceName string   `json:"resourceName" jsonschema:"required,description=Full PA resource path (e.g. '/pa/units/land/tank/tank.json')"`
	DisplayName  string   `json:"displayName" jsonschema:"required,description=Human-readable unit name (e.g. 'Ant')"`
	Description  string   `json:"description,omitempty" jsonschema:"description=Brief unit description or role"`
	Image        string   `json:"image,omitempty" jsonschema:"description=Relative path to unit icon (e.g. 'assets/pa/units/land/tank/tank_icon_buildbar.png')"`

	// Classification
	Tier            int      `json:"tier" jsonschema:"required,minimum=1,maximum=3,description=Unit tier (1=Basic 2=Advanced 3=Titan)"`
	UnitTypes       []string `json:"unitTypes,omitempty" jsonschema:"description=Unit type tags (e.g. ['Mobile' 'Tank' 'Land' 'Basic'])"`
	Accessible      bool     `json:"accessible" jsonschema:"required,description=Whether unit is buildable from commander (excludes test/tutorial units)"`
	BaseTemplate    bool     `json:"baseTemplate,omitempty" jsonschema:"description=Whether this is a base template file (not a real unit)"`

	// Specifications (organized into logical groups)
	Specs UnitSpecs `json:"specs" jsonschema:"required,description=Detailed unit specifications organized by category"`

	// Build Relationships
	BuildRelationships BuildRelationships `json:"buildRelationships,omitempty" jsonschema:"description=What this unit builds and what builds this unit"`

	// Build Restrictions (for factories/constructors)
	BuildableTypes  string `json:"buildableTypes,omitempty" jsonschema:"description=Build restriction grammar (e.g. 'Mobile & Basic')"`
	AssistBuildOnly *bool  `json:"assistBuildableOnly,omitempty" jsonschema:"description=Whether unit can only assist (not start) builds"`
}

// UnitSpecs organizes unit specifications into logical categories
type UnitSpecs struct {
	Combat   *CombatSpecs   `json:"combat,omitempty" jsonschema:"description=Combat-related specifications (health weapons damage)"`
	Economy  *EconomySpecs  `json:"economy,omitempty" jsonschema:"description=Economic specifications (costs production consumption)"`
	Mobility *MobilitySpecs `json:"mobility,omitempty" jsonschema:"description=Movement and positioning specifications"`
	Recon    *ReconSpecs    `json:"recon,omitempty" jsonschema:"description=Vision and detection specifications"`
	Storage  *StorageSpecs  `json:"storage,omitempty" jsonschema:"description=Unit transport and storage capabilities"`
	Special  *SpecialSpecs  `json:"special,omitempty" jsonschema:"description=Special attributes (amphibious hover spawn layers)"`
}

// CombatSpecs contains combat-related specifications
type CombatSpecs struct {
	Health      float64  `json:"health" jsonschema:"required,description=Maximum hit points"`
	DPS         float64  `json:"dps,omitempty" jsonschema:"description=Total damage per second from all weapons"`
	SalvoDamage float64  `json:"salvoDamage,omitempty" jsonschema:"description=Total damage in a single volley"`
	Weapons     []Weapon `json:"weapons,omitempty" jsonschema:"description=Individual weapon systems"`
}

// EconomySpecs contains economic specifications
type EconomySpecs struct {
	BuildCost         float64   `json:"buildCost" jsonschema:"required,description=Total metal cost to build unit"`
	Production        Resources `json:"production,omitempty" jsonschema:"description=Resources produced per second"`
	Consumption       Resources `json:"consumption,omitempty" jsonschema:"description=Base resource consumption per second"`
	Storage           Resources `json:"storage,omitempty" jsonschema:"description=Resource storage capacity"`
	ToolConsumption   Resources `json:"toolConsumption,omitempty" jsonschema:"description=Resource consumption from build arms"`
	WeaponConsumption Resources `json:"weaponConsumption,omitempty" jsonschema:"description=Resource consumption from weapons"`
	BuildRate         float64   `json:"buildRate,omitempty" jsonschema:"description=Construction speed multiplier"`
	BuildInefficiency float64   `json:"buildInefficiency,omitempty" jsonschema:"description=Resource efficiency penalty when building"`
	MetalRate         float64   `json:"metalRate,omitempty" jsonschema:"description=Net metal production/consumption per second"`
	EnergyRate        float64   `json:"energyRate,omitempty" jsonschema:"description=Net energy production/consumption per second"`
	BuildArms         []BuildArm `json:"buildArms,omitempty" jsonschema:"description=Construction tools"`
	BuildRange        float64   `json:"buildRange,omitempty" jsonschema:"description=Maximum construction range"`
}

// MobilitySpecs contains movement specifications
type MobilitySpecs struct {
	MoveSpeed    float64 `json:"moveSpeed,omitempty" jsonschema:"description=Maximum movement speed in units/second"`
	TurnSpeed    float64 `json:"turnSpeed,omitempty" jsonschema:"description=Rotation speed in degrees/second"`
	Acceleration float64 `json:"acceleration,omitempty" jsonschema:"description=Acceleration rate"`
	Brake        float64 `json:"brake,omitempty" jsonschema:"description=Deceleration/braking rate"`
}

// ReconSpecs contains vision and detection specifications
type ReconSpecs struct {
	VisionRadius           float64 `json:"visionRadius,omitempty" jsonschema:"description=Surface vision range"`
	UnderwaterVisionRadius float64 `json:"underwaterVisionRadius,omitempty" jsonschema:"description=Underwater vision range"`
	OrbitalVisionRadius    float64 `json:"orbitalVisionRadius,omitempty" jsonschema:"description=Orbital layer vision range"`
	MineVisionRadius       float64 `json:"mineVisionRadius,omitempty" jsonschema:"description=Mine detection range"`
	RadarRadius            float64 `json:"radarRadius,omitempty" jsonschema:"description=Radar detection range"`
	SonarRadius            float64 `json:"sonarRadius,omitempty" jsonschema:"description=Sonar detection range"`
	OrbitalRadarRadius     float64 `json:"orbitalRadarRadius,omitempty" jsonschema:"description=Orbital radar range"`
}

// StorageSpecs contains unit storage/transport specifications
type StorageSpecs struct {
	UnitStorage    int    `json:"unitStorage,omitempty" jsonschema:"description=Number of units that can be stored"`
	StoredUnitType string `json:"storedUnitType,omitempty" jsonschema:"description=Type restriction for stored units"`
}

// SpecialSpecs contains special attributes
type SpecialSpecs struct {
	SpawnLayers      []string `json:"spawnLayers,omitempty" jsonschema:"description=Valid spawn/movement layers (e.g. ['WL_LandHorizontal' 'WL_Water'])"`
	Amphibious       bool     `json:"amphibious,omitempty" jsonschema:"description=Can traverse both land and water"`
	Hover            bool     `json:"hover,omitempty" jsonschema:"description=Hovers above ground"`
	SpawnUnitOnDeath string   `json:"spawnUnitOnDeath,omitempty" jsonschema:"description=PA resource path of unit spawned when this unit dies"`
}

// BuildRelationships defines build tree connections
type BuildRelationships struct {
	Builds  []string `json:"builds,omitempty" jsonschema:"description=List of unit IDs this unit can build"`
	BuiltBy []string `json:"builtBy,omitempty" jsonschema:"description=List of unit IDs that can build this unit"`
}
