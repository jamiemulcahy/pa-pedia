package parser

import (
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
