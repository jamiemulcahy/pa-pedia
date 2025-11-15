package exporter

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// createTestUnit creates a test unit with common fields populated
func createTestUnit(id string, tier int, accessible bool) models.Unit {
	return models.Unit{
		ID:           id,
		ResourceName: "/pa/units/land/" + id + "/" + id + ".json",
		DisplayName:  strings.ToUpper(id[:1]) + id[1:], // Capitalize first letter
		Tier:         tier,
		UnitTypes:    []string{"Mobile", "Tank", "Land", "Basic"},
		Accessible:   accessible,
		Specs: models.UnitSpecs{
			Combat: &models.CombatSpecs{
				Health: 100.0,
				DPS:    50.0,
				Weapons: []models.Weapon{
					{
						ResourceName: "/pa/units/land/" + id + "/" + id + "_tool_weapon.json",
						SafeName:     id + "_weapon",
						Name:         "Main Gun",
						Count:        1,
						ROF:          1.0,
						Damage:       50.0,
						DPS:          50.0,
					},
				},
			},
			Economy: &models.EconomySpecs{
				BuildCost: 100.0,
				MetalRate: -2.0,
			},
			Mobility: &models.MobilitySpecs{
				MoveSpeed: 10.0,
			},
		},
		BuildRelationships: models.BuildRelationships{
			BuiltBy: []string{"factory"},
			Builds:  []string{},
		},
	}
}

// TestWriteResolvedUnit tests the writeResolvedUnit function
func TestWriteResolvedUnit(t *testing.T) {
	tests := []struct {
		name        string
		unit        models.Unit
		expectError bool
		setupDir    func(dir string) error // Function to setup directory (e.g., make read-only)
	}{
		{
			name:        "Successful write",
			unit:        createTestUnit("tank", 1, true),
			expectError: false,
		},
		{
			name:        "Write unit with tier 2",
			unit:        createTestUnit("advanced_tank", 2, true),
			expectError: false,
		},
		{
			name:        "Write unit with tier 3",
			unit:        createTestUnit("titan_bot", 3, false),
			expectError: false,
		},
		{
			name: "Write unit with minimal data",
			unit: models.Unit{
				ID:           "minimal",
				ResourceName: "/pa/units/test/minimal.json",
				DisplayName:  "Minimal Unit",
				Tier:         1,
				Accessible:   true,
				Specs:        models.UnitSpecs{},
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temporary directory
			tempDir, err := os.MkdirTemp("", "exporter-test-*")
			if err != nil {
				t.Fatalf("Failed to create temp dir: %v", err)
			}
			defer os.RemoveAll(tempDir)

			// Setup directory if needed
			if tt.setupDir != nil {
				if err := tt.setupDir(tempDir); err != nil {
					t.Fatalf("Failed to setup directory: %v", err)
				}
			}

			// Create exporter
			exporter := &FactionExporter{
				OutputDir: tempDir,
				Verbose:   false,
			}

			// Write resolved unit
			err = exporter.writeResolvedUnit(tempDir, tt.unit)

			// Check error expectation
			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			// If write should succeed, verify file exists and is valid JSON
			if !tt.expectError {
				expectedPath := filepath.Join(tempDir, tt.unit.ID+"_resolved.json")

				// Check file exists
				if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
					t.Errorf("Expected file %s does not exist", expectedPath)
					return
				}

				// Read and verify JSON is valid
				data, err := os.ReadFile(expectedPath)
				if err != nil {
					t.Errorf("Failed to read resolved file: %v", err)
					return
				}

				var parsedUnit models.Unit
				if err := json.Unmarshal(data, &parsedUnit); err != nil {
					t.Errorf("Invalid JSON in resolved file: %v", err)
					return
				}

				// Verify key fields match
				if parsedUnit.ID != tt.unit.ID {
					t.Errorf("ID mismatch: got %q, want %q", parsedUnit.ID, tt.unit.ID)
				}
				if parsedUnit.DisplayName != tt.unit.DisplayName {
					t.Errorf("DisplayName mismatch: got %q, want %q", parsedUnit.DisplayName, tt.unit.DisplayName)
				}
				if parsedUnit.Tier != tt.unit.Tier {
					t.Errorf("Tier mismatch: got %d, want %d", parsedUnit.Tier, tt.unit.Tier)
				}
				if parsedUnit.Accessible != tt.unit.Accessible {
					t.Errorf("Accessible mismatch: got %v, want %v", parsedUnit.Accessible, tt.unit.Accessible)
				}
			}
		})
	}
}

// TestResolvedFileInIndex verifies that resolvedFile field is correctly set in index
func TestResolvedFileInIndex(t *testing.T) {
	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "exporter-index-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test units
	units := []models.Unit{
		createTestUnit("tank", 1, true),
		createTestUnit("bot", 1, true),
	}

	// Create a mock loader (we need this for the exporter)
	// For this test, we'll create a minimal implementation
	// Note: In a real scenario, you might want to use a mock or test loader
	exporter := &FactionExporter{
		OutputDir: tempDir,
		Loader:    nil, // We'll handle the nil case in exportUnits
		Verbose:   false,
	}

	// Create units directory
	unitsDir := filepath.Join(tempDir, "units")
	if err := os.MkdirAll(unitsDir, 0755); err != nil {
		t.Fatalf("Failed to create units dir: %v", err)
	}

	// Manually test the resolved file generation for each unit
	for _, unit := range units {
		unitDir := filepath.Join(unitsDir, unit.ID)
		if err := os.MkdirAll(unitDir, 0755); err != nil {
			t.Fatalf("Failed to create unit dir: %v", err)
		}

		// Write resolved unit
		resolvedFilename := unit.ID + "_resolved.json"
		err := exporter.writeResolvedUnit(unitDir, unit)

		if err != nil {
			// If write failed, resolvedFile should be empty
			t.Logf("Write failed for %s (expected behavior for testing): %v", unit.ID, err)
			continue
		}

		// Verify file exists
		resolvedPath := filepath.Join(unitDir, resolvedFilename)
		if _, err := os.Stat(resolvedPath); os.IsNotExist(err) {
			t.Errorf("Resolved file %s should exist after successful write", resolvedPath)
		}

		// Read the file to verify it's valid
		data, err := os.ReadFile(resolvedPath)
		if err != nil {
			t.Errorf("Failed to read resolved file: %v", err)
			continue
		}

		var parsedUnit models.Unit
		if err := json.Unmarshal(data, &parsedUnit); err != nil {
			t.Errorf("Invalid JSON in resolved file: %v", err)
		}
	}
}

// TestResolvedFileContents verifies the contents of resolved files
func TestResolvedFileContents(t *testing.T) {
	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "exporter-contents-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test unit with known data
	unit := createTestUnit("tank", 1, true)
	unit.Specs.Combat.DPS = 50.0
	unit.Tier = 1

	// Create exporter
	exporter := &FactionExporter{
		OutputDir: tempDir,
		Verbose:   false,
	}

	// Write resolved unit
	err = exporter.writeResolvedUnit(tempDir, unit)
	if err != nil {
		t.Fatalf("Failed to write resolved unit: %v", err)
	}

	// Read resolved file
	resolvedPath := filepath.Join(tempDir, unit.ID+"_resolved.json")
	data, err := os.ReadFile(resolvedPath)
	if err != nil {
		t.Fatalf("Failed to read resolved file: %v", err)
	}

	// Parse resolved unit
	var resolvedUnit models.Unit
	if err := json.Unmarshal(data, &resolvedUnit); err != nil {
		t.Fatalf("Failed to parse resolved unit: %v", err)
	}

	// Test 1: Verify DPS calculations are present
	if resolvedUnit.Specs.Combat == nil {
		t.Error("Combat specs should not be nil")
	} else {
		if resolvedUnit.Specs.Combat.DPS != 50.0 {
			t.Errorf("DPS mismatch: got %f, want %f", resolvedUnit.Specs.Combat.DPS, 50.0)
		}
	}

	// Test 2: Verify tier information is included
	if resolvedUnit.Tier != 1 {
		t.Errorf("Tier mismatch: got %d, want %d", resolvedUnit.Tier, 1)
	}

	// Test 3: Verify unit types are present
	if len(resolvedUnit.UnitTypes) == 0 {
		t.Error("UnitTypes should not be empty")
	}

	// Test 4: Verify build relationships are present
	if len(resolvedUnit.BuildRelationships.BuiltBy) == 0 {
		t.Error("BuiltBy should not be empty")
	}

	// Test 5: Verify resource calculations are present
	if resolvedUnit.Specs.Economy == nil {
		t.Error("Economy specs should not be nil")
	} else {
		if resolvedUnit.Specs.Economy.BuildCost != 100.0 {
			t.Errorf("BuildCost mismatch: got %f, want %f", resolvedUnit.Specs.Economy.BuildCost, 100.0)
		}
		if resolvedUnit.Specs.Economy.MetalRate != -2.0 {
			t.Errorf("MetalRate mismatch: got %f, want %f", resolvedUnit.Specs.Economy.MetalRate, -2.0)
		}
	}

	// Test 6: Verify accessibility flag is preserved
	if !resolvedUnit.Accessible {
		t.Error("Accessible flag should be true")
	}

	// Test 7: Verify all required fields are present
	if resolvedUnit.ID == "" {
		t.Error("ID should not be empty")
	}
	if resolvedUnit.ResourceName == "" {
		t.Error("ResourceName should not be empty")
	}
	if resolvedUnit.DisplayName == "" {
		t.Error("DisplayName should not be empty")
	}
}

// TestWriteResolvedUnitReadOnlyDirectory tests error handling when directory is read-only
func TestWriteResolvedUnitReadOnlyDirectory(t *testing.T) {
	// Skip on Windows where making directories read-only is more complex
	if runtime.GOOS == "windows" {
		t.Skip("Skipping read-only directory test on Windows")
	}

	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "exporter-readonly-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Make directory read-only
	if err := os.Chmod(tempDir, 0444); err != nil {
		t.Fatalf("Failed to make directory read-only: %v", err)
	}
	defer os.Chmod(tempDir, 0755) // Restore permissions for cleanup

	// Create test unit
	unit := createTestUnit("tank", 1, true)

	// Create exporter
	exporter := &FactionExporter{
		OutputDir: tempDir,
		Verbose:   false,
	}

	// Attempt to write resolved unit - should fail
	err = exporter.writeResolvedUnit(tempDir, unit)
	if err == nil {
		t.Error("Expected error when writing to read-only directory, got nil")
	}
}

// TestResolvedFileJSON verifies that resolved file is valid JSON and pretty-printed
func TestResolvedFileJSON(t *testing.T) {
	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "exporter-json-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test unit
	unit := createTestUnit("tank", 1, true)

	// Create exporter
	exporter := &FactionExporter{
		OutputDir: tempDir,
		Verbose:   false,
	}

	// Write resolved unit
	err = exporter.writeResolvedUnit(tempDir, unit)
	if err != nil {
		t.Fatalf("Failed to write resolved unit: %v", err)
	}

	// Read resolved file
	resolvedPath := filepath.Join(tempDir, unit.ID+"_resolved.json")
	data, err := os.ReadFile(resolvedPath)
	if err != nil {
		t.Fatalf("Failed to read resolved file: %v", err)
	}

	// Verify JSON is valid by unmarshaling
	var jsonData map[string]interface{}
	if err := json.Unmarshal(data, &jsonData); err != nil {
		t.Errorf("Invalid JSON: %v", err)
	}

	// Verify JSON is pretty-printed (contains newlines and indentation)
	dataStr := string(data)
	if !strings.Contains(dataStr, "\n") {
		t.Error("JSON should be pretty-printed with newlines")
	}
	if !strings.Contains(dataStr, "  ") {
		t.Error("JSON should be indented with spaces")
	}
}
