package integration_test

import (
	"path/filepath"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
	"github.com/jamiemulcahy/pa-pedia/pkg/profiles"
)

// TestProfileLoading tests loading profiles from the test profiles directory.
func TestProfileLoading(t *testing.T) {
	pl, err := profiles.NewLoader()
	if err != nil {
		t.Fatalf("failed to create profile loader: %v", err)
	}

	if err := pl.LoadLocalProfiles(profilesPath(t)); err != nil {
		t.Fatalf("failed to load local profiles: %v", err)
	}

	// Base game profile
	base, err := pl.GetProfile("test-base")
	if err != nil {
		t.Fatalf("failed to get test-base profile: %v", err)
	}
	if base.DisplayName != "Test Base Game" {
		t.Errorf("base displayName = %q, want %q", base.DisplayName, "Test Base Game")
	}
	if base.FactionUnitType != "TestBase" {
		t.Errorf("base factionUnitType = %q, want %q", base.FactionUnitType, "TestBase")
	}

	// Mod faction profile
	mod, err := pl.GetProfile("test-mod")
	if err != nil {
		t.Fatalf("failed to get test-mod profile: %v", err)
	}
	if mod.DisplayName != "Test Mod Faction" {
		t.Errorf("mod displayName = %q, want %q", mod.DisplayName, "Test Mod Faction")
	}
	if len(mod.Mods) != 1 || mod.Mods[0] != "com.test.mod" {
		t.Errorf("mod.Mods = %v, want [com.test.mod]", mod.Mods)
	}

	// Addon profile
	addon, err := pl.GetProfile("test-addon")
	if err != nil {
		t.Fatalf("failed to get test-addon profile: %v", err)
	}
	if !addon.IsAddon {
		t.Error("addon.IsAddon should be true")
	}
	if len(addon.Mods) != 1 || addon.Mods[0] != "com.test.addon" {
		t.Errorf("addon.Mods = %v, want [com.test.addon]", addon.Mods)
	}
}

// TestProfileLocalOverride tests that local profiles override embedded profiles.
func TestProfileLocalOverride(t *testing.T) {
	pl, err := profiles.NewLoader()
	if err != nil {
		t.Fatalf("failed to create profile loader: %v", err)
	}

	// Verify embedded MLA profile exists
	mla, err := pl.GetProfile("mla")
	if err != nil {
		t.Fatalf("embedded MLA profile should exist: %v", err)
	}
	if mla.FactionUnitType != "Custom58" {
		t.Errorf("embedded MLA factionUnitType = %q, want Custom58", mla.FactionUnitType)
	}

	// Loading local profiles should add new profiles without breaking embedded ones
	if err := pl.LoadLocalProfiles(profilesPath(t)); err != nil {
		t.Fatalf("failed to load local profiles: %v", err)
	}

	// Embedded profiles should still be accessible
	mla2, err := pl.GetProfile("mla")
	if err != nil {
		t.Fatalf("embedded MLA profile should still exist after loading local profiles: %v", err)
	}
	if mla2.FactionUnitType != "Custom58" {
		t.Errorf("embedded MLA still has factionUnitType = %q, want Custom58", mla2.FactionUnitType)
	}

	// Local profiles should also be accessible
	_, err = pl.GetProfile("test-base")
	if err != nil {
		t.Errorf("local test-base profile should be accessible: %v", err)
	}
}

// TestInvalidProfiles tests that invalid profile configurations are rejected.
func TestInvalidProfiles(t *testing.T) {
	pl, err := profiles.NewLoader()
	if err != nil {
		t.Fatalf("failed to create profile loader: %v", err)
	}

	// Loading profiles directory with invalid profile should fail
	invalidDir := filepath.Join(testdataDir(t), "profiles-invalid")
	err = pl.LoadLocalProfiles(invalidDir)
	if err == nil {
		t.Error("expected error loading profiles with invalid-no-name.json (missing displayName)")
	}
}

// TestVersionFlagOverride tests that the --version flag overrides profile version.
func TestVersionFlagOverride(t *testing.T) {
	// Profile with version="1.0.0"
	profile := &models.FactionProfile{
		ID:              "test-base",
		DisplayName:     "Test Base Game",
		FactionUnitType: "TestBase",
		Version:         "1.0.0",
	}

	// Simulate --version flag override (this is how describe_faction.go applies it)
	profile.Version = "9.9.9"

	metadata, err := exporter.CreateMetadataFromProfile(profile, nil)
	if err != nil {
		t.Fatalf("failed to create metadata: %v", err)
	}

	if metadata.Version != "9.9.9" {
		t.Errorf("metadata version = %q, want %q (overridden)", metadata.Version, "9.9.9")
	}
}

// TestMetadataCreation tests version precedence and auto-detection.
func TestMetadataCreation(t *testing.T) {
	t.Run("profile version takes priority over mod version", func(t *testing.T) {
		profile := &models.FactionProfile{
			ID:              "test",
			DisplayName:     "Test",
			FactionUnitType: "TestBase",
			Version:         "3.0.0",
			Mods:            []string{"com.test.mod"},
		}
		modInfo := &loader.ModInfo{
			Identifier: "com.test.mod",
			Version:    "2.5.0",
			Author:     "Mod Author",
		}

		metadata, err := exporter.CreateMetadataFromProfile(profile, []*loader.ModInfo{modInfo})
		if err != nil {
			t.Fatalf("failed: %v", err)
		}
		if metadata.Version != "3.0.0" {
			t.Errorf("version = %q, want %q (profile takes priority)", metadata.Version, "3.0.0")
		}
	})

	t.Run("mod version used when profile has no version", func(t *testing.T) {
		profile := &models.FactionProfile{
			ID:              "test",
			DisplayName:     "Test",
			FactionUnitType: "TestBase",
			Mods:            []string{"com.test.mod"},
		}
		modInfo := &loader.ModInfo{
			Identifier: "com.test.mod",
			Version:    "2.5.0",
		}

		metadata, err := exporter.CreateMetadataFromProfile(profile, []*loader.ModInfo{modInfo})
		if err != nil {
			t.Fatalf("failed: %v", err)
		}
		if metadata.Version != "2.5.0" {
			t.Errorf("version = %q, want %q (from mod)", metadata.Version, "2.5.0")
		}
	})

	t.Run("error when no version available", func(t *testing.T) {
		profile := &models.FactionProfile{
			ID:              "test",
			DisplayName:     "Test",
			FactionUnitType: "TestBase",
		}

		_, err := exporter.CreateMetadataFromProfile(profile, nil)
		if err == nil {
			t.Error("expected error when no version available, got nil")
		}
	})

	t.Run("profile author overrides mod author", func(t *testing.T) {
		profile := &models.FactionProfile{
			ID:              "test",
			DisplayName:     "Test",
			FactionUnitType: "TestBase",
			Version:         "1.0.0",
			Author:          "Profile Author",
			Mods:            []string{"com.test.mod"},
		}
		modInfo := &loader.ModInfo{
			Identifier: "com.test.mod",
			Author:     "Mod Author",
		}

		metadata, err := exporter.CreateMetadataFromProfile(profile, []*loader.ModInfo{modInfo})
		if err != nil {
			t.Fatalf("failed: %v", err)
		}
		if metadata.Author != "Profile Author" {
			t.Errorf("author = %q, want %q (profile overrides mod)", metadata.Author, "Profile Author")
		}
	})
}

// TestErrorZeroUnits tests behavior when no units match the faction type.
func TestErrorZeroUnits(t *testing.T) {
	paRoot := paRootPath(t)

	t.Run("error without allow-empty", func(t *testing.T) {
		l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
		if err != nil {
			t.Fatalf("failed to create loader: %v", err)
		}
		defer l.Close()

		db := parser.NewDatabase(l)
		err = db.LoadUnits(false, "NonExistentType", false)
		if err == nil {
			t.Error("expected error for 0 matching units without allow-empty")
		}
	})

	t.Run("succeeds with allow-empty", func(t *testing.T) {
		l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
		if err != nil {
			t.Fatalf("failed to create loader: %v", err)
		}
		defer l.Close()

		db := parser.NewDatabase(l)
		err = db.LoadUnits(false, "NonExistentType", true)
		if err != nil {
			t.Errorf("expected no error with allow-empty, got: %v", err)
		}
		if len(db.Units) != 0 {
			t.Errorf("expected 0 units, got %d", len(db.Units))
		}
	})
}

// TestManualMode tests creating a profile from manual CLI flags.
func TestManualMode(t *testing.T) {
	setupIconFixtures(t)
	paRoot := paRootPath(t)
	outputDir := t.TempDir()

	// Simulate manual mode: create profile from flags
	profile := &models.FactionProfile{
		ID:              "ManualFaction",
		DisplayName:     "ManualFaction",
		FactionUnitType: "TestBase",
		Version:         "0.1.0",
	}

	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}
	defer l.Close()

	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, profile.FactionUnitType, false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	units := db.GetUnitsArray()
	metadata, err := exporter.CreateMetadataFromProfile(profile, nil)
	if err != nil {
		t.Fatalf("failed to create metadata: %v", err)
	}

	exp := exporter.NewFactionExporter(outputDir, l, false)
	if err := exp.ExportFaction(metadata, units); err != nil {
		t.Fatalf("failed to export: %v", err)
	}

	factionDir := filepath.Join(outputDir, exporter.SanitizeFolderName("ManualFaction"))
	meta := loadMetadata(t, factionDir)

	if meta.DisplayName != "ManualFaction" {
		t.Errorf("metadata displayName = %q, want %q", meta.DisplayName, "ManualFaction")
	}
	if meta.Type != "base-game" {
		t.Errorf("metadata type = %q, want %q", meta.Type, "base-game")
	}
	if meta.Version != "0.1.0" {
		t.Errorf("metadata version = %q, want %q", meta.Version, "0.1.0")
	}
}
