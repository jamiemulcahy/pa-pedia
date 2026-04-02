package integration_test

import (
	"path/filepath"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
)

// TestBaseGameExtraction tests the full pipeline for a base game faction:
// load from pa_root -> parse -> filter -> build tree -> export -> validate output.
func TestBaseGameExtraction(t *testing.T) {
	setupIconFixtures(t)

	paRoot := paRootPath(t)
	outputDir := t.TempDir()

	// Create loader (base game only, no mods)
	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}
	defer l.Close()

	// Parse units with faction filtering
	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, "TestBase", false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	units := db.GetUnitsArray()
	if len(units) == 0 {
		t.Fatal("expected units to be loaded, got 0")
	}

	// Create metadata
	profile := &models.FactionProfile{
		ID:              "test-base",
		DisplayName:     "Test Base Game",
		FactionUnitType: "TestBase",
		Version:         "1.0.0",
		Author:          "Test Author",
	}
	metadata, err := exporter.CreateMetadataFromProfile(profile, nil)
	if err != nil {
		t.Fatalf("failed to create metadata: %v", err)
	}

	// Export
	exp := exporter.NewFactionExporter(outputDir, l, false)
	if err := exp.ExportFaction(metadata, units); err != nil {
		t.Fatalf("failed to export faction: %v", err)
	}

	// Validate output
	factionDir := filepath.Join(outputDir, exporter.SanitizeFolderName("Test Base Game"))
	assertFileExists(t, filepath.Join(factionDir, "metadata.json"))
	assertFileExists(t, filepath.Join(factionDir, "units.json"))
	assertFileExists(t, filepath.Join(factionDir, "assets"))

	// Validate metadata
	meta := loadMetadata(t, factionDir)
	if meta.DisplayName != "Test Base Game" {
		t.Errorf("metadata displayName = %q, want %q", meta.DisplayName, "Test Base Game")
	}
	if meta.Type != "base-game" {
		t.Errorf("metadata type = %q, want %q", meta.Type, "base-game")
	}
	if meta.Version != "1.0.0" {
		t.Errorf("metadata version = %q, want %q", meta.Version, "1.0.0")
	}

	// Validate units index
	index := loadIndex(t, factionDir)
	if len(index.Units) != 5 {
		t.Errorf("expected 5 units in index, got %d", len(index.Units))
	}

	// Check that expected units are present
	expectedUnits := []string{"test_commander", "test_tank", "test_factory", "test_mex", "test_fighter"}
	for _, id := range expectedUnits {
		if entry := findUnit(index, id); entry == nil {
			t.Errorf("expected unit %q in index", id)
		}
	}

	// Verify commander has correct embedded data
	commander := findUnit(index, "test_commander")
	if commander == nil {
		t.Fatal("test_commander not found in index")
	}
	if commander.Unit.Specs.Combat.Health != 12500 {
		t.Errorf("commander health = %v, want 12500", commander.Unit.Specs.Combat.Health)
	}
	if commander.Unit.DisplayName != "Test Commander" {
		t.Errorf("commander displayName = %q, want %q", commander.Unit.DisplayName, "Test Commander")
	}
}

// TestExpansionShadowing tests that pa_ex1/ files take priority over pa/ files.
// The expansion tank has max_health=250, while the base game tank has max_health=200.
func TestExpansionShadowing(t *testing.T) {
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

	// The tank should have the expansion's stats (250 health), not the base game's (200 health)
	tank, ok := db.Units["test_tank"]
	if !ok {
		t.Fatal("test_tank not found in parsed units")
	}

	if tank.Specs.Combat.Health != 250 {
		t.Errorf("tank health = %v, want 250 (expansion version); got base game value if 200", tank.Specs.Combat.Health)
	}
	if tank.Specs.Economy.BuildCost != 160 {
		t.Errorf("tank build cost = %v, want 160 (expansion version)", tank.Specs.Economy.BuildCost)
	}
}

// TestBaseSpecInheritance tests that units correctly inherit from base templates.
// test_tank has base_spec pointing to base_bot.json and should inherit mobility.
func TestBaseSpecInheritance(t *testing.T) {
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

	tank, ok := db.Units["test_tank"]
	if !ok {
		t.Fatal("test_tank not found")
	}

	// Tank should inherit mobility from base_bot (move_speed=20, turn_speed=180)
	if tank.Specs.Mobility.MoveSpeed != 20 {
		t.Errorf("tank move_speed = %v, want 20 (inherited from base_bot)", tank.Specs.Mobility.MoveSpeed)
	}
	if tank.Specs.Mobility.TurnSpeed != 180 {
		t.Errorf("tank turn_speed = %v, want 180 (inherited from base_bot)", tank.Specs.Mobility.TurnSpeed)
	}

	// Tank should override health from base_bot (base=100, tank expansion=250)
	if tank.Specs.Combat.Health != 250 {
		t.Errorf("tank health = %v, want 250 (overridden from base_bot's 100)", tank.Specs.Combat.Health)
	}

	// Tank should have its own display name, not the base's
	if tank.DisplayName != "Test Tank" {
		t.Errorf("tank displayName = %q, want %q", tank.DisplayName, "Test Tank")
	}
}

// TestBuildTree tests that the build tree is constructed correctly:
// - Commander can build things matching "Mobile | Structure"
// - Factory can build things matching "Mobile & Basic & Land"
// - Units are marked as accessible when reachable from commander
func TestBuildTree(t *testing.T) {
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

	// Commander should be accessible (it's a commander)
	commander, ok := db.Units["test_commander"]
	if !ok {
		t.Fatal("test_commander not found")
	}
	if !commander.Accessible {
		t.Error("commander should be accessible")
	}

	// Commander builds "Mobile | Structure" - should include factory, tank, fighter, mex
	if len(commander.BuildRelationships.Builds) == 0 {
		t.Error("commander should have units it can build")
	}
	commanderBuilds := make(map[string]bool)
	for _, id := range commander.BuildRelationships.Builds {
		commanderBuilds[id] = true
	}
	// Factory is a Structure, so commander should build it
	if !commanderBuilds["test_factory"] {
		t.Error("commander should be able to build test_factory (Structure)")
	}
	// Tank is Mobile, so commander should build it
	if !commanderBuilds["test_tank"] {
		t.Error("commander should be able to build test_tank (Mobile)")
	}
	// Mex is a Structure, so commander should build it
	if !commanderBuilds["test_mex"] {
		t.Error("commander should be able to build test_mex (Structure)")
	}

	// Factory builds "Mobile & Basic & Land" - should include tank but not fighter (Air)
	factory, ok := db.Units["test_factory"]
	if !ok {
		t.Fatal("test_factory not found")
	}
	factoryBuilds := make(map[string]bool)
	for _, id := range factory.BuildRelationships.Builds {
		factoryBuilds[id] = true
	}
	if !factoryBuilds["test_tank"] {
		t.Error("factory should be able to build test_tank (Mobile & Basic & Land)")
	}
	if factoryBuilds["test_fighter"] {
		t.Error("factory should NOT be able to build test_fighter (Air, not Land)")
	}

	// Tank should know it's built by factory
	tank, ok := db.Units["test_tank"]
	if !ok {
		t.Fatal("test_tank not found")
	}
	tankBuiltBy := make(map[string]bool)
	for _, id := range tank.BuildRelationships.BuiltBy {
		tankBuiltBy[id] = true
	}
	if !tankBuiltBy["test_factory"] {
		t.Error("tank should be built by test_factory")
	}

	// All units should be accessible (reachable from commander)
	for id, unit := range db.Units {
		if !unit.Accessible {
			t.Errorf("unit %q should be accessible (reachable from commander)", id)
		}
	}
}

// TestFactionFiltering tests that only units with the correct faction type are included.
func TestFactionFiltering(t *testing.T) {
	paRoot := paRootPath(t)

	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}
	defer l.Close()

	// Load with "TestBase" faction type
	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, "TestBase", false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	// All loaded units should have TestBase in their unit types
	for id, unit := range db.Units {
		hasTestBase := false
		for _, ut := range unit.UnitTypes {
			if ut == "TestBase" {
				hasTestBase = true
				break
			}
		}
		if !hasTestBase {
			t.Errorf("unit %q loaded but doesn't have UNITTYPE_TestBase: %v", id, unit.UnitTypes)
		}
	}

	// Loading with a non-existent faction type should produce an error
	l2, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create second loader: %v", err)
	}
	defer l2.Close()

	db2 := parser.NewDatabase(l2)
	err = db2.LoadUnits(false, "NonExistentFaction", false)
	if err == nil {
		t.Error("expected error when loading with non-existent faction type, got nil")
	}
}

// TestIconDiscovery tests that unit icons are discovered and exported to the correct asset paths.
func TestIconDiscovery(t *testing.T) {
	setupIconFixtures(t)

	paRoot := paRootPath(t)
	outputDir := t.TempDir()

	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}
	defer l.Close()

	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, "TestBase", false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	units := db.GetUnitsArray()

	profile := &models.FactionProfile{
		ID:              "test-base",
		DisplayName:     "Test Base Game",
		FactionUnitType: "TestBase",
		Version:         "1.0.0",
	}
	metadata, err := exporter.CreateMetadataFromProfile(profile, nil)
	if err != nil {
		t.Fatalf("failed to create metadata: %v", err)
	}

	exp := exporter.NewFactionExporter(outputDir, l, false)
	if err := exp.ExportFaction(metadata, units); err != nil {
		t.Fatalf("failed to export faction: %v", err)
	}

	factionDir := filepath.Join(outputDir, exporter.SanitizeFolderName("Test Base Game"))

	// Check that icons were copied to the assets directory
	expectedIcons := []struct {
		unitID string
		path   string
	}{
		{"test_commander", "assets/pa/units/commanders/test_commander/test_commander_icon_buildbar.png"},
		{"test_tank", "assets/pa/units/land/test_tank/test_tank_icon_buildbar.png"},
		{"test_factory", "assets/pa/units/land/test_factory/test_factory_icon_buildbar.png"},
		{"test_mex", "assets/pa/units/land/test_mex/test_mex_icon_buildbar.png"},
		{"test_fighter", "assets/pa/units/air/test_fighter/test_fighter_icon_buildbar.png"},
	}

	for _, expected := range expectedIcons {
		iconPath := filepath.Join(factionDir, expected.path)
		assertFileExists(t, iconPath)
	}
}
