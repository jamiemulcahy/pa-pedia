package parser

import (
	"math"
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// parseEconomy parses production, consumption, and storage
func parseEconomy(data map[string]interface{}, unit *models.Unit) {
	// Production
	if production, ok := data["production"].(map[string]interface{}); ok {
		unit.Specs.Economy.Production.Metal = loader.GetFloat(production, "metal", 0)
		unit.Specs.Economy.Production.Energy = loader.GetFloat(production, "energy", 0)
	}

	// Consumption
	if consumption, ok := data["consumption"].(map[string]interface{}); ok {
		unit.Specs.Economy.Consumption.Metal = loader.GetFloat(consumption, "metal", 0)
		unit.Specs.Economy.Consumption.Energy = loader.GetFloat(consumption, "energy", 0)
	}

	// Storage
	if storage, ok := data["storage"].(map[string]interface{}); ok {
		unit.Specs.Economy.Storage.Metal = loader.GetFloat(storage, "metal", 0)
		unit.Specs.Economy.Storage.Energy = loader.GetFloat(storage, "energy", 0)
	}

	// Teleporter energy demand
	if teleporter, ok := data["teleporter"].(map[string]interface{}); ok {
		unit.Specs.Economy.Consumption.Energy = loader.GetFloat(teleporter, "energy_demand", unit.Specs.Economy.Consumption.Energy)
	}

	// Add Economy unit type if needed
	hasEconomy := false
	for _, ut := range unit.UnitTypes {
		if ut == "Economy" {
			hasEconomy = true
			break
		}
	}

	if !hasEconomy && (unit.Specs.Economy.Production.Metal != 0 || unit.Specs.Economy.Production.Energy != 0 ||
		unit.Specs.Economy.Storage.Metal != 0 || unit.Specs.Economy.Storage.Energy != 0) {
		if len(unit.UnitTypes) == 0 {
			unit.UnitTypes = []string{"Economy"}
		} else {
			unit.UnitTypes = append(unit.UnitTypes, "Economy")
		}
	}

	// Calculate tool consumption
	for _, arm := range unit.Specs.Economy.BuildArms {
		unit.Specs.Economy.ToolConsumption.Metal += arm.MetalConsumption
		unit.Specs.Economy.ToolConsumption.Energy += arm.EnergyConsumption
		unit.Specs.Economy.BuildRate += arm.MetalConsumption
	}

	if unit.Specs.Economy.ToolConsumption.Metal > 0 {
		unit.Specs.Economy.BuildInefficiency = unit.Specs.Economy.ToolConsumption.Energy / unit.Specs.Economy.ToolConsumption.Metal
	}

	// Calculate weapon consumption
	for _, weapon := range unit.Specs.Combat.Weapons {
		unit.Specs.Economy.WeaponConsumption.Metal -= weapon.MetalRate * float64(weapon.Count)
		unit.Specs.Economy.WeaponConsumption.Energy -= weapon.EnergyRate * float64(weapon.Count)
	}

	// Calculate net rates
	unit.Specs.Economy.MetalRate = unit.Specs.Economy.Production.Metal - unit.Specs.Economy.Consumption.Metal -
		unit.Specs.Economy.ToolConsumption.Metal - unit.Specs.Economy.WeaponConsumption.Metal
	unit.Specs.Economy.EnergyRate = unit.Specs.Economy.Production.Energy - unit.Specs.Economy.Consumption.Energy -
		unit.Specs.Economy.ToolConsumption.Energy - unit.Specs.Economy.WeaponConsumption.Energy

	// Round to 2 decimal places
	unit.Specs.Economy.MetalRate = math.Round(unit.Specs.Economy.MetalRate*100) / 100
	unit.Specs.Economy.EnergyRate = math.Round(unit.Specs.Economy.EnergyRate*100) / 100
}

// parseNavigation parses movement properties
func parseNavigation(data map[string]interface{}, unit *models.Unit) {
	if nav, ok := data["navigation"].(map[string]interface{}); ok {
		unit.Specs.Mobility.MoveSpeed = loader.GetFloat(nav, "move_speed", 0)
		unit.Specs.Mobility.TurnSpeed = loader.GetFloat(nav, "turn_speed", 0)
		unit.Specs.Mobility.Acceleration = loader.GetFloat(nav, "acceleration", 0)
		unit.Specs.Mobility.Brake = loader.GetFloat(nav, "brake", 0)

		navType := loader.GetString(nav, "type", "")
		switch navType {
		case "amphibious":
			unit.Specs.Special.Amphibious = true
		case "hover":
			unit.Specs.Special.Hover = true
		}
	}
}

// parseSpawnLayers parses spawn layers
func parseSpawnLayers(data map[string]interface{}, unit *models.Unit) {
	if spawnLayersStr, ok := data["spawn_layers"].(string); ok {
		switch spawnLayersStr {
		case "WL_LandHorizontal":
			unit.Specs.Special.SpawnLayers = []string{"land"}
		case "WL_WaterSurface":
			unit.Specs.Special.SpawnLayers = []string{"water surface"}
		case "WL_Underwater":
			unit.Specs.Special.SpawnLayers = []string{"under water"}
		case "WL_DeepWater":
			unit.Specs.Special.SpawnLayers = []string{"deep water"}
		case "WL_Air":
			unit.Specs.Special.SpawnLayers = []string{"air"}
		case "WL_AnyHorizontalGroundOrWaterSurface", "WL_AnySurface":
			unit.Specs.Special.SpawnLayers = []string{"land", "water surface"}
		case "WL_Orbital":
			unit.Specs.Special.SpawnLayers = []string{"orbital"}
		}
	}
}

// parseRecon parses vision and radar properties
func parseRecon(data map[string]interface{}, unit *models.Unit) {
	recon := loader.GetMap(data, "recon")
	observer := loader.GetMap(recon, "observer")
	items := loader.GetArray(observer, "items")

	for _, itemInterface := range items {
		if item, ok := itemInterface.(map[string]interface{}); ok {
			channel := loader.GetString(item, "channel", "")
			layer := loader.GetString(item, "layer", "")
			radius := loader.GetFloat(item, "radius", 0)

			switch channel {
			case "sight":
				switch layer {
				case "surface_and_air":
					unit.Specs.Recon.VisionRadius = radius
				case "underwater":
					unit.Specs.Recon.UnderwaterVisionRadius = radius
				case "orbital":
					unit.Specs.Recon.OrbitalVisionRadius = radius
				case "mine":
					unit.Specs.Recon.MineVisionRadius = radius
				}
			case "radar":
				switch layer {
				case "surface_and_air":
					unit.Specs.Recon.RadarRadius = radius
				case "underwater":
					unit.Specs.Recon.SonarRadius = radius
				case "orbital":
					unit.Specs.Recon.OrbitalRadarRadius = radius
				}
			}
		}
	}
}

// parseStorage parses factory storage capabilities
func parseStorage(data map[string]interface{}, unit *models.Unit) {
	if factory, ok := data["factory"].(map[string]interface{}); ok {
		if storeUnits, ok := factory["store_units"].(bool); ok && storeUnits {
			if spawnPoints, ok := factory["spawn_points"].([]interface{}); ok {
				unit.Specs.Storage.UnitStorage = len(spawnPoints)
				unit.Specs.Storage.StoredUnitType = "unit" // Default

				if unit.Specs.Storage.UnitStorage > 0 {
					if spMap, ok := spawnPoints[0].(map[string]interface{}); ok {
						for key := range spMap {
							if strings.Contains(key, "missile") {
								unit.Specs.Storage.StoredUnitType = "missile"
								break
							}
						}
					}
				}
			}
		}
	}
}
