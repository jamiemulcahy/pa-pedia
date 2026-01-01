package exporter

import (
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
)

// TestShouldSkipSpecFileForAddon tests the addon spec file filtering logic
// For addon mods, spec files from base game sources should be skipped
// unless they are the unit's primary JSON file
func TestShouldSkipSpecFileForAddon(t *testing.T) {
	tests := []struct {
		name             string
		isAddon          bool
		resourcePath     string
		unitResourceName string
		specSource       string
		shouldSkip       bool
	}{
		{
			name:             "addon: skip base game spec dependency",
			isAddon:          true,
			resourcePath:     "/pa/tools/commander_build_arm/commander_build_arm.json",
			unitResourceName: "/pa/units/land/addon_tank/addon_tank.json",
			specSource:       "pa",
			shouldSkip:       true,
		},
		{
			name:             "addon: skip expansion spec dependency",
			isAddon:          true,
			resourcePath:     "/pa/units/commanders/base_commander/base_commander.json",
			unitResourceName: "/pa/units/land/addon_tank/addon_tank.json",
			specSource:       "pa_ex1",
			shouldSkip:       true,
		},
		{
			name:             "addon: keep unit's own primary JSON even from base path",
			isAddon:          true,
			resourcePath:     "/pa/units/land/addon_tank/addon_tank.json",
			unitResourceName: "/pa/units/land/addon_tank/addon_tank.json",
			specSource:       "pa.mla.unit.addon",
			shouldSkip:       false,
		},
		{
			name:             "addon: keep mod-sourced spec files",
			isAddon:          true,
			resourcePath:     "/pa/units/land/addon_tank/addon_tank_weapon.json",
			unitResourceName: "/pa/units/land/addon_tank/addon_tank.json",
			specSource:       "pa.mla.unit.addon",
			shouldSkip:       false,
		},
		{
			name:             "non-addon: keep all base game spec files",
			isAddon:          false,
			resourcePath:     "/pa/tools/commander_build_arm/commander_build_arm.json",
			unitResourceName: "/pa/units/land/tank/tank.json",
			specSource:       "pa",
			shouldSkip:       false,
		},
		{
			name:             "non-addon: keep expansion spec files",
			isAddon:          false,
			resourcePath:     "/pa/units/commanders/base_commander/base_commander.json",
			unitResourceName: "/pa/units/land/tank/tank.json",
			specSource:       "pa_ex1",
			shouldSkip:       false,
		},
		{
			name:             "addon: don't skip primary JSON even if from base game source",
			isAddon:          true,
			resourcePath:     "/pa/units/land/addon_tank/addon_tank.json",
			unitResourceName: "/pa/units/land/addon_tank/addon_tank.json",
			specSource:       "pa", // Even if source reports as pa (shouldn't happen but test anyway)
			shouldSkip:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			specInfo := &loader.SpecFileInfo{
				ResourcePath: tt.resourcePath,
				Source:       tt.specSource,
			}

			result := shouldSkipSpecFileForAddon(tt.isAddon, tt.resourcePath, tt.unitResourceName, specInfo)
			if result != tt.shouldSkip {
				t.Errorf("shouldSkipSpecFileForAddon(isAddon=%v, resourcePath=%q, unitResource=%q, source=%q) = %v, want %v",
					tt.isAddon, tt.resourcePath, tt.unitResourceName, tt.specSource, result, tt.shouldSkip)
			}
		})
	}
}

// TestSanitizeFolderName tests folder name sanitization
func TestSanitizeFolderName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple name",
			input:    "MLA",
			expected: "MLA",
		},
		{
			name:     "name with spaces",
			input:    "Second Wave",
			expected: "Second-Wave",
		},
		{
			name:     "name with special characters",
			input:    "Legion (Expansion)",
			expected: "Legion-Expansion",
		},
		{
			name:     "name with multiple spaces",
			input:    "My  Cool  Faction",
			expected: "My-Cool-Faction",
		},
		{
			name:     "name with underscores",
			input:    "my_faction",
			expected: "my_faction",
		},
		{
			name:     "name with leading/trailing special chars",
			input:    "---Faction---",
			expected: "Faction",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeFolderName(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeFolderName(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
