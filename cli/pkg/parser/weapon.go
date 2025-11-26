package parser

import (
	"math"
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// ParseWeapon parses weapon specifications from JSON
func ParseWeapon(l *loader.Loader, resourceName string, baseWeapon *models.Weapon) (*models.Weapon, error) {
	data, err := l.GetJSON(resourceName)
	if err != nil {
		return nil, err
	}

	weapon := &models.Weapon{
		ResourceName:       resourceName,
		SafeName:           l.GetSafeName(resourceName),
		Count:              1,
		ProjectilesPerFire: 1,
	}

	// Handle base_spec inheritance
	if baseSpec, ok := data["base_spec"].(string); ok && baseWeapon == nil {
		baseWeapon, _ = ParseWeapon(l, baseSpec, nil)
		if baseWeapon != nil {
			*weapon = *baseWeapon
			weapon.ResourceName = resourceName
			weapon.SafeName = l.GetSafeName(resourceName)
		}
	} else if baseWeapon != nil {
		*weapon = *baseWeapon
		weapon.ResourceName = resourceName
		weapon.SafeName = l.GetSafeName(resourceName)
	}

	weapon.Name = weapon.SafeName
	weapon.ROF = loader.GetFloat(data, "rate_of_fire", weapon.ROF)
	weapon.MaxRange = loader.GetFloat(data, "max_range", weapon.MaxRange)

	// Parse ammo
	var ammoID string
	if ammoIDInterface, ok := data["ammo_id"]; ok {
		// Handle both string and array formats
		switch v := ammoIDInterface.(type) {
		case string:
			ammoID = v
		case []interface{}:
			if len(v) > 0 {
				if idMap, ok := v[0].(map[string]interface{}); ok {
					if id, ok := idMap["id"].(string); ok {
						ammoID = id
					}
				}
			}
		}
	}

	// For death explosions, ammo might be embedded
	if ammoID == "" {
		if _, hasAmmoType := data["ammo_type"]; hasAmmoType {
			ammoID = resourceName
		}
	}

	if ammoID != "" {
		ammo, err := ParseAmmo(l, ammoID, nil)
		if err == nil {
			weapon.Ammo = ammo
			weapon.Damage = ammo.Damage
			weapon.MuzzleVelocity = ammo.MuzzleVelocity
			weapon.SplashDamage = ammo.SplashDamage
			weapon.SplashRadius = ammo.SplashRadius
			weapon.FullDamageRadius = ammo.FullDamageRadius
		}
	}

	// Parse ammo source
	if ammoSource, ok := data["ammo_source"].(string); ok {
		weapon.AmmoSource = ammoSource
		// Reset resource costs if ammo source is set
		weapon.EnergyRate = 0
		weapon.EnergyPerShot = 0
		weapon.MetalRate = 0
		weapon.MetalPerShot = 0
	}

	if weapon.AmmoSource != "" {
		weapon.AmmoDemand = loader.GetFloat(data, "ammo_demand", weapon.AmmoDemand)
		weapon.AmmoCapacity = loader.GetFloat(data, "ammo_capacity", weapon.AmmoCapacity)
		weapon.AmmoPerShot = loader.GetFloat(data, "ammo_per_shot", weapon.AmmoPerShot)

		if weapon.AmmoSource == "time" {
			weapon.AmmoDemand = 1
		}

		// Calculate recharge time
		if weapon.AmmoDemand > 0 {
			weapon.AmmoRechargeTime = weapon.AmmoCapacity / weapon.AmmoDemand
		}

		// Check if ROF is limited by ammo
		if weapon.AmmoCapacity == weapon.AmmoPerShot && weapon.AmmoRechargeTime > 0 {
			if weapon.ROF > 0 && (1.0/weapon.AmmoRechargeTime) < weapon.ROF {
				weapon.ROF = 1.0 / weapon.AmmoRechargeTime
			}
		}

		// Calculate drain time
		rate := math.Round(weapon.AmmoPerShot*weapon.ROF*100) / 100
		if weapon.AmmoDemand > 0 && rate > weapon.AmmoDemand {
			t := math.Round(weapon.AmmoCapacity/(rate-weapon.AmmoDemand)*100) / 100
			weapon.AmmoShotsToDrain = int(weapon.ROF * t)
			weapon.AmmoDrainTime = math.Round(float64(weapon.AmmoShotsToDrain)/weapon.ROF*100) / 100
		}

		// Calculate resource consumption
		consumptionRate := weapon.AmmoDemand
		if rate < weapon.AmmoDemand {
			consumptionRate = rate
		}
		consumptionRate = math.Round(consumptionRate*100) / 100

		switch weapon.AmmoSource {
		case "energy":
			weapon.EnergyRate = -consumptionRate
			weapon.EnergyPerShot = weapon.AmmoPerShot
		case "metal":
			weapon.MetalRate = -consumptionRate
			weapon.MetalPerShot = weapon.AmmoPerShot
		}
	}

	// Parse target layers
	if targetLayers, ok := data["target_layers"].([]interface{}); ok {
		weapon.TargetLayers = make([]string, 0, len(targetLayers))
		for _, layer := range targetLayers {
			if layerStr, ok := layer.(string); ok {
				// Remove WL_ prefix if present
				layerStr = strings.TrimPrefix(layerStr, "WL_")
				weapon.TargetLayers = append(weapon.TargetLayers, layerStr)
			}
		}
	}

	// Parse target priorities
	if targetPriorities, ok := data["target_priorities"].([]interface{}); ok {
		weapon.TargetPriorities = make([]string, 0, len(targetPriorities))
		for _, priority := range targetPriorities {
			if priorityStr, ok := priority.(string); ok {
				weapon.TargetPriorities = append(weapon.TargetPriorities, priorityStr)
			}
		}
	}

	// Parse self-destruct flags
	weapon.SelfDestruct = loader.GetBool(data, "self_destruct", weapon.SelfDestruct) ||
		loader.GetBool(data, "only_fire_once", weapon.SelfDestruct)

	// Parse turret properties
	weapon.YawRange = loader.GetFloat(data, "yaw_range", weapon.YawRange)
	weapon.YawRate = loader.GetFloat(data, "yaw_rate", weapon.YawRate)
	weapon.PitchRange = loader.GetFloat(data, "pitch_range", weapon.PitchRange)
	weapon.PitchRate = loader.GetFloat(data, "pitch_rate", weapon.PitchRate)

	// Calculate DPS
	weapon.DPS = math.Round(weapon.ROF*weapon.Damage*float64(weapon.ProjectilesPerFire)*100) / 100

	return weapon, nil
}

// ParseAmmo parses ammo specifications from JSON
func ParseAmmo(l *loader.Loader, resourceName string, baseAmmo *models.Ammo) (*models.Ammo, error) {
	data, err := l.GetJSON(resourceName)
	if err != nil {
		return nil, err
	}

	ammo := &models.Ammo{
		ResourceName: resourceName,
		SafeName:     l.GetSafeName(resourceName),
	}

	// Handle base_spec inheritance
	if baseSpec, ok := data["base_spec"].(string); ok && baseAmmo == nil {
		baseAmmo, _ = ParseAmmo(l, baseSpec, nil)
		if baseAmmo != nil {
			*ammo = *baseAmmo
			ammo.ResourceName = resourceName
			ammo.SafeName = l.GetSafeName(resourceName)
		}
	} else if baseAmmo != nil {
		*ammo = *baseAmmo
		ammo.ResourceName = resourceName
		ammo.SafeName = l.GetSafeName(resourceName)
	}

	// Extract name from path
	parts := strings.Split(resourceName, "/")
	if len(parts) > 0 {
		ammo.Name = strings.TrimSuffix(parts[len(parts)-1], ".json")
	}

	// Parse fields
	ammo.Damage = loader.GetFloat(data, "damage", ammo.Damage)
	ammo.FullDamageRadius = loader.GetFloat(data, "full_damage_splash_radius", ammo.FullDamageRadius)
	ammo.SplashDamage = loader.GetFloat(data, "splash_damage", ammo.SplashDamage)
	ammo.SplashRadius = loader.GetFloat(data, "splash_radius", ammo.SplashRadius)
	ammo.MuzzleVelocity = loader.GetFloat(data, "initial_velocity", ammo.MuzzleVelocity)
	ammo.MaxVelocity = loader.GetFloat(data, "max_velocity", ammo.MaxVelocity)
	ammo.Lifetime = loader.GetFloat(data, "lifetime", ammo.Lifetime)
	ammo.MetalCost = loader.GetFloat(data, "build_metal_cost", ammo.MetalCost)

	return ammo, nil
}

// ParseBuildArm parses build arm (construction tool) specifications from JSON
func ParseBuildArm(l *loader.Loader, resourceName string, baseBuildArm *models.BuildArm) (*models.BuildArm, error) {
	data, err := l.GetJSON(resourceName)
	if err != nil {
		return nil, err
	}

	buildArm := &models.BuildArm{
		ResourceName: resourceName,
		SafeName:     l.GetSafeName(resourceName),
		Count:        1,
	}

	// Handle base_spec inheritance
	if baseSpec, ok := data["base_spec"].(string); ok && baseBuildArm == nil {
		baseBuildArm, _ = ParseBuildArm(l, baseSpec, nil)
		if baseBuildArm != nil {
			*buildArm = *baseBuildArm
			buildArm.ResourceName = resourceName
			buildArm.SafeName = l.GetSafeName(resourceName)
		}
	} else if baseBuildArm != nil {
		*buildArm = *baseBuildArm
		buildArm.ResourceName = resourceName
		buildArm.SafeName = l.GetSafeName(resourceName)
	}

	// Extract name from path
	parts := strings.Split(resourceName, "/")
	if len(parts) > 0 {
		buildArm.Name = strings.TrimSuffix(parts[len(parts)-1], ".json")
	}

	// Parse construction demand
	if demand, ok := data["construction_demand"].(map[string]interface{}); ok {
		buildArm.MetalConsumption = loader.GetFloat(demand, "metal", buildArm.MetalConsumption)
		buildArm.EnergyConsumption = loader.GetFloat(demand, "energy", buildArm.EnergyConsumption)
	}

	buildArm.Range = loader.GetFloat(data, "max_range", buildArm.Range)

	return buildArm, nil
}
