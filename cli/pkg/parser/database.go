package parser

import (
	"fmt"
	"sort"

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
// factionUnitType filters units to only those matching the specified faction unit type (case-insensitive)
// factionUnitType must be provided - there is no fallback to loading all units
func (db *Database) LoadUnits(verbose bool, factionUnitType string) error {
	// Validate that factionUnitType is provided
	if factionUnitType == "" {
		return fmt.Errorf("faction unit type is required for filtering units")
	}

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

		// Filter by faction unit type (required)
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

	// Warn if no units were found matching the faction type
	if len(allUnits) == 0 {
		fmt.Printf("\n⚠ WARNING: No units found matching faction unit type 'UNITTYPE_%s'\n", factionUnitType)
		fmt.Printf("   This means the faction export will contain 0 units.\n")
		fmt.Printf("   Please verify the --faction-unit-type value is correct.\n")
		fmt.Printf("   Common values: 'Custom58' (MLA), 'Custom1' (Legion)\n\n")
	}

	// Build the build tree (establish build relationships)
	if err := db.buildBuildTree(allUnits, verbose); err != nil {
		return fmt.Errorf("failed to build build tree: %w", err)
	}

	// Apply corrections
	db.applyCorrections()

	return nil
}

// unitMatchesFactionType checks if a unit's unit_types array contains the factionUnitType
// Note: Unit.UnitTypes has UNITTYPE_ prefix already stripped during parsing
// Comparison is case-insensitive
func unitMatchesFactionType(unit *models.Unit, factionUnitType string) bool {
	for _, unitType := range unit.UnitTypes {
		if equalsFold(unitType, factionUnitType) {
			return true
		}
	}
	return false
}

// equalsFold performs case-insensitive string comparison
func equalsFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca := a[i]
		cb := b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
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
