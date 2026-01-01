package parser

import (
	"sort"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// TestUnitMatchesFactionType tests faction type matching with a single type
func TestUnitMatchesFactionType(t *testing.T) {
	tests := []struct {
		name            string
		unitTypes       []string
		factionUnitType string
		expected        bool
	}{
		{
			name:            "match found",
			unitTypes:       []string{"Custom58", "Land", "Tank"},
			factionUnitType: "Custom58",
			expected:        true,
		},
		{
			name:            "case insensitive match",
			unitTypes:       []string{"custom58", "Land"},
			factionUnitType: "Custom58",
			expected:        true,
		},
		{
			name:            "case insensitive filter",
			unitTypes:       []string{"Custom58", "Land"},
			factionUnitType: "CUSTOM58",
			expected:        true,
		},
		{
			name:            "no match",
			unitTypes:       []string{"Custom58", "Land", "Tank"},
			factionUnitType: "Custom1",
			expected:        false,
		},
		{
			name:            "empty unit types",
			unitTypes:       []string{},
			factionUnitType: "Custom58",
			expected:        false,
		},
		{
			name:            "empty faction type",
			unitTypes:       []string{"Custom58", "Land"},
			factionUnitType: "",
			expected:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			unit := &models.Unit{
				UnitTypes: tt.unitTypes,
			}
			result := unitMatchesFactionType(unit, tt.factionUnitType)
			if result != tt.expected {
				t.Errorf("unitMatchesFactionType(%v, %q) = %v, want %v",
					tt.unitTypes, tt.factionUnitType, result, tt.expected)
			}
		})
	}
}

// TestDetectBaseFactions tests faction detection from unit types
func TestDetectBaseFactions(t *testing.T) {
	tests := []struct {
		name     string
		units    map[string]*models.Unit
		expected []string
	}{
		{
			name: "MLA only",
			units: map[string]*models.Unit{
				"tank": {UnitTypes: []string{"Custom58", "Land", "Tank"}},
				"bot":  {UnitTypes: []string{"Custom58", "Land", "Bot"}},
			},
			expected: []string{"MLA"},
		},
		{
			name: "Legion only",
			units: map[string]*models.Unit{
				"l_tank": {UnitTypes: []string{"Custom1", "Land", "Tank"}},
			},
			expected: []string{"Legion"},
		},
		{
			name: "MLA and Legion",
			units: map[string]*models.Unit{
				"tank":   {UnitTypes: []string{"Custom58", "Land"}},
				"l_tank": {UnitTypes: []string{"Custom1", "Land"}},
			},
			expected: []string{"Legion", "MLA"},
		},
		{
			name: "all four factions",
			units: map[string]*models.Unit{
				"mla_unit":    {UnitTypes: []string{"Custom58"}},
				"legion_unit": {UnitTypes: []string{"Custom1"}},
				"bugs_unit":   {UnitTypes: []string{"Custom2"}},
				"exiles_unit": {UnitTypes: []string{"Custom6"}},
			},
			expected: []string{"Bugs", "Exiles", "Legion", "MLA"},
		},
		{
			name: "case insensitive detection",
			units: map[string]*models.Unit{
				"tank": {UnitTypes: []string{"custom58", "Land"}},
			},
			expected: []string{"MLA"},
		},
		{
			name: "no faction markers",
			units: map[string]*models.Unit{
				"tank": {UnitTypes: []string{"Land", "Tank", "Basic"}},
			},
			expected: []string{},
		},
		{
			name:     "empty units",
			units:    map[string]*models.Unit{},
			expected: []string{},
		},
		{
			name: "Second Wave style - three factions",
			units: map[string]*models.Unit{
				"mla_addon":    {UnitTypes: []string{"Custom58", "Tank"}},
				"legion_addon": {UnitTypes: []string{"Custom1", "Tank"}},
				"bugs_addon":   {UnitTypes: []string{"Custom2", "Tank"}},
			},
			expected: []string{"Bugs", "Legion", "MLA"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := &Database{
				Units: tt.units,
			}
			result := db.DetectBaseFactions()

			if len(result) != len(tt.expected) {
				t.Errorf("DetectBaseFactions() returned %v, want %v", result, tt.expected)
				return
			}

			for i, faction := range result {
				if faction != tt.expected[i] {
					t.Errorf("DetectBaseFactions()[%d] = %q, want %q", i, faction, tt.expected[i])
				}
			}
		})
	}
}

// TestGetUnitIDs tests building a set of unit IDs from a database
func TestGetUnitIDs(t *testing.T) {
	tests := []struct {
		name     string
		units    map[string]*models.Unit
		expected []string
	}{
		{
			name: "multiple units",
			units: map[string]*models.Unit{
				"tank":      {ID: "tank"},
				"bot":       {ID: "bot"},
				"commander": {ID: "commander"},
			},
			expected: []string{"bot", "commander", "tank"},
		},
		{
			name:     "empty database",
			units:    map[string]*models.Unit{},
			expected: []string{},
		},
		{
			name: "single unit",
			units: map[string]*models.Unit{
				"tank": {ID: "tank"},
			},
			expected: []string{"tank"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := &Database{Units: tt.units}
			result := db.GetUnitIDs()

			// Convert map to sorted slice for comparison
			ids := make([]string, 0, len(result))
			for id := range result {
				ids = append(ids, id)
			}
			sort.Strings(ids)

			if len(ids) != len(tt.expected) {
				t.Errorf("GetUnitIDs() returned %d IDs, want %d", len(ids), len(tt.expected))
				return
			}

			for i, id := range ids {
				if id != tt.expected[i] {
					t.Errorf("GetUnitIDs()[%d] = %q, want %q", i, id, tt.expected[i])
				}
			}
		})
	}
}

// TestFilterOutUnits tests filtering units by ID set
func TestFilterOutUnits(t *testing.T) {
	tests := []struct {
		name             string
		units            map[string]*models.Unit
		filterIDs        map[string]bool
		expectedRemain   []string
		expectedFiltered int
	}{
		{
			name: "filter some units",
			units: map[string]*models.Unit{
				"tank":       {ID: "tank"},
				"bot":        {ID: "bot"},
				"addon_tank": {ID: "addon_tank"},
			},
			filterIDs:        map[string]bool{"tank": true, "bot": true},
			expectedRemain:   []string{"addon_tank"},
			expectedFiltered: 2,
		},
		{
			name: "filter all units",
			units: map[string]*models.Unit{
				"tank": {ID: "tank"},
				"bot":  {ID: "bot"},
			},
			filterIDs:        map[string]bool{"tank": true, "bot": true},
			expectedRemain:   []string{},
			expectedFiltered: 2,
		},
		{
			name: "filter no units",
			units: map[string]*models.Unit{
				"addon_tank": {ID: "addon_tank"},
				"addon_bot":  {ID: "addon_bot"},
			},
			filterIDs:        map[string]bool{"tank": true, "bot": true},
			expectedRemain:   []string{"addon_bot", "addon_tank"},
			expectedFiltered: 0,
		},
		{
			name: "empty filter set",
			units: map[string]*models.Unit{
				"tank": {ID: "tank"},
			},
			filterIDs:        map[string]bool{},
			expectedRemain:   []string{"tank"},
			expectedFiltered: 0,
		},
		{
			name:             "empty database",
			units:            map[string]*models.Unit{},
			filterIDs:        map[string]bool{"tank": true},
			expectedRemain:   []string{},
			expectedFiltered: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := &Database{Units: tt.units}
			filtered := db.FilterOutUnits(tt.filterIDs)

			if filtered != tt.expectedFiltered {
				t.Errorf("FilterOutUnits() filtered %d, want %d", filtered, tt.expectedFiltered)
			}

			// Get remaining IDs
			remaining := make([]string, 0, len(db.Units))
			for id := range db.Units {
				remaining = append(remaining, id)
			}
			sort.Strings(remaining)

			if len(remaining) != len(tt.expectedRemain) {
				t.Errorf("After FilterOutUnits(), %d units remain, want %d", len(remaining), len(tt.expectedRemain))
				return
			}

			for i, id := range remaining {
				if id != tt.expectedRemain[i] {
					t.Errorf("Remaining unit[%d] = %q, want %q", i, id, tt.expectedRemain[i])
				}
			}
		})
	}
}

// TestAddonFilteringIncludesFactionAgnosticUnits verifies that faction-agnostic units
// (like commanders that don't have Custom58 type) are properly included in base game
// comparison sets. This was a bug where commanders slipped through addon filtering
// because they weren't in the faction-filtered comparison set.
func TestAddonFilteringIncludesFactionAgnosticUnits(t *testing.T) {
	// Simulate base game units - mix of faction-specific and faction-agnostic
	baseGameUnits := map[string]*models.Unit{
		// MLA faction units (have Custom58)
		"tank": {
			ID:        "tank",
			UnitTypes: []string{"Custom58", "Land", "Tank", "Mobile"},
		},
		"bot": {
			ID:        "bot",
			UnitTypes: []string{"Custom58", "Land", "Bot", "Mobile"},
		},
		// Commander - faction-agnostic (NO Custom58 type)
		"commander": {
			ID:        "commander",
			UnitTypes: []string{"Commander", "Mobile", "Land"},
		},
		// Another faction-agnostic unit
		"control_module": {
			ID:        "control_module",
			UnitTypes: []string{"Structure", "Land"},
		},
	}

	// Simulate addon mod units - includes shadowed base game units + new units
	addonUnits := map[string]*models.Unit{
		// Shadowed base game units (should be filtered out)
		"tank": {
			ID:        "tank",
			UnitTypes: []string{"Custom58", "Land", "Tank", "Mobile"},
		},
		"bot": {
			ID:        "bot",
			UnitTypes: []string{"Custom58", "Land", "Bot", "Mobile"},
		},
		// Shadowed commander (should ALSO be filtered out - this was the bug!)
		"commander": {
			ID:        "commander",
			UnitTypes: []string{"Commander", "Mobile", "Land"},
		},
		// Shadowed faction-agnostic unit
		"control_module": {
			ID:        "control_module",
			UnitTypes: []string{"Structure", "Land"},
		},
		// NEW addon unit (should remain)
		"addon_super_tank": {
			ID:        "addon_super_tank",
			UnitTypes: []string{"Custom58", "Land", "Tank", "Mobile"},
		},
	}

	t.Run("faction-filtered comparison misses commanders (the bug)", func(t *testing.T) {
		// This demonstrates the OLD buggy behavior:
		// If we only include faction-filtered units in comparison, commanders slip through

		baseDB := &Database{Units: baseGameUnits}

		// Build comparison set WITH faction filter (buggy approach)
		factionFilteredIDs := make(map[string]bool)
		for id, unit := range baseDB.Units {
			if unitMatchesFactionType(unit, "Custom58") {
				factionFilteredIDs[id] = true
			}
		}

		// This should NOT include commander (no Custom58 type)
		if factionFilteredIDs["commander"] {
			t.Error("Faction-filtered set should NOT include commander (no Custom58 type)")
		}

		// Verify tank and bot ARE included
		if !factionFilteredIDs["tank"] || !factionFilteredIDs["bot"] {
			t.Error("Faction-filtered set should include tank and bot")
		}

		// Now filter addon units with the buggy comparison set
		addonDB := &Database{Units: copyUnits(addonUnits)}
		addonDB.FilterOutUnits(factionFilteredIDs)

		// BUG: Commander would still be in addon units!
		if _, exists := addonDB.Units["commander"]; !exists {
			t.Error("With faction-filtered comparison, commander should slip through (demonstrating the bug)")
		}
	})

	t.Run("unfiltered comparison includes commanders (the fix)", func(t *testing.T) {
		// This demonstrates the FIXED behavior:
		// Using all base game units for comparison catches commanders

		baseDB := &Database{Units: baseGameUnits}

		// Build comparison set WITHOUT faction filter (fixed approach)
		allBaseIDs := baseDB.GetUnitIDs()

		// This SHOULD include commander
		if !allBaseIDs["commander"] {
			t.Error("Unfiltered set should include commander")
		}

		// Also includes faction-specific units
		if !allBaseIDs["tank"] || !allBaseIDs["bot"] {
			t.Error("Unfiltered set should include tank and bot")
		}

		// Now filter addon units with the correct comparison set
		addonDB := &Database{Units: copyUnits(addonUnits)}
		filtered := addonDB.FilterOutUnits(allBaseIDs)

		// Commander should be filtered out
		if _, exists := addonDB.Units["commander"]; exists {
			t.Error("With unfiltered comparison, commander should be filtered out")
		}

		// Only addon_super_tank should remain
		if len(addonDB.Units) != 1 {
			t.Errorf("Expected 1 unit remaining, got %d", len(addonDB.Units))
		}

		if _, exists := addonDB.Units["addon_super_tank"]; !exists {
			t.Error("addon_super_tank should remain after filtering")
		}

		if filtered != 4 {
			t.Errorf("Expected 4 units filtered, got %d", filtered)
		}
	})
}

// copyUnits creates a deep copy of a units map for testing
func copyUnits(units map[string]*models.Unit) map[string]*models.Unit {
	copy := make(map[string]*models.Unit, len(units))
	for k, v := range units {
		unitCopy := *v
		copy[k] = &unitCopy
	}
	return copy
}
