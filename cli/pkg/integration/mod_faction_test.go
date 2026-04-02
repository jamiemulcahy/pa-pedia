package integration_test

import (
	"path/filepath"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
)

// loadModFaction creates a loader with the test mod and base game, then loads and filters units.
func loadModFaction(t *testing.T) (*loader.Loader, *parser.Database) {
	t.Helper()
	paRoot := paRootPath(t)
	dataRoot := dataRootPath(t)

	// Discover local mods
	allMods, err := loader.FindAllMods(dataRoot, false)
	if err != nil {
		t.Fatalf("failed to discover mods: %v", err)
	}

	modInfo, ok := allMods["com.test.mod"]
	if !ok {
		t.Fatal("com.test.mod not found in test data_root")
	}

	// Create loader with mod (highest priority) + base game
	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", []*loader.ModInfo{modInfo})
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}

	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, "TestMod", false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	return l, db
}

// TestModFactionExtraction tests the full pipeline for a mod faction (like Legion).
func TestModFactionExtraction(t *testing.T) {
	setupIconFixtures(t)

	l, db := loadModFaction(t)
	defer l.Close()

	units := db.GetUnitsArray()
	outputDir := t.TempDir()

	// The mod faction should have 3 units: mod_commander, mod_tank, mod_factory
	// The shadowed test_tank should be excluded (it has UNITTYPE_TestBase, not TestMod)
	if len(units) != 3 {
		t.Errorf("expected 3 mod faction units, got %d", len(units))
		for _, u := range units {
			t.Logf("  unit: %s (%s) types=%v", u.ID, u.DisplayName, u.UnitTypes)
		}
	}

	// Create metadata with mod info
	allMods, _ := loader.FindAllMods(dataRootPath(t), false)
	modInfo := allMods["com.test.mod"]

	profile := &models.FactionProfile{
		ID:              "test-mod",
		DisplayName:     "Test Mod Faction",
		FactionUnitType: "TestMod",
		Mods:            []string{"com.test.mod"},
	}

	metadata, err := exporter.CreateMetadataFromProfile(profile, []*loader.ModInfo{modInfo})
	if err != nil {
		t.Fatalf("failed to create metadata: %v", err)
	}

	exp := exporter.NewFactionExporter(outputDir, l, false)
	if err := exp.ExportFaction(metadata, units); err != nil {
		t.Fatalf("failed to export faction: %v", err)
	}

	factionDir := filepath.Join(outputDir, exporter.SanitizeFolderName("Test Mod Faction"))
	meta := loadMetadata(t, factionDir)

	if meta.Type != "mod" {
		t.Errorf("metadata type = %q, want %q", meta.Type, "mod")
	}
	if meta.Version != "2.5.0" {
		t.Errorf("metadata version = %q, want %q (from modinfo.json)", meta.Version, "2.5.0")
	}
	if meta.Author != "Test Mod Author" {
		t.Errorf("metadata author = %q, want %q (from modinfo.json)", meta.Author, "Test Mod Author")
	}

	index := loadIndex(t, factionDir)
	if len(index.Units) != 3 {
		t.Errorf("expected 3 units in index, got %d", len(index.Units))
	}

	// Verify mod-specific units are present
	expectedUnits := []string{"mod_commander", "mod_tank", "mod_factory"}
	for _, id := range expectedUnits {
		if entry := findUnit(index, id); entry == nil {
			t.Errorf("expected unit %q in index", id)
		}
	}
}

// TestModOverlay tests that mod files override base game files at the same path.
// The mod's test_tank.json (health=300) should override the expansion's test_tank.json (health=250).
func TestModOverlay(t *testing.T) {
	paRoot := paRootPath(t)
	dataRoot := dataRootPath(t)

	allMods, err := loader.FindAllMods(dataRoot, false)
	if err != nil {
		t.Fatalf("failed to discover mods: %v", err)
	}
	modInfo := allMods["com.test.mod"]

	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", []*loader.ModInfo{modInfo})
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}
	defer l.Close()

	// Load ALL units (no filter) to see the overlayed test_tank
	db := parser.NewDatabase(l)
	if err := db.LoadUnitsNoFilter(false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	// test_tank should have the MOD's stats (health=300), not expansion (250) or base (200)
	tank, ok := db.Units["test_tank"]
	if !ok {
		t.Fatal("test_tank not found")
	}

	if tank.Specs.Combat.Health != 300 {
		t.Errorf("test_tank health = %v, want 300 (mod version); expansion=250, base=200", tank.Specs.Combat.Health)
	}
	if tank.Specs.Economy.BuildCost != 175 {
		t.Errorf("test_tank build cost = %v, want 175 (mod version)", tank.Specs.Economy.BuildCost)
	}
}

// TestModFactionFiltering tests that faction filtering correctly separates mod units
// from shadowed base game units in the same source.
func TestModFactionFiltering(t *testing.T) {
	l, db := loadModFaction(t)
	defer l.Close()

	// Only TestMod units should be loaded
	for id, unit := range db.Units {
		hasTestMod := false
		for _, ut := range unit.UnitTypes {
			if ut == "TestMod" {
				hasTestMod = true
				break
			}
		}
		if !hasTestMod {
			t.Errorf("unit %q loaded but doesn't have UNITTYPE_TestMod: %v", id, unit.UnitTypes)
		}
	}

	// test_tank (which has UNITTYPE_TestBase) should NOT be present
	if _, ok := db.Units["test_tank"]; ok {
		t.Error("test_tank should be excluded (it has UNITTYPE_TestBase, not TestMod)")
	}
}

// TestModBuildTree tests that the mod faction has its own build tree.
func TestModBuildTree(t *testing.T) {
	l, db := loadModFaction(t)
	defer l.Close()

	// Mod commander should build mod factory and mod tank
	commander, ok := db.Units["mod_commander"]
	if !ok {
		t.Fatal("mod_commander not found")
	}
	if !commander.Accessible {
		t.Error("mod_commander should be accessible")
	}

	builds := make(map[string]bool)
	for _, id := range commander.BuildRelationships.Builds {
		builds[id] = true
	}
	if !builds["mod_factory"] {
		t.Error("mod_commander should build mod_factory (Structure)")
	}
	if !builds["mod_tank"] {
		t.Error("mod_commander should build mod_tank (Mobile)")
	}

	// Mod factory should build mod tank (Mobile & Basic & Land)
	factory, ok := db.Units["mod_factory"]
	if !ok {
		t.Fatal("mod_factory not found")
	}
	factoryBuilds := make(map[string]bool)
	for _, id := range factory.BuildRelationships.Builds {
		factoryBuilds[id] = true
	}
	if !factoryBuilds["mod_tank"] {
		t.Error("mod_factory should build mod_tank")
	}

	// All mod units should be accessible
	for id, unit := range db.Units {
		if !unit.Accessible {
			t.Errorf("mod unit %q should be accessible", id)
		}
	}
}

// TestModMetadataAutoDetection tests that metadata is auto-detected from modinfo.json.
func TestModMetadataAutoDetection(t *testing.T) {
	dataRoot := dataRootPath(t)

	allMods, err := loader.FindAllMods(dataRoot, false)
	if err != nil {
		t.Fatalf("failed to discover mods: %v", err)
	}
	modInfo := allMods["com.test.mod"]

	// Version, author, description should come from modinfo.json
	if modInfo.Version != "2.5.0" {
		t.Errorf("mod version = %q, want %q", modInfo.Version, "2.5.0")
	}
	if modInfo.Author != "Test Mod Author" {
		t.Errorf("mod author = %q, want %q", modInfo.Author, "Test Mod Author")
	}
	if modInfo.Description != "A test mod that adds a new faction." {
		t.Errorf("mod description = %q, want %q", modInfo.Description, "A test mod that adds a new faction.")
	}
	if modInfo.Build != "124615" {
		t.Errorf("mod build = %q, want %q", modInfo.Build, "124615")
	}

	// Profile without version should use mod's version
	profile := &models.FactionProfile{
		ID:              "test-mod",
		DisplayName:     "Test Mod Faction",
		FactionUnitType: "TestMod",
		Mods:            []string{"com.test.mod"},
	}

	metadata, err := exporter.CreateMetadataFromProfile(profile, []*loader.ModInfo{modInfo})
	if err != nil {
		t.Fatalf("failed to create metadata: %v", err)
	}

	if metadata.Version != "2.5.0" {
		t.Errorf("metadata version = %q, want %q (auto-detected from mod)", metadata.Version, "2.5.0")
	}
	if metadata.Author != "Test Mod Author" {
		t.Errorf("metadata author = %q, want %q (auto-detected from mod)", metadata.Author, "Test Mod Author")
	}
}
