package models

// Weapon represents a damage-dealing tool on a unit
type Weapon struct {
	// Identification
	ResourceName string `json:"resourceName" jsonschema:"required,description=Full PA resource path to weapon JSON"`
	SafeName     string `json:"safeName" jsonschema:"required,description=Short identifier for weapon"`
	Name         string `json:"name,omitempty" jsonschema:"description=Human-readable weapon name"`
	Count        int    `json:"count" jsonschema:"required,minimum=1,description=Number of identical weapons on unit"`

	// Damage and Rate of Fire
	ROF                float64 `json:"rateOfFire" jsonschema:"required,description=Shots per second"`
	Damage             float64 `json:"damage" jsonschema:"required,description=Direct damage per projectile"`
	DPS                float64 `json:"dps" jsonschema:"required,description=Total damage per second (includes count ROF and projectiles)"`
	ProjectilesPerFire int     `json:"projectilesPerFire,omitempty" jsonschema:"description=Number of projectiles per shot (e.g. shotgun)"`

	// Projectile Characteristics
	MuzzleVelocity float64 `json:"muzzleVelocity,omitempty" jsonschema:"description=Initial projectile velocity"`
	MaxRange       float64 `json:"maxRange,omitempty" jsonschema:"description=Maximum effective range"`

	// Area Damage
	SplashDamage     float64 `json:"splashDamage,omitempty" jsonschema:"description=Splash/AoE damage"`
	SplashRadius     float64 `json:"splashRadius,omitempty" jsonschema:"description=Splash damage radius"`
	FullDamageRadius float64 `json:"fullDamageRadius,omitempty" jsonschema:"description=Radius where full splash damage applies"`

	// Special Flags
	SelfDestruct   bool `json:"selfDestruct,omitempty" jsonschema:"description=Weapon triggers on unit self-destruct"`
	DeathExplosion bool `json:"deathExplosion,omitempty" jsonschema:"description=Weapon triggers on unit death"`

	// Ammo System
	AmmoSource       string  `json:"ammoSource,omitempty" jsonschema:"description=Resource type used for ammo (e.g. 'energy')"`
	AmmoDemand       float64 `json:"ammoDemand,omitempty" jsonschema:"description=Rate of ammo consumption"`
	AmmoPerShot      float64 `json:"ammoPerShot,omitempty" jsonschema:"description=Ammo consumed per shot"`
	AmmoCapacity     float64 `json:"ammoCapacity,omitempty" jsonschema:"description=Maximum ammo storage"`
	AmmoDrainTime    float64 `json:"ammoDrainTime,omitempty" jsonschema:"description=Time to drain full ammo capacity"`
	AmmoRechargeTime float64 `json:"ammoRechargeTime,omitempty" jsonschema:"description=Time to fully recharge ammo"`
	AmmoShotsToDrain int     `json:"ammoShotsToDrain,omitempty" jsonschema:"description=Number of shots before ammo depletes"`

	// Resource Consumption
	MetalRate     float64 `json:"metalRate,omitempty" jsonschema:"description=Metal consumption per second when firing"`
	EnergyRate    float64 `json:"energyRate,omitempty" jsonschema:"description=Energy consumption per second when firing"`
	MetalPerShot  float64 `json:"metalPerShot,omitempty" jsonschema:"description=Metal consumed per shot"`
	EnergyPerShot float64 `json:"energyPerShot,omitempty" jsonschema:"description=Energy consumed per shot"`

	// Targeting
	TargetLayers     []string `json:"targetLayers,omitempty" jsonschema:"description=Valid target layers (e.g. ['WL_LandHorizontal' 'WL_Air'])"`
	TargetPriorities []string `json:"targetPriorities,omitempty" jsonschema:"description=Target priority order using unit type grammar (e.g. ['Mobile - Air' 'Structure'])"`
	YawRange         float64  `json:"yawRange,omitempty" jsonschema:"description=Horizontal aiming range in degrees"`
	YawRate      float64  `json:"yawRate,omitempty" jsonschema:"description=Horizontal aiming speed in degrees/second"`
	PitchRange   float64  `json:"pitchRange,omitempty" jsonschema:"description=Vertical aiming range in degrees"`
	PitchRate    float64  `json:"pitchRate,omitempty" jsonschema:"description=Vertical aiming speed in degrees/second"`

	// Nested Ammo Details
	Ammo *Ammo `json:"ammoDetails,omitempty" jsonschema:"description=Detailed projectile specifications"`
}

// Ammo represents detailed projectile specifications
type Ammo struct {
	ResourceName                 string  `json:"resourceName" jsonschema:"required,description=Full PA resource path to ammo JSON"`
	SafeName                     string  `json:"safeName" jsonschema:"required,description=Short identifier for ammo"`
	Name                         string  `json:"name,omitempty" jsonschema:"description=Human-readable ammo name"`
	Damage                       float64 `json:"damage,omitempty" jsonschema:"description=Direct hit damage"`
	FullDamageRadius             float64 `json:"fullDamageRadius,omitempty" jsonschema:"description=Radius where full damage applies"`
	SplashDamage                 float64 `json:"splashDamage,omitempty" jsonschema:"description=Area of effect damage"`
	SplashRadius                 float64 `json:"splashRadius,omitempty" jsonschema:"description=Splash damage radius"`
	MuzzleVelocity               float64 `json:"muzzleVelocity,omitempty" jsonschema:"description=Initial velocity"`
	MaxVelocity                  float64 `json:"maxVelocity,omitempty" jsonschema:"description=Maximum velocity (for guided projectiles)"`
	Lifetime                     float64 `json:"lifetime,omitempty" jsonschema:"description=Projectile lifetime in seconds"`
	MetalCost                    float64 `json:"metalCost,omitempty" jsonschema:"description=Metal cost per projectile"`
	SpawnUnitOnDeath             string  `json:"spawnUnitOnDeath,omitempty" jsonschema:"description=PA resource path of unit spawned when projectile ends"`
	SpawnUnitOnDeathWithVelocity bool    `json:"spawnUnitOnDeathWithVelocity,omitempty" jsonschema:"description=Whether spawned unit inherits projectile velocity"`
}

// BuildArm represents a construction tool
type BuildArm struct {
	ResourceName      string  `json:"resourceName" jsonschema:"required,description=Full PA resource path to build arm JSON"`
	SafeName          string  `json:"safeName" jsonschema:"required,description=Short identifier for build arm"`
	Name              string  `json:"name,omitempty" jsonschema:"description=Human-readable build arm name"`
	Count             int     `json:"count" jsonschema:"required,minimum=1,description=Number of identical build arms on unit"`
	MetalConsumption  float64 `json:"metalConsumption" jsonschema:"required,description=Metal consumed per second while building"`
	EnergyConsumption float64 `json:"energyConsumption" jsonschema:"required,description=Energy consumed per second while building"`
	Range             float64 `json:"range,omitempty" jsonschema:"description=Maximum construction range"`
}
