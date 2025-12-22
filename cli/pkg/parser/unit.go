package parser

import (
	"fmt"
	"math"
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// ParseUnit parses a unit specification from JSON with base_spec inheritance
func ParseUnit(l *loader.Loader, resourceName string, baseUnit *models.Unit) (*models.Unit, error) {
	data, err := l.GetJSON(resourceName)
	if err != nil {
		return nil, err
	}

	unit := &models.Unit{
		ID:           l.GetSafeName(resourceName),
		ResourceName: resourceName,
		Specs:        models.UnitSpecs{},
	}

	// Handle base_spec inheritance
	if baseSpec, ok := data["base_spec"].(string); ok && baseUnit == nil {
		baseUnit, _ = ParseUnit(l, baseSpec, nil)
		if baseUnit != nil {
			// Copy base unit properties
			*unit = *baseUnit
			unit.ResourceName = resourceName
			unit.ID = l.GetSafeName(resourceName)
		}
	} else if baseUnit != nil {
		*unit = *baseUnit
		unit.ResourceName = resourceName
		unit.ID = l.GetSafeName(resourceName)
	}

	// Parse basic identification
	unit.DisplayName = loader.Delocalize(loader.GetString(data, "display_name", unit.ID))
	role := loader.Delocalize(loader.GetString(data, "unit_name", unit.DisplayName))
	description := loader.Delocalize(loader.GetString(data, "description", ""))

	// Set image path (relative to faction folder, pointing to icon in unit folder)
	unit.Image = fmt.Sprintf("units/%s/%s_icon_buildbar.png", unit.ID, unit.ID)

	// Combine role and description
	if role != unit.DisplayName && description != "" {
		unit.Description = fmt.Sprintf("%s - %s", role, description)
	} else if role != unit.DisplayName {
		unit.Description = role
	} else if description != "" {
		unit.Description = description
	}

	// Parse unit types
	if unitTypesInterface, ok := data["unit_types"].([]interface{}); ok {
		unit.UnitTypes = make([]string, 0, len(unitTypesInterface))
		for _, ut := range unitTypesInterface {
			if utStr, ok := ut.(string); ok {
				// Remove UNITTYPE_ prefix
				utStr = strings.TrimPrefix(utStr, "UNITTYPE_")
				unit.UnitTypes = append(unit.UnitTypes, utStr)
			}
		}
	}

	// Determine tier from unit types
	unit.Tier = 1 // Default to tier 1
	for _, ut := range unit.UnitTypes {
		switch ut {
		case "Basic":
			unit.Tier = 1
		case "Advanced":
			unit.Tier = 2
		case "Titan":
			unit.Tier = 3
		}
	}

	// Parse buildable types
	unit.BuildableTypes = loader.GetString(data, "buildable_types", unit.BuildableTypes)

	// Parse assist buildable only
	if val, ok := data["can_only_assist_with_buildable_items"]; ok {
		if b, ok := val.(bool); ok {
			unit.AssistBuildOnly = &b
		}
	}

	// Check if this is a base template
	unit.BaseTemplate = strings.HasPrefix(unit.ID, "base_")

	// Initialize spec categories
	if unit.Specs.Combat == nil {
		unit.Specs.Combat = &models.CombatSpecs{}
	}
	if unit.Specs.Economy == nil {
		unit.Specs.Economy = &models.EconomySpecs{}
	}
	if unit.Specs.Mobility == nil {
		unit.Specs.Mobility = &models.MobilitySpecs{}
	}
	if unit.Specs.Recon == nil {
		unit.Specs.Recon = &models.ReconSpecs{}
	}
	if unit.Specs.Storage == nil {
		unit.Specs.Storage = &models.StorageSpecs{}
	}
	if unit.Specs.Special == nil {
		unit.Specs.Special = &models.SpecialSpecs{}
	}

	// Parse combat stats
	unit.Specs.Combat.Health = loader.GetFloat(data, "max_health", unit.Specs.Combat.Health)
	unit.Specs.Economy.BuildCost = loader.GetFloat(data, "build_metal_cost", unit.Specs.Economy.BuildCost)

	// Parse tools (weapons, build arms)
	if err := parseTools(l, data, unit); err != nil {
		return nil, err
	}

	// Parse death weapon
	if deathWeapon, ok := data["death_weapon"].(map[string]interface{}); ok {
		if groundAmmoSpec, ok := deathWeapon["ground_ammo_spec"].(string); ok {
			weapon, err := ParseWeapon(l, groundAmmoSpec, nil)
			if err == nil {
				weapon.Count = 1
				weapon.DeathExplosion = true
				unit.Specs.Combat.Weapons = append(unit.Specs.Combat.Weapons, *weapon)
			}
		}
	}

	// Calculate DPS and salvo damage
	totalDPS := 0.0
	totalSalvoDamage := 0.0
	for _, w := range unit.Specs.Combat.Weapons {
		if !w.DeathExplosion && !w.SelfDestruct {
			totalDPS += w.DPS * float64(w.Count)
		}
		totalSalvoDamage += w.Damage * float64(w.Count)
	}
	unit.Specs.Combat.DPS = math.Round(totalDPS*100) / 100
	unit.Specs.Combat.SalvoDamage = math.Round(totalSalvoDamage*100) / 100

	// Calculate build range
	maxBuildRange := 0.0
	for _, arm := range unit.Specs.Economy.BuildArms {
		if arm.Range > maxBuildRange {
			maxBuildRange = arm.Range
		}
	}
	unit.Specs.Economy.BuildRange = maxBuildRange

	// Parse economy
	parseEconomy(data, unit)

	// Parse navigation/mobility
	parseNavigation(data, unit)

	// Parse spawn layers
	parseSpawnLayers(data, unit)

	// Parse spawn unit on death (unit-level)
	if spawnUnit := loader.GetString(data, "spawn_unit_on_death", ""); spawnUnit != "" {
		unit.Specs.Special.SpawnUnitOnDeath = spawnUnit
	}

	// Parse recon
	parseRecon(data, unit)

	// Parse factory storage
	parseStorage(data, unit)

	return unit, nil
}

// parseTools parses weapons and build arms from the tools array
func parseTools(l *loader.Loader, data map[string]interface{}, unit *models.Unit) error {
	toolsInterface := loader.GetArray(data, "tools")

	// If this unit defines its own tools array, it completely replaces inherited tools.
	// This matches PA's behavior where child unit tools override parent tools entirely.
	// However, we preserve death explosion and self-destruct weapons since those are
	// defined via unit-level fields (death_weapon, self_destruct) not in the tools array.
	if len(toolsInterface) > 0 {
		var preservedWeapons []models.Weapon
		for _, w := range unit.Specs.Combat.Weapons {
			if w.DeathExplosion || w.SelfDestruct {
				preservedWeapons = append(preservedWeapons, w)
			}
		}
		unit.Specs.Combat.Weapons = preservedWeapons
		unit.Specs.Economy.BuildArms = nil
	}

	// Count tool occurrences
	toolCounts := make(map[string]int)
	toolData := make(map[string]map[string]interface{})

	for _, toolInterface := range toolsInterface {
		if tool, ok := toolInterface.(map[string]interface{}); ok {
			if specID, ok := tool["spec_id"].(string); ok {
				toolCounts[specID]++
				if _, exists := toolData[specID]; !exists {
					toolData[specID] = tool
				}
			}
		}
	}

	// Parse each unique tool
	for specID, tool := range toolData {
		count := toolCounts[specID]
		name := extractToolName(specID)

		// Determine tool type
		isWeapon := strings.Contains(name, "weapon") ||
			strings.Contains(name, "primary_weapon") ||
			strings.Contains(name, "secondary_weapon") ||
			strings.Contains(name, "aim_weapon")

		isBuildArm := strings.Contains(name, "build_arm")

		// Check for death_weapon flag
		isDeathWeapon := false
		if dw, ok := tool["death_weapon"].(bool); ok {
			isDeathWeapon = dw
		}

		if isWeapon || isDeathWeapon {
			if weapon := parseWeaponWithOverrides(l, specID, tool, count, isDeathWeapon); weapon != nil {
				unit.Specs.Combat.Weapons = append(unit.Specs.Combat.Weapons, *weapon)
			}
		} else if isBuildArm {
			buildArm, err := ParseBuildArm(l, specID, nil)
			if err == nil {
				buildArm.Count = count
				unit.Specs.Economy.BuildArms = append(unit.Specs.Economy.BuildArms, *buildArm)
			}
		} else {
			// Check tool_type in the actual tool spec (following base_spec inheritance)
			toolType := getToolType(l, specID)
			if toolType == "TOOL_Weapon" {
				if weapon := parseWeaponWithOverrides(l, specID, tool, count, isDeathWeapon); weapon != nil {
					unit.Specs.Combat.Weapons = append(unit.Specs.Combat.Weapons, *weapon)
				}
			}
		}
	}

	return nil
}

// parseWeaponWithOverrides parses a weapon and applies tool-level overrides
func parseWeaponWithOverrides(l *loader.Loader, specID string, tool map[string]interface{}, count int, isDeathWeapon bool) *models.Weapon {
	weapon, err := ParseWeapon(l, specID, nil)
	if err != nil {
		return nil
	}

	weapon.Count = count
	weapon.DeathExplosion = isDeathWeapon

	// Handle projectiles_per_fire override from unit's tool definition
	if ppf, ok := tool["projectiles_per_fire"]; ok {
		if ppfInt, ok := ppf.(float64); ok {
			weapon.ProjectilesPerFire = int(ppfInt)
			// Recalculate DPS with new projectiles_per_fire
			weapon.DPS = math.Round(weapon.ROF*weapon.Damage*float64(weapon.ProjectilesPerFire)*100) / 100
		}
	}

	return weapon
}

// getToolType returns the tool_type for a spec, following base_spec inheritance
func getToolType(l *loader.Loader, specID string) string {
	visited := make(map[string]bool)
	return getToolTypeRecursive(l, specID, visited)
}

func getToolTypeRecursive(l *loader.Loader, specID string, visited map[string]bool) string {
	// Prevent infinite loops
	if visited[specID] {
		return ""
	}
	visited[specID] = true

	toolSpec, err := l.GetJSON(specID)
	if err != nil {
		return ""
	}

	// Check if this spec has tool_type directly
	if toolType := loader.GetString(toolSpec, "tool_type", ""); toolType != "" {
		return toolType
	}

	// Follow base_spec if present
	if baseSpec := loader.GetString(toolSpec, "base_spec", ""); baseSpec != "" {
		return getToolTypeRecursive(l, baseSpec, visited)
	}

	return ""
}

// extractToolName extracts the tool name from a resource path
func extractToolName(resourcePath string) string {
	parts := strings.Split(resourcePath, "/")
	if len(parts) > 0 {
		return strings.TrimSuffix(parts[len(parts)-1], ".json")
	}
	return ""
}
