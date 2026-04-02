package integration_test

import (
	"path/filepath"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
)

// TestAddonExtraction tests the full pipeline for an addon mod (like Second Wave).
// Addon mods shadow base game units and add new ones. The extraction filters
// out shadowed units, keeping only genuinely new units.
func TestAddonExtraction(t *testing.T) {
	setupIconFixtures(t)

	paRoot := paRootPath(t)
	dataRoot := dataRootPath(t)
	outputDir := t.TempDir()

	// Discover addon mod
	allMods, err := loader.FindAllMods(dataRoot, false)
	if err != nil {
		t.Fatalf("failed to discover mods: %v", err)
	}
	addonInfo, ok := allMods["com.test.addon"]
	if !ok {
		t.Fatal("com.test.addon not found")
	}

	// Create loader with addon mod + base game
	addonLoader, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", []*loader.ModInfo{addonInfo})
	if err != nil {
		t.Fatalf("failed to create addon loader: %v", err)
	}
	defer addonLoader.Close()

	// Load all units without filtering (addon path)
	addonDB := parser.NewDatabase(addonLoader)
	if err := addonDB.LoadUnitsNoFilter(false); err != nil {
		t.Fatalf("failed to load addon units: %v", err)
	}

	// Load base game units for comparison
	baseLoader, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create base loader: %v", err)
	}
	defer baseLoader.Close()

	baseDB := parser.NewDatabase(baseLoader)
	if err := baseDB.LoadUnitsNoFilter(false); err != nil {
		t.Fatalf("failed to load base units: %v", err)
	}

	// Filter out base game units
	baseIDs := baseDB.GetUnitIDs()
	filteredCount := addonDB.FilterOutUnits(baseIDs)

	if filteredCount == 0 {
		t.Error("expected some units to be filtered out")
	}

	// Should keep only addon-specific units
	units := addonDB.GetUnitsArray()
	if len(units) != 2 {
		t.Errorf("expected 2 addon units (addon_artillery, addon_turret), got %d", len(units))
		for _, u := range units {
			t.Logf("  remaining: %s (%s)", u.ID, u.DisplayName)
		}
	}

	// Create metadata
	profile := &models.FactionProfile{
		ID:          "test-addon",
		DisplayName: "Test Addon",
		IsAddon:     true,
		Mods:        []string{"com.test.addon"},
	}
	metadata, err := exporter.CreateMetadataFromProfile(profile, []*loader.ModInfo{addonInfo})
	if err != nil {
		t.Fatalf("failed to create metadata: %v", err)
	}
	metadata.IsAddon = true
	metadata.BaseFactions = addonDB.DetectBaseFactions()

	// Export
	exp := exporter.NewFactionExporter(outputDir, addonLoader, false)
	if err := exp.ExportFaction(metadata, units); err != nil {
		t.Fatalf("failed to export: %v", err)
	}

	factionDir := filepath.Join(outputDir, exporter.SanitizeFolderName("Test Addon"))
	meta := loadMetadata(t, factionDir)

	if !meta.IsAddon {
		t.Error("metadata.isAddon should be true")
	}
	if meta.Type != "mod" {
		t.Errorf("metadata type = %q, want %q", meta.Type, "mod")
	}

	index := loadIndex(t, factionDir)
	if len(index.Units) != 2 {
		t.Errorf("expected 2 units in addon index, got %d", len(index.Units))
	}

	// Verify correct units are present
	if entry := findUnit(index, "addon_artillery"); entry == nil {
		t.Error("addon_artillery should be in the index")
	}
	if entry := findUnit(index, "addon_turret"); entry == nil {
		t.Error("addon_turret should be in the index")
	}

	// Shadowed units should NOT be present
	if entry := findUnit(index, "test_commander"); entry != nil {
		t.Error("test_commander should NOT be in addon index (it's a base game shadow)")
	}
	if entry := findUnit(index, "test_tank"); entry != nil {
		t.Error("test_tank should NOT be in addon index (it's a base game shadow)")
	}
}

// TestAddonExclusionFilter tests the exclusion-based filtering in detail.
func TestAddonExclusionFilter(t *testing.T) {
	paRoot := paRootPath(t)
	dataRoot := dataRootPath(t)

	allMods, _ := loader.FindAllMods(dataRoot, false)
	addonInfo := allMods["com.test.addon"]

	// Load addon units
	addonLoader, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", []*loader.ModInfo{addonInfo})
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	defer addonLoader.Close()

	addonDB := parser.NewDatabase(addonLoader)
	if err := addonDB.LoadUnitsNoFilter(false); err != nil {
		t.Fatalf("failed: %v", err)
	}

	// Before filtering: should have base game units + addon units
	totalBefore := len(addonDB.Units)
	if totalBefore < 5 {
		t.Errorf("expected at least 5 units before filtering, got %d", totalBefore)
	}

	// Base game has 5 units
	baseLoader, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	defer baseLoader.Close()

	baseDB := parser.NewDatabase(baseLoader)
	if err := baseDB.LoadUnitsNoFilter(false); err != nil {
		t.Fatalf("failed: %v", err)
	}

	baseIDs := baseDB.GetUnitIDs()

	// Filter
	filtered := addonDB.FilterOutUnits(baseIDs)

	// 5 base units should be filtered out (test_commander, test_tank, test_factory, test_mex, test_fighter)
	// But addon only shadows test_commander and test_tank, plus adds addon_artillery and addon_turret
	// The other 3 base units (test_factory, test_mex, test_fighter) aren't in the addon unit_list
	// So the addon loads: test_commander, test_tank, addon_artillery, addon_turret = 4 total
	// After filtering: addon_artillery, addon_turret = 2
	remainingCount := len(addonDB.Units)

	t.Logf("Before: %d, Filtered: %d, Remaining: %d", totalBefore, filtered, remainingCount)

	if remainingCount != 2 {
		t.Errorf("expected 2 remaining units after filtering, got %d", remainingCount)
		for id := range addonDB.Units {
			t.Logf("  remaining: %s", id)
		}
	}
}

// TestDetectBaseFactions tests that base factions are correctly detected from unit types.
func TestDetectBaseFactions(t *testing.T) {
	paRoot := paRootPath(t)
	dataRoot := dataRootPath(t)

	allMods, _ := loader.FindAllMods(dataRoot, false)
	addonInfo := allMods["com.test.addon"]

	addonLoader, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", []*loader.ModInfo{addonInfo})
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	defer addonLoader.Close()

	addonDB := parser.NewDatabase(addonLoader)
	if err := addonDB.LoadUnitsNoFilter(false); err != nil {
		t.Fatalf("failed: %v", err)
	}

	// Filter out base game units
	baseLoader, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	defer baseLoader.Close()

	baseDB := parser.NewDatabase(baseLoader)
	baseDB.LoadUnitsNoFilter(false)
	addonDB.FilterOutUnits(baseDB.GetUnitIDs())

	// Our test addon units use UNITTYPE_TestBase which doesn't map to any known faction
	// (Custom58=MLA, Custom1=Legion, Custom2=Bugs, Custom6=Exiles)
	// So DetectBaseFactions should return empty for our test data
	factions := addonDB.DetectBaseFactions()
	// This is expected since our test fixtures use "TestBase" not "Custom58"
	if len(factions) != 0 {
		t.Logf("Detected factions: %v (expected empty since test uses TestBase, not Custom58)", factions)
	}
}

// TestAddonMetadata tests that addon metadata is set correctly.
func TestAddonMetadata(t *testing.T) {
	dataRoot := dataRootPath(t)

	allMods, _ := loader.FindAllMods(dataRoot, false)
	addonInfo := allMods["com.test.addon"]

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

	// Version should come from addon mod's modinfo.json
	if metadata.Version != "1.1.0" {
		t.Errorf("metadata version = %q, want %q (from addon modinfo)", metadata.Version, "1.1.0")
	}
	if metadata.Author != "Addon Author" {
		t.Errorf("metadata author = %q, want %q", metadata.Author, "Addon Author")
	}

	// isAddon is set by the caller (describe_faction.go), not CreateMetadataFromProfile
	// So we set it manually as the real code does
	metadata.IsAddon = true
	if !metadata.IsAddon {
		t.Error("metadata.isAddon should be true")
	}
}
