package parser

import (
	"fmt"
	"sort"
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// Database manages unit parsing and relationship building
type Database struct {
	Loader *loader.Loader
	Units  map[string]*models.Unit // Keyed by unit ID
}

// NewDatabase creates a new database parser
func NewDatabase(l *loader.Loader) *Database {
	return &Database{
		Loader: l,
		Units:  make(map[string]*models.Unit),
	}
}

// LoadUnits loads all units from the PA installation
// factionUnitType filters units to those matching the specified faction unit type (case-insensitive)
// factionUnitType must be provided by the caller - validation happens at CLI layer
// allowEmpty controls whether 0 matching units is an error or just a warning
func (db *Database) LoadUnits(verbose bool, factionUnitType string, allowEmpty bool) error {
	// Load merged unit list from all sources
	unitPaths, _, err := db.Loader.LoadMergedUnitList()
	if err != nil {
		return fmt.Errorf("failed to load unit list: %w", err)
	}

	if verbose {
		fmt.Printf("Found %d units to parse\n", len(unitPaths))
	}

	// Parse each unit
	allUnits := make([]*models.Unit, 0, len(unitPaths))
	filteredCount := 0
	for i, unitPath := range unitPaths {
		if verbose && i%10 == 0 {
			fmt.Printf("  Parsing unit %d/%d...\r", i+1, len(unitPaths))
		}
		unit, err := ParseUnit(db.Loader, unitPath, nil)
		if err != nil {
			if verbose {
				fmt.Printf("\nWarning: failed to parse unit %s: %v\n", unitPath, err)
			}
			continue
		}

		// Filter by faction unit type
		if !unitMatchesFactionType(unit, factionUnitType) {
			filteredCount++
			continue
		}

		allUnits = append(allUnits, unit)
	}

	if verbose {
		fmt.Printf("\n  Parsed %d units successfully\n", len(allUnits))
		fmt.Printf("  Filtered out %d units not matching UNITTYPE_%s\n", filteredCount, factionUnitType)
	}

	// Error if no units were found matching the faction type (unless allowed)
	if len(allUnits) == 0 {
		if allowEmpty {
			fmt.Printf("\n⚠ WARNING: No units found matching faction unit type 'UNITTYPE_%s'\n", factionUnitType)
			fmt.Printf("   The faction export will contain 0 units (--allow-empty is set).\n")
			fmt.Printf("   Common values: 'Custom58' (MLA), 'Custom1' (Legion)\n\n")
		} else {
			return fmt.Errorf("no units found matching faction unit type 'UNITTYPE_%s'\n\nThis means the faction export would contain 0 units.\nPlease verify the --faction-unit-type value is correct.\nCommon values: 'Custom58' (MLA), 'Custom1' (Legion)\n\nTo allow empty exports, use the --allow-empty flag", factionUnitType)
		}
	}

	// Build the build tree (establish build relationships)
	if err := db.buildBuildTree(allUnits, verbose); err != nil {
		return fmt.Errorf("failed to build build tree: %w", err)
	}

	// Discover and add spawned units (units referenced by spawn_unit_on_death)
	db.discoverSpawnedUnits(verbose)

	// Apply corrections
	db.applyCorrections()

	return nil
}

// LoadUnitsNoFilter loads all units from sources without faction type filtering.
// Used for addon mods where filtering is done by exclusion (removing base game units) rather than inclusion.
// The caller is responsible for filtering out unwanted units after this call.
func (db *Database) LoadUnitsNoFilter(verbose bool) error {
	// Load merged unit list from all sources
	unitPaths, _, err := db.Loader.LoadMergedUnitList()
	if err != nil {
		return fmt.Errorf("failed to load unit list: %w", err)
	}

	if verbose {
		fmt.Printf("Found %d units to parse (no faction filter)\n", len(unitPaths))
	}

	// Parse each unit
	allUnits := make([]*models.Unit, 0, len(unitPaths))
	for i, unitPath := range unitPaths {
		if verbose && i%10 == 0 {
			fmt.Printf("  Parsing unit %d/%d...\r", i+1, len(unitPaths))
		}
		unit, err := ParseUnit(db.Loader, unitPath, nil)
		if err != nil {
			if verbose {
				fmt.Printf("\nWarning: failed to parse unit %s: %v\n", unitPath, err)
			}
			continue
		}

		allUnits = append(allUnits, unit)
	}

	if verbose {
		fmt.Printf("\n  Parsed %d units successfully (unfiltered)\n", len(allUnits))
	}

	// Build the build tree (establish build relationships)
	if err := db.buildBuildTree(allUnits, verbose); err != nil {
		return fmt.Errorf("failed to build build tree: %w", err)
	}

	// Discover and add spawned units (units referenced by spawn_unit_on_death)
	db.discoverSpawnedUnits(verbose)

	// Apply corrections
	db.applyCorrections()

	return nil
}

// unitMatchesFactionType checks if a unit's unit_types array contains the specified factionUnitType
// Note: Unit.UnitTypes has UNITTYPE_ prefix already stripped during parsing
// Comparison is case-insensitive
//
// Example: For a unit with UnitTypes=["Custom1", "Land", "Tank"],
// unitMatchesFactionType(unit, "Custom1") returns true
// unitMatchesFactionType(unit, "Custom58") returns false (no match)
func unitMatchesFactionType(unit *models.Unit, factionUnitType string) bool {
	for _, unitType := range unit.UnitTypes {
		if strings.EqualFold(unitType, factionUnitType) {
			return true
		}
	}
	return false
}

// buildBuildTree establishes build relationships between units
func (db *Database) buildBuildTree(allUnits []*models.Unit, verbose bool) error {
	// Sort units by build cost and name for consistent ordering
	sort.Slice(allUnits, func(i, j int) bool {
		costI := allUnits[i].Specs.Economy.BuildCost
		costJ := allUnits[j].Specs.Economy.BuildCost
		if costI != costJ {
			return costI < costJ
		}
		return allUnits[i].DisplayName < allUnits[j].DisplayName
	})

	// Add non-template units to the main units map
	for _, unit := range allUnits {
		if !unit.BaseTemplate {
			db.Units[unit.ID] = unit
		}
	}

	if verbose {
		fmt.Printf("  Building unit relationships...\n")
	}

	// Build relationships
	processedCount := 0
	for _, unit := range allUnits {
		if unit.BaseTemplate {
			continue
		}

		// Parse buildable types restriction
		if unit.BuildableTypes == "" {
			continue
		}

		processedCount++
		if verbose && processedCount%10 == 0 {
			fmt.Printf("    Processing build relationships %d...\r", processedCount)
		}

		restriction := ParseRestriction(unit.BuildableTypes)

		// Check which units satisfy this restriction
		builds := make([]string, 0)
		for _, other := range allUnits {
			if other.BaseTemplate {
				continue
			}

			if restriction.Satisfies(other) {
				builds = append(builds, other.ID)
				// Add to other's builtBy list
				if other.BuildRelationships.BuiltBy == nil {
					other.BuildRelationships.BuiltBy = make([]string, 0)
				}
				other.BuildRelationships.BuiltBy = append(other.BuildRelationships.BuiltBy, unit.ID)
			}
		}

		unit.BuildRelationships.Builds = builds
	}

	if verbose {
		fmt.Printf("\n")
	}

	// Find all commanders
	commanders := make([]*models.Unit, 0)
	for _, unit := range db.Units {
		for _, ut := range unit.UnitTypes {
			if ut == "Commander" {
				commanders = append(commanders, unit)
				break
			}
		}
	}

	if verbose {
		fmt.Printf("  Found %d commanders\n", len(commanders))
	}

	// Sort commanders by name
	sort.Slice(commanders, func(i, j int) bool {
		return commanders[i].DisplayName < commanders[j].DisplayName
	})

	// Mark accessible units (units that can be built starting from commanders)
	if verbose {
		fmt.Printf("  Marking accessible units...\n")
	}

	for _, commander := range commanders {
		db.setAccessible(commander)
	}

	// Count accessible units
	if verbose {
		accessibleCount := 0
		for _, unit := range db.Units {
			if unit.Accessible {
				accessibleCount++
			}
		}
		fmt.Printf("  Marked %d units as accessible\n", accessibleCount)
	}

	return nil
}

// setAccessible recursively marks a unit and all units it can build as accessible
func (db *Database) setAccessible(unit *models.Unit) {
	if unit.Accessible {
		return // Already processed
	}

	unit.Accessible = true

	// Recursively mark all buildable units as accessible
	for _, buildableID := range unit.BuildRelationships.Builds {
		if builtUnit, ok := db.Units[buildableID]; ok {
			db.setAccessible(builtUnit)
		}
	}
}

// discoverSpawnedUnits finds and adds units referenced by spawn_unit_on_death fields
// This includes both unit-level spawns (when a unit dies) and ammo-level spawns (when projectiles hit/expire)
// Uses a queue-based approach to handle recursive spawns (unit A spawns B, B spawns C)
func (db *Database) discoverSpawnedUnits(verbose bool) {
	// Collect all spawn unit resource paths from existing units
	spawnQueue := make([]string, 0)
	visited := make(map[string]bool)

	// Mark all existing units as visited
	for _, unit := range db.Units {
		visited[unit.ResourceName] = true
	}

	// Collect initial spawn references from all units
	for _, unit := range db.Units {
		// Unit-level spawn
		if unit.Specs.Special != nil && unit.Specs.Special.SpawnUnitOnDeath != "" {
			path := unit.Specs.Special.SpawnUnitOnDeath
			if !visited[path] {
				spawnQueue = append(spawnQueue, path)
				visited[path] = true
			}
		}

		// Ammo-level spawns from weapons
		if unit.Specs.Combat != nil {
			for _, weapon := range unit.Specs.Combat.Weapons {
				if weapon.Ammo != nil && weapon.Ammo.SpawnUnitOnDeath != "" {
					path := weapon.Ammo.SpawnUnitOnDeath
					if !visited[path] {
						spawnQueue = append(spawnQueue, path)
						visited[path] = true
					}
				}
			}
		}
	}

	if len(spawnQueue) == 0 {
		if verbose {
			fmt.Printf("  No spawned units to discover\n")
		}
		return
	}

	if verbose {
		fmt.Printf("  Discovering spawned units (%d initial references)...\n", len(spawnQueue))
	}

	// Process queue - parse each spawned unit and check for further spawns
	addedCount := 0
	for len(spawnQueue) > 0 {
		// Dequeue
		resourcePath := spawnQueue[0]
		spawnQueue = spawnQueue[1:]

		// Parse the spawned unit
		unit, err := ParseUnit(db.Loader, resourcePath, nil)
		if err != nil {
			if verbose {
				fmt.Printf("    Warning: failed to parse spawned unit %s: %v\n", resourcePath, err)
			}
			continue
		}

		// Skip base templates
		if unit.BaseTemplate {
			continue
		}

		// Add to database (spawned units are not accessible via build tree)
		db.Units[unit.ID] = unit
		addedCount++

		if verbose {
			fmt.Printf("    Added spawned unit: %s (%s)\n", unit.DisplayName, unit.ID)
		}

		// Check this unit for further spawn references
		if unit.Specs.Special != nil && unit.Specs.Special.SpawnUnitOnDeath != "" {
			path := unit.Specs.Special.SpawnUnitOnDeath
			if !visited[path] {
				spawnQueue = append(spawnQueue, path)
				visited[path] = true
			}
		}

		if unit.Specs.Combat != nil {
			for _, weapon := range unit.Specs.Combat.Weapons {
				if weapon.Ammo != nil && weapon.Ammo.SpawnUnitOnDeath != "" {
					path := weapon.Ammo.SpawnUnitOnDeath
					if !visited[path] {
						spawnQueue = append(spawnQueue, path)
						visited[path] = true
					}
				}
			}
		}
	}

	if verbose {
		fmt.Printf("  Added %d spawned units\n", addedCount)
	}
}

// applyCorrections fixes known inconsistencies in PA unit data
func (db *Database) applyCorrections() {
	// Disable certain units (tutorial/test units)
	disabled := []string{"tutorial_titan_commander", "sea_mine"}
	for _, id := range disabled {
		if unit, ok := db.Units[id]; ok {
			unit.Accessible = false
		}
	}

	// Fix titan structure tier and type
	if unit, ok := db.Units["titan_structure"]; ok {
		unit.Tier = 3
		// Add Titan to unit types if not present
		hasTitan := false
		for _, ut := range unit.UnitTypes {
			if ut == "Titan" {
				hasTitan = true
				break
			}
		}
		if !hasTitan {
			unit.UnitTypes = append(unit.UnitTypes, "Titan")
		}
	}

	// Fix teleporter tier
	if unit, ok := db.Units["teleporter"]; ok {
		unit.Tier = 1
	}

	// Fix mining platform tier
	if unit, ok := db.Units["mining_platform"]; ok {
		unit.Tier = 2
	}

	// Fix land mine tier
	if unit, ok := db.Units["land_mine"]; ok {
		unit.Tier = 1
	}
}

// DetectBaseFactions analyzes loaded units and returns the display names of base factions found.
// This is used for balance mods to identify which factions the mod adds units for.
// Returns a sorted array of faction display names (e.g., ["Bugs", "Legion", "MLA"]).
func (db *Database) DetectBaseFactions() []string {
	// Map of known faction unit type identifiers to display names
	factionMap := map[string]string{
		"Custom58": "MLA",
		"Custom1":  "Legion",
		"Custom2":  "Bugs",
		"Custom6":  "Exiles",
	}

	foundFactions := make(map[string]bool)
	for _, unit := range db.Units {
		for _, unitType := range unit.UnitTypes {
			// Check case-insensitively
			for customType, displayName := range factionMap {
				if strings.EqualFold(unitType, customType) {
					foundFactions[displayName] = true
					break
				}
			}
		}
	}

	result := make([]string, 0, len(foundFactions))
	for faction := range foundFactions {
		result = append(result, faction)
	}
	sort.Strings(result)
	return result
}

// GetUnitsArray returns all units as an array (sorted by name)
func (db *Database) GetUnitsArray() []models.Unit {
	units := make([]models.Unit, 0, len(db.Units))
	for _, unit := range db.Units {
		units = append(units, *unit)
	}

	// Sort by tier, then by display name
	sort.Slice(units, func(i, j int) bool {
		if units[i].Tier != units[j].Tier {
			return units[i].Tier < units[j].Tier
		}
		return units[i].DisplayName < units[j].DisplayName
	})

	return units
}
