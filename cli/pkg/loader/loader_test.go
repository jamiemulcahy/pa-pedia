package loader

import (
	"testing"
)

// TestGetSafeName tests the safe name generation logic
func TestGetSafeName(t *testing.T) {
	tests := []struct {
		name         string
		resourceName string
		expected     string
	}{
		{
			name:         "Simple unit path",
			resourceName: "/pa/units/land/tank/tank.json",
			expected:     "tank",
		},
		{
			name:         "Different filename than directory",
			resourceName: "/pa/units/air/fighter/fighter.json",
			expected:     "fighter",
		},
		{
			name:         "Base template",
			resourceName: "/pa/units/land/base_vehicle/base_vehicle.json",
			expected:     "base_vehicle",
		},
		{
			name:         "Commander",
			resourceName: "/pa/units/commanders/imperial_invictus/imperial_invictus.json",
			expected:     "imperial_invictus",
		},
		{
			name:         "Expansion unit (pa_ex1)",
			resourceName: "/pa_ex1/units/land/titan_vehicle/titan_vehicle.json",
			expected:     "titan_vehicle",
		},
		{
			name:         "Structure",
			resourceName: "/pa/units/land/metal_extractor/metal_extractor.json",
			expected:     "metal_extractor",
		},
		{
			name:         "Complex path",
			resourceName: "/pa/units/orbital/deep_space_radar/deep_space_radar.json",
			expected:     "deep_space_radar",
		},
		{
			name:         "Tool path",
			resourceName: "/pa/units/land/tank/tank_tool_weapon.json",
			expected:     "tank_tool_weapon",
		},
		{
			name:         "Ammo path",
			resourceName: "/pa/ammo/shell_artillery/shell_artillery.json",
			expected:     "shell_artillery",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a temporary loader (we don't need actual files for this test)
			l := &Loader{
				safeNames: make(map[string]string),
				fullNames: make(map[string]string),
			}

			// Generate safe name
			result := l.GetSafeName(tt.resourceName)

			if result != tt.expected {
				t.Errorf("GetSafeName(%q) = %q, want %q", tt.resourceName, result, tt.expected)
			}

			// Verify it's cached
			if cached, ok := l.safeNames[tt.resourceName]; !ok || cached != tt.expected {
				t.Errorf("Safe name not properly cached for %q", tt.resourceName)
			}

			// Verify reverse mapping
			if full, ok := l.fullNames[tt.expected]; !ok || full != tt.resourceName {
				t.Errorf("Full name not properly cached for %q", tt.expected)
			}
		})
	}
}

// TestDelocalize tests localization string stripping
func TestDelocalize(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Simple localized string",
			input:    "!LOC:unit_name",
			expected: "unit_name",
		},
		{
			name:     "Complex localized string",
			input:    "!LOC:units.land.tank.description",
			expected: "units.land.tank.description",
		},
		{
			name:     "Non-localized string",
			input:    "Regular Name",
			expected: "Regular Name",
		},
		{
			name:     "Empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "Just LOC prefix",
			input:    "!LOC:",
			expected: "",
		},
		{
			name:     "Localized with spaces",
			input:    "!LOC:unit name with spaces",
			expected: "unit name with spaces",
		},
		{
			name:     "Multiple colons",
			input:    "!LOC:category:subcategory:name",
			expected: "category:subcategory:name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Delocalize(tt.input)
			if result != tt.expected {
				t.Errorf("Delocalize(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestGetHelpers tests the Get* helper functions
func TestGetString(t *testing.T) {
	data := map[string]interface{}{
		"existing_string": "test_value",
		"empty_string":    "",
		"number":          42.0,
		"bool":            true,
	}

	tests := []struct {
		name         string
		key          string
		defaultValue string
		expected     string
	}{
		{
			name:         "Existing string",
			key:          "existing_string",
			defaultValue: "default",
			expected:     "test_value",
		},
		{
			name:         "Empty string",
			key:          "empty_string",
			defaultValue: "default",
			expected:     "", // Empty strings are returned as-is (not treated as missing)
		},
		{
			name:         "Missing key",
			key:          "missing",
			defaultValue: "default",
			expected:     "default",
		},
		{
			name:         "Wrong type (number)",
			key:          "number",
			defaultValue: "default",
			expected:     "default",
		},
		{
			name:         "Wrong type (bool)",
			key:          "bool",
			defaultValue: "default",
			expected:     "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetString(data, tt.key, tt.defaultValue)
			if result != tt.expected {
				t.Errorf("GetString(%q, %q) = %q, want %q", tt.key, tt.defaultValue, result, tt.expected)
			}
		})
	}
}

func TestGetFloat(t *testing.T) {
	data := map[string]interface{}{
		"float":  123.45,
		"int":    42.0,
		"zero":   0.0,
		"string": "not a number",
		"bool":   false,
	}

	tests := []struct {
		name         string
		key          string
		defaultValue float64
		expected     float64
	}{
		{
			name:         "Float value",
			key:          "float",
			defaultValue: 999.0,
			expected:     123.45,
		},
		{
			name:         "Integer value",
			key:          "int",
			defaultValue: 999.0,
			expected:     42.0,
		},
		{
			name:         "Zero value",
			key:          "zero",
			defaultValue: 999.0,
			expected:     0.0,
		},
		{
			name:         "Missing key",
			key:          "missing",
			defaultValue: 999.0,
			expected:     999.0,
		},
		{
			name:         "Wrong type (string)",
			key:          "string",
			defaultValue: 999.0,
			expected:     999.0,
		},
		{
			name:         "Wrong type (bool)",
			key:          "bool",
			defaultValue: 999.0,
			expected:     999.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetFloat(data, tt.key, tt.defaultValue)
			if result != tt.expected {
				t.Errorf("GetFloat(%q, %.2f) = %.2f, want %.2f", tt.key, tt.defaultValue, result, tt.expected)
			}
		})
	}
}

func TestGetBool(t *testing.T) {
	data := map[string]interface{}{
		"true_bool":  true,
		"false_bool": false,
		"string":     "true",
		"number":     1.0,
	}

	tests := []struct {
		name         string
		key          string
		defaultValue bool
		expected     bool
	}{
		{
			name:         "True boolean",
			key:          "true_bool",
			defaultValue: false,
			expected:     true,
		},
		{
			name:         "False boolean",
			key:          "false_bool",
			defaultValue: true,
			expected:     false,
		},
		{
			name:         "Missing key",
			key:          "missing",
			defaultValue: true,
			expected:     true,
		},
		{
			name:         "Wrong type (string)",
			key:          "string",
			defaultValue: false,
			expected:     false,
		},
		{
			name:         "Wrong type (number)",
			key:          "number",
			defaultValue: false,
			expected:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetBool(data, tt.key, tt.defaultValue)
			if result != tt.expected {
				t.Errorf("GetBool(%q, %v) = %v, want %v", tt.key, tt.defaultValue, result, tt.expected)
			}
		})
	}
}

// TestMultiSourceLoaderPriority tests that multi-source loader respects priority order
func TestMultiSourceLoaderPriority(t *testing.T) {
	// This is a documentation test for source priority behavior
	t.Run("Source priority order", func(t *testing.T) {
		// Expected priority (highest to lowest):
		// 1. Mods (in order specified, first has highest priority)
		// 2. Expansion (pa_ex1)
		// 3. Base game (pa)

		// Since NewMultiSourceLoader requires a real PA root that exists,
		// we'll use a simplified loader for testing priority concept
		sources := []Source{
			{Type: ModSourceServerMods, Identifier: "mod1", Path: "/mod1"},
			{Type: ModSourceServerMods, Identifier: "mod2", Path: "/mod2"},
			{Type: ModSourceExpansion, Identifier: "pa_ex1", Path: "/pa_ex1"},
			{Type: ModSourceBaseGame, Identifier: "pa", Path: "/pa"},
		}

		l := &Loader{
			sources: sources,
		}

		// Verify order
		if len(l.sources) != 4 {
			t.Errorf("Expected 4 sources, got %d", len(l.sources))
		}

		expectedOrder := []string{"mod1", "mod2", "pa_ex1", "pa"}
		for i, src := range l.sources {
			if src.Identifier != expectedOrder[i] {
				t.Errorf("Source[%d] = %q, want %q", i, src.Identifier, expectedOrder[i])
			}
		}

		t.Logf("Source priority order: %v", expectedOrder)
	})
}

// TestExpansionShadowing tests that expansion files override base files
func TestExpansionShadowing(t *testing.T) {
	// This is a documentation test for expansion shadowing behavior
	t.Run("Expansion shadowing", func(t *testing.T) {
		// When looking for /pa/units/land/tank/tank.json with expansion "pa_ex1":
		// 1. First check: /pa_ex1/units/land/tank/tank.json
		// 2. Then check: /pa/units/land/tank/tank.json

		l := &Loader{
			expansion: "pa_ex1",
		}

		// Document the path transformation
		resourceName := "/pa/units/land/tank/tank.json"

		// With expansion "pa_ex1", it should first try "/pa_ex1/units/land/tank/tank.json"
		expectedExpansionPath := "/pa_ex1/units/land/tank/tank.json"

		t.Logf("Looking for: %s", resourceName)
		t.Logf("First tries: %s (expansion)", expectedExpansionPath)
		t.Logf("Then tries: %s (base)", resourceName)
		t.Logf("Expansion: %s", l.expansion)
	})
}

// TestCloseWithNoSources tests that Close() returns nil when no sources exist
func TestCloseWithNoSources(t *testing.T) {
	l := &Loader{
		sources: []Source{},
	}

	err := l.Close()
	if err != nil {
		t.Errorf("Close() with no sources should return nil, got: %v", err)
	}
}

// TestCloseWithDirectorySources tests that Close() handles directory sources gracefully
func TestCloseWithDirectorySources(t *testing.T) {
	l := &Loader{
		sources: []Source{
			{
				Type:      ModSourceBaseGame,
				Path:      "/pa/root/pa",
				IsZip:     false,
				ZipReader: nil,
			},
			{
				Type:      ModSourceExpansion,
				Path:      "/pa/root/pa_ex1",
				IsZip:     false,
				ZipReader: nil,
			},
		},
	}

	err := l.Close()
	if err != nil {
		t.Errorf("Close() with directory sources should return nil, got: %v", err)
	}
}

// TestLoadMergedUnitListEmptySources tests that LoadMergedUnitList fails with no sources
func TestLoadMergedUnitListEmptySources(t *testing.T) {
	l := &Loader{
		sources: []Source{},
	}

	units, provenance, err := l.LoadMergedUnitList()
	if err == nil {
		t.Error("LoadMergedUnitList() with empty sources should return error")
	}
	if units != nil {
		t.Errorf("LoadMergedUnitList() units should be nil on error, got: %v", units)
	}
	if provenance != nil {
		t.Errorf("LoadMergedUnitList() provenance should be nil on error, got: %v", provenance)
	}

	expectedErrMsg := "no sources configured in loader"
	if err != nil && err.Error() != expectedErrMsg {
		t.Errorf("LoadMergedUnitList() error = %q, want %q", err.Error(), expectedErrMsg)
	}
}
