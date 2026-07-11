package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/pkg/profiles"
	"github.com/spf13/cobra"
)

var (
	// Profile-based approach (recommended)
	profileFlag    string
	profileDirFlag string
	listProfiles   bool

	// Args-based approach (fallback)
	factionNameFlag     string
	factionUnitTypeFlag string
	modIDs              []string

	// Common flags
	paRoot      string
	paDataRoot  string
	outputDir   string
	allowEmpty  bool
	versionFlag string
)

// describeFactionCmd represents the describe-faction command
var describeFactionCmd = &cobra.Command{
	Use:   "describe-faction",
	Short: "Generate a faction data folder for the PA-Pedia web app",
	Long: `Generate a complete faction data folder containing unit information, metadata,
and assets from Planetary Annihilation Titans.

This command extracts faction data from your PA installation and creates a
portable folder that can be:
  - Uploaded to the PA-Pedia web app for browsing
  - Shared with other players
  - Used for mod development and analysis

PROFILES (Recommended):
  Use --profile to specify a built-in or custom profile. Profiles define the
  faction identity (name, unit type, mods) in a reusable JSON file.

  Built-in profiles:
    mla     - MLA faction (base game)
    legion  - Legion faction (requires Legion mod)

  Custom profiles can be added to ./profiles/ directory.

MANUAL MODE (Fallback):
  Use --name with --faction-unit-type and optional --mod flags for custom
  configurations without creating a profile.`,
	Example: `  # Profile-based (recommended)
  pa-pedia describe-faction --profile mla --pa-root "C:/PA/media"
  pa-pedia describe-faction --profile legion --pa-root "C:/PA/media" --data-root "%LOCALAPPDATA%/..."

  # List available profiles
  pa-pedia describe-faction --list-profiles

  # GitHub repository as mod source (no local download needed)
  pa-pedia describe-faction --profile mla --mod "github.com/user/my-mod" --pa-root "C:/PA/media"
  pa-pedia describe-faction --profile mla --mod "github.com/user/repo/tree/v2.0" --pa-root "C:/PA/media"

  # Manual mode (fallback)
  pa-pedia describe-faction --name MLA --faction-unit-type Custom58 --pa-root "C:/PA/media"
  pa-pedia describe-faction --name Legion --faction-unit-type Custom1 \
    --mod com.pa.legion-expansion-server --mod com.pa.legion-expansion-client \
    --pa-root "C:/PA/media" --data-root "%LOCALAPPDATA%/..."`,
	RunE: runDescribeFaction,
}

func init() {
	rootCmd.AddCommand(describeFactionCmd)

	// Profile-based flags (recommended)
	describeFactionCmd.Flags().StringVar(&profileFlag, "profile", "", "Profile ID to use (recommended approach)")
	describeFactionCmd.Flags().StringVar(&profileDirFlag, "profile-dir", "./profiles", "Directory for custom faction profiles")
	describeFactionCmd.Flags().BoolVar(&listProfiles, "list-profiles", false, "List available profiles and exit")

	// Args-based flags (fallback)
	describeFactionCmd.Flags().StringVar(&factionNameFlag, "name", "", "Faction display name (fallback mode)")
	describeFactionCmd.Flags().StringVar(&factionUnitTypeFlag, "faction-unit-type", "", "Faction unit type identifier (e.g., Custom58 for MLA, Custom1 for Legion)")
	describeFactionCmd.Flags().StringArrayVar(&modIDs, "mod", []string{}, "Mod source(s) to include - local mod ID or GitHub URL (repeatable, first has priority)")

	// Common flags
	describeFactionCmd.Flags().StringVar(&paRoot, "pa-root", "", "Path to PA Titans media directory")
	describeFactionCmd.Flags().StringVar(&paDataRoot, "data-root", "", "Path to PA data directory (required when mods are involved)")
	describeFactionCmd.Flags().StringVar(&outputDir, "output", "./factions", "Output directory for faction folders")
	describeFactionCmd.Flags().BoolVar(&allowEmpty, "allow-empty", false, "Allow exporting factions with 0 units (normally an error)")
	describeFactionCmd.Flags().StringVar(&versionFlag, "version", "", "Faction version (required if not auto-detected from mod)")
}

func runDescribeFaction(cmd *cobra.Command, args []string) error {
	// Initialize profile loader
	profileLoader, err := profiles.NewLoader()
	if err != nil {
		return fmt.Errorf("failed to initialize profile loader: %w", err)
	}

	// Load local profiles
	if err := profileLoader.LoadLocalProfiles(profileDirFlag); err != nil {
		return fmt.Errorf("failed to load local profiles: %w", err)
	}

	// Handle --list-profiles
	if listProfiles {
		return listAvailableProfiles(profileLoader)
	}

	// Determine which mode we're in (profile vs manual)
	profile, err := resolveProfileFromFlags(profileLoader, profileFlag, factionNameFlag, factionUnitTypeFlag, modIDs)
	if err != nil {
		return err
	}

	// Apply --version flag override (takes priority over profile/mod version)
	if versionFlag != "" {
		profile.Version = versionFlag
	}

	// Auto-detect version from version.txt for base game factions (no mods)
	// Priority: --version flag > profile.Version > version.txt > mod version > error
	if profile.Version == "" && len(profile.Mods) == 0 && paRoot != "" {
		if detected := detectPAVersion(paRoot); detected != "" {
			logVerbose("Auto-detected PA version from game files: %s", detected)
			profile.Version = detected
		}
	}

	// Validate --pa-root / --data-root
	if err := validateFactionInputs(profile, paRoot, paDataRoot); err != nil {
		return err
	}

	logVerbose("PA Root: %s", paRoot)
	logVerbose("Data Root: %s", paDataRoot)
	logVerbose("Output: %s", outputDir)

	// Execute faction extraction
	return describeFaction(profile, allowEmpty)
}

// listAvailableProfiles displays all available profiles
func listAvailableProfiles(pl *profiles.Loader) error {
	allProfiles := pl.GetAllProfiles()

	fmt.Println("Available faction profiles:")
	fmt.Println()

	for _, p := range allProfiles {
		modInfo := ""
		if len(p.Mods) > 0 {
			modInfo = " (requires mods)"
		}
		fmt.Printf("  %-12s %s%s\n", p.ID, p.DisplayName, modInfo)
		if p.Description != "" {
			fmt.Printf("               %s\n", p.Description)
		}
	}

	fmt.Println()
	fmt.Printf("Custom profiles can be added to: %s\n", profileDirFlag)
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  pa-pedia describe-faction --profile <id> --pa-root <path>")

	return nil
}

// validateDataRoot checks if the provided data root looks like a valid PA data directory
func validateDataRoot(dataRoot string) error {
	// Check if directory exists
	info, err := os.Stat(dataRoot)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("directory does not exist: %s", dataRoot)
		}
		return fmt.Errorf("cannot access directory: %w", err)
	}

	if !info.IsDir() {
		return fmt.Errorf("path is not a directory: %s", dataRoot)
	}

	// Check for expected subdirectories (at least one should exist for a valid PA data root)
	expectedDirs := []string{"server_mods", "client_mods", "download"}
	foundAny := false
	for _, dir := range expectedDirs {
		dirPath := filepath.Join(dataRoot, dir)
		if _, err := os.Stat(dirPath); err == nil {
			foundAny = true
			break
		}
	}

	if !foundAny {
		return fmt.Errorf("directory does not appear to be a PA data directory (missing server_mods, client_mods, and download subdirectories): %s", dataRoot)
	}

	return nil
}

// describeFaction extracts a faction using the unified code path.
// All factions (base game and modded) use the same logic - the only difference
// is whether the profile has mods or not.
func describeFaction(profile *models.FactionProfile, allowEmpty bool) error {
	// Validate we have a faction unit type (not required for addons, but useful for categorization)
	// This is defensive: profiles loaded from files are validated in loader.go,
	// but profiles built from CLI flags (manual mode) bypass that validation.
	if profile.FactionUnitType == "" && !profile.IsAddon {
		return fmt.Errorf("profile must have factionUnitType defined (or isAddon: true for addon mods)")
	}

	fmt.Println("=== PA-Pedia Faction Description ===")
	fmt.Println()
	fmt.Printf("Faction: %s\n", profile.DisplayName)
	if profile.IsAddon {
		fmt.Println("Mode: Addon (will filter out base game units)")
	} else {
		fmt.Printf("Filtering for faction unit type: UNITTYPE_%s\n", profile.FactionUnitType)
	}
	if len(profile.Mods) > 0 {
		fmt.Printf("Mods: %v\n", profile.Mods)
	}
	fmt.Println()

	// Resolve mods, build the overlay loader, and load units (shared with extract-models)
	l, units, resolvedMods, baseFactions, err := loadFactionUnits(profile, paRoot, paDataRoot, allowEmpty)
	if err != nil {
		return err
	}
	defer l.Close()

	// Create metadata from profile
	metadata, err := exporter.CreateMetadataFromProfile(profile, resolvedMods)
	if err != nil {
		return err
	}

	// Set addon flag and detect base factions if this is an addon
	if profile.IsAddon {
		metadata.IsAddon = true
		metadata.BaseFactions = baseFactions
	}

	// Export faction
	fmt.Println("\nExporting faction folder...")
	exp := exporter.NewFactionExporter(outputDir, l, verbose)
	if err := exp.ExportFaction(metadata, units); err != nil {
		return fmt.Errorf("failed to export faction: %w", err)
	}

	// Copy background image if specified
	factionDir := filepath.Join(outputDir, exporter.SanitizeFolderName(metadata.DisplayName))
	if err := copyBackgroundImage(profile, factionDir, exp); err != nil {
		return fmt.Errorf("failed to copy background image: %w", err)
	}

	fmt.Println("\n✓ Faction extraction complete!")
	fmt.Printf("Faction '%s' exported to: %s\n", profile.DisplayName, outputDir)
	return nil
}

// showAvailableMods displays a helpful list of available mods when a requested mod is not found
func showAvailableMods(missingModID string, allMods map[string]*loader.ModInfo) {
	fmt.Printf("\nError: Mod '%s' not found\n\n", missingModID)
	fmt.Println("Available mods:")
	for id, info := range allMods {
		fmt.Printf("  - %s (%s)\n", id, info.DisplayName)
	}
	fmt.Println()
}

// copyBackgroundImage copies the background image from mod sources to faction output.
// The background image path is a PA resource path (e.g., "/ui/mods/my_mod/img/bg.png").
// The image is copied to assets/ mirroring the original path structure.
func copyBackgroundImage(profile *models.FactionProfile, factionDir string, exp *exporter.FactionExporter) error {
	// No background image specified
	if profile.BackgroundImage == "" {
		return nil
	}

	// Mirror the original path in assets/ folder (consistent with other assets)
	normalizedPath := filepath.ToSlash(filepath.Clean(profile.BackgroundImage))
	normalizedPath = strings.TrimPrefix(normalizedPath, "/")
	dstPath := filepath.Join(factionDir, "assets", normalizedPath)

	// Copy from mod sources using the exporter
	if err := exp.CopyResourceToFile(profile.BackgroundImage, dstPath); err != nil {
		fmt.Printf("Warning: Could not copy background image: %v\n", err)
		return nil // Non-fatal - faction can still be exported without background
	}

	logVerbose("Copied background image: %s -> %s", profile.BackgroundImage, dstPath)
	return nil
}

// detectPAVersion tries to read the PA build version from version.txt or build.txt.
// PA stores these files in the install root (parent of the media/ directory).
// When using extracted base data, the file may be at paRoot directly.
func detectPAVersion(paRoot string) string {
	parentDir := filepath.Dir(paRoot)
	candidates := []string{
		filepath.Join(parentDir, "version.txt"),
		filepath.Join(parentDir, "build.txt"),
		filepath.Join(paRoot, "version.txt"),
		filepath.Join(paRoot, "build.txt"),
	}
	for _, candidate := range candidates {
		data, err := os.ReadFile(candidate)
		if err == nil {
			version := strings.TrimSpace(string(data))
			if version != "" {
				return version
			}
		}
	}
	return ""
}
