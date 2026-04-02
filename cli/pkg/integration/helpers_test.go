package integration_test

import (
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// testdataDir returns the absolute path to the cli/testdata directory.
func testdataDir(t *testing.T) string {
	t.Helper()
	// This file is at cli/pkg/integration/helpers_test.go
	// testdata is at cli/testdata/
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to get caller info")
	}
	return filepath.Join(filepath.Dir(filename), "..", "..", "testdata")
}

// paRootPath returns the absolute path to the test PA media root.
func paRootPath(t *testing.T) string {
	t.Helper()
	return filepath.Join(testdataDir(t), "pa_root")
}

// dataRootPath returns the absolute path to the test PA data root.
func dataRootPath(t *testing.T) string {
	t.Helper()
	return filepath.Join(testdataDir(t), "data_root")
}

// profilesPath returns the absolute path to the test profiles directory.
func profilesPath(t *testing.T) string {
	t.Helper()
	return filepath.Join(testdataDir(t), "profiles")
}

// loadMetadata reads and unmarshals metadata.json from a faction output directory.
func loadMetadata(t *testing.T, factionDir string) models.FactionMetadata {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(factionDir, "metadata.json"))
	if err != nil {
		t.Fatalf("failed to read metadata.json: %v", err)
	}
	var metadata models.FactionMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		t.Fatalf("failed to unmarshal metadata.json: %v", err)
	}
	return metadata
}

// loadIndex reads and unmarshals units.json from a faction output directory.
func loadIndex(t *testing.T, factionDir string) models.FactionIndex {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(factionDir, "units.json"))
	if err != nil {
		t.Fatalf("failed to read units.json: %v", err)
	}
	var index models.FactionIndex
	if err := json.Unmarshal(data, &index); err != nil {
		t.Fatalf("failed to unmarshal units.json: %v", err)
	}
	return index
}

// findUnit looks up a unit by identifier in a FactionIndex.
// Returns nil if not found.
func findUnit(index models.FactionIndex, id string) *models.UnitIndexEntry {
	for i := range index.Units {
		if index.Units[i].Identifier == id {
			return &index.Units[i]
		}
	}
	return nil
}

// assertFileExists fails the test if the given path does not exist.
func assertFileExists(t *testing.T, path string) {
	t.Helper()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Errorf("expected file to exist: %s", path)
	}
}

// assertFileNotExists fails the test if the given path exists.
func assertFileNotExists(t *testing.T, path string) {
	t.Helper()
	if _, err := os.Stat(path); err == nil {
		t.Errorf("expected file to NOT exist: %s", path)
	}
}

// createMinimalPNG creates a 1x1 transparent PNG file at the given path.
// Creates parent directories as needed.
func createMinimalPNG(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatalf("failed to create directory for PNG: %v", err)
	}
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("failed to create PNG file: %v", err)
	}
	defer f.Close()

	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.Transparent)
	if err := png.Encode(f, img); err != nil {
		t.Fatalf("failed to encode PNG: %v", err)
	}
}

// setupIconFixtures creates all the minimal PNG icon files needed by the test fixtures.
// Call this in TestMain or at the start of tests that need icons.
func setupIconFixtures(t *testing.T) {
	t.Helper()
	td := testdataDir(t)

	icons := []string{
		// Base game icons
		"pa_root/pa/units/commanders/test_commander/test_commander_icon_buildbar.png",
		"pa_root/pa/units/land/test_tank/test_tank_icon_buildbar.png",
		"pa_root/pa/units/land/test_factory/test_factory_icon_buildbar.png",
		"pa_root/pa/units/land/test_mex/test_mex_icon_buildbar.png",
		"pa_root/pa/units/air/test_fighter/test_fighter_icon_buildbar.png",
		// Mod faction icons
		"data_root/server_mods/com.test.mod/pa/units/commanders/mod_commander/mod_commander_icon_buildbar.png",
		"data_root/server_mods/com.test.mod/pa/units/land/mod_tank/mod_tank_icon_buildbar.png",
		"data_root/server_mods/com.test.mod/pa/units/land/mod_factory/mod_factory_icon_buildbar.png",
		// Addon icons
		"data_root/server_mods/com.test.addon/pa/units/land/addon_artillery/addon_artillery_icon_buildbar.png",
		"data_root/server_mods/com.test.addon/pa/units/land/addon_turret/addon_turret_icon_buildbar.png",
	}

	for _, icon := range icons {
		createMinimalPNG(t, filepath.Join(td, icon))
	}
}
