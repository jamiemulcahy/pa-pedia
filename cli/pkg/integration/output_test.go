package integration_test

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
)

// exportBaseGameFaction exports the base game faction to the given output directory.
func exportBaseGameFaction(t *testing.T, outputDir string) string {
	t.Helper()
	setupIconFixtures(t)
	paRoot := paRootPath(t)

	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}
	defer l.Close()

	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, "TestBase", false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	profile := &models.FactionProfile{
		ID:              "test-base",
		DisplayName:     "Test Base Game",
		FactionUnitType: "TestBase",
		Version:         "1.0.0",
		Author:          "Test Author",
	}
	metadata, err := exporter.CreateMetadataFromProfile(profile, nil)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}

	exp := exporter.NewFactionExporter(outputDir, l, false)
	if err := exp.ExportFaction(metadata, db.GetUnitsArray()); err != nil {
		t.Fatalf("failed: %v", err)
	}

	return filepath.Join(outputDir, exporter.SanitizeFolderName("Test Base Game"))
}

// TestBaseGameOutputStructure validates the complete output structure for a base game faction.
func TestBaseGameOutputStructure(t *testing.T) {
	outputDir := t.TempDir()
	factionDir := exportBaseGameFaction(t, outputDir)

	// Core files
	assertFileExists(t, filepath.Join(factionDir, "metadata.json"))
	assertFileExists(t, filepath.Join(factionDir, "units.json"))
	assertFileExists(t, filepath.Join(factionDir, "assets"))

	// Asset structure should mirror PA paths
	expectedAssets := []string{
		"assets/pa/units/commanders/test_commander/test_commander.json",
		"assets/pa/units/commanders/test_commander/test_commander_icon_buildbar.png",
		"assets/pa/units/land/test_tank/test_tank.json",
		"assets/pa/units/land/test_tank/test_tank_icon_buildbar.png",
		"assets/pa/units/land/test_factory/test_factory.json",
		"assets/pa/units/land/test_factory/test_factory_icon_buildbar.png",
		"assets/pa/units/land/test_mex/test_mex.json",
		"assets/pa/units/land/test_mex/test_mex_icon_buildbar.png",
		"assets/pa/units/air/test_fighter/test_fighter.json",
		"assets/pa/units/air/test_fighter/test_fighter_icon_buildbar.png",
	}

	for _, asset := range expectedAssets {
		assertFileExists(t, filepath.Join(factionDir, asset))
	}
}

// TestModFactionOutputStructure validates the output structure for a mod faction.
func TestModFactionOutputStructure(t *testing.T) {
	setupIconFixtures(t)
	paRoot := paRootPath(t)
	dataRoot := dataRootPath(t)
	outputDir := t.TempDir()

	allMods, _ := loader.FindAllMods(dataRoot, false)
	modInfo := allMods["com.test.mod"]

	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", []*loader.ModInfo{modInfo})
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	defer l.Close()

	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, "TestMod", false); err != nil {
		t.Fatalf("failed: %v", err)
	}

	profile := &models.FactionProfile{
		ID:              "test-mod",
		DisplayName:     "Test Mod Faction",
		FactionUnitType: "TestMod",
		Mods:            []string{"com.test.mod"},
	}
	metadata, err := exporter.CreateMetadataFromProfile(profile, []*loader.ModInfo{modInfo})
	if err != nil {
		t.Fatalf("failed: %v", err)
	}

	exp := exporter.NewFactionExporter(outputDir, l, false)
	if err := exp.ExportFaction(metadata, db.GetUnitsArray()); err != nil {
		t.Fatalf("failed: %v", err)
	}

	factionDir := filepath.Join(outputDir, exporter.SanitizeFolderName("Test Mod Faction"))

	assertFileExists(t, filepath.Join(factionDir, "metadata.json"))
	assertFileExists(t, filepath.Join(factionDir, "units.json"))
	assertFileExists(t, filepath.Join(factionDir, "assets"))

	meta := loadMetadata(t, factionDir)
	if meta.Type != "mod" {
		t.Errorf("metadata type = %q, want %q", meta.Type, "mod")
	}

	index := loadIndex(t, factionDir)
	if len(index.Units) != 3 {
		t.Errorf("expected 3 mod units, got %d", len(index.Units))
	}
}

// TestAddonOutputStructure validates the output structure for an addon faction.
func TestAddonOutputStructure(t *testing.T) {
	setupIconFixtures(t)
	paRoot := paRootPath(t)
	dataRoot := dataRootPath(t)
	outputDir := t.TempDir()

	allMods, _ := loader.FindAllMods(dataRoot, false)
	addonInfo := allMods["com.test.addon"]

	addonLoader, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", []*loader.ModInfo{addonInfo})
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	defer addonLoader.Close()

	addonDB := parser.NewDatabase(addonLoader)
	addonDB.LoadUnitsNoFilter(false)

	baseLoader, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	defer baseLoader.Close()

	baseDB := parser.NewDatabase(baseLoader)
	baseDB.LoadUnitsNoFilter(false)
	addonDB.FilterOutUnits(baseDB.GetUnitIDs())

	profile := &models.FactionProfile{
		ID:          "test-addon",
		DisplayName: "Test Addon",
		IsAddon:     true,
		Mods:        []string{"com.test.addon"},
	}
	metadata, err := exporter.CreateMetadataFromProfile(profile, []*loader.ModInfo{addonInfo})
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	metadata.IsAddon = true

	exp := exporter.NewFactionExporter(outputDir, addonLoader, false)
	if err := exp.ExportFaction(metadata, addonDB.GetUnitsArray()); err != nil {
		t.Fatalf("failed: %v", err)
	}

	factionDir := filepath.Join(outputDir, exporter.SanitizeFolderName("Test Addon"))

	assertFileExists(t, filepath.Join(factionDir, "metadata.json"))
	assertFileExists(t, filepath.Join(factionDir, "units.json"))

	meta := loadMetadata(t, factionDir)
	if !meta.IsAddon {
		t.Error("metadata.isAddon should be true")
	}

	index := loadIndex(t, factionDir)
	if len(index.Units) != 2 {
		t.Errorf("expected 2 addon units, got %d", len(index.Units))
	}
}

// TestOutputSchemaValidity tests that output JSON cleanly unmarshals into model structs.
func TestOutputSchemaValidity(t *testing.T) {
	outputDir := t.TempDir()
	factionDir := exportBaseGameFaction(t, outputDir)

	// Metadata should unmarshal cleanly
	metaData, _ := os.ReadFile(filepath.Join(factionDir, "metadata.json"))
	var metadata models.FactionMetadata
	if err := json.Unmarshal(metaData, &metadata); err != nil {
		t.Errorf("metadata.json failed to unmarshal to FactionMetadata: %v", err)
	}

	// units.json should unmarshal cleanly
	indexData, _ := os.ReadFile(filepath.Join(factionDir, "units.json"))
	var index models.FactionIndex
	if err := json.Unmarshal(indexData, &index); err != nil {
		t.Errorf("units.json failed to unmarshal to FactionIndex: %v", err)
	}

	// Each unit entry should have required fields populated
	for _, entry := range index.Units {
		if entry.Identifier == "" {
			t.Error("unit entry has empty identifier")
		}
		if entry.DisplayName == "" {
			t.Errorf("unit %q has empty displayName", entry.Identifier)
		}
		if len(entry.UnitTypes) == 0 {
			t.Errorf("unit %q has empty unitTypes", entry.Identifier)
		}
		if entry.Source == "" {
			t.Errorf("unit %q has empty source", entry.Identifier)
		}
		if entry.Unit.ID == "" {
			t.Errorf("unit %q has empty embedded unit ID", entry.Identifier)
		}
		if entry.Unit.Specs.Combat == nil {
			t.Errorf("unit %q has nil combat specs", entry.Identifier)
		}
	}
}

// TestOutputDeterminism tests that the same input produces identical output.
func TestOutputDeterminism(t *testing.T) {
	dir1 := t.TempDir()
	dir2 := t.TempDir()

	factionDir1 := exportBaseGameFaction(t, dir1)
	factionDir2 := exportBaseGameFaction(t, dir2)

	// Compare metadata.json
	meta1, _ := os.ReadFile(filepath.Join(factionDir1, "metadata.json"))
	meta2, _ := os.ReadFile(filepath.Join(factionDir2, "metadata.json"))
	if !bytes.Equal(meta1, meta2) {
		t.Error("metadata.json is not deterministic between runs")
	}

	// Compare units.json
	index1, _ := os.ReadFile(filepath.Join(factionDir1, "units.json"))
	index2, _ := os.ReadFile(filepath.Join(factionDir2, "units.json"))
	if !bytes.Equal(index1, index2) {
		t.Error("units.json is not deterministic between runs")
	}
}
