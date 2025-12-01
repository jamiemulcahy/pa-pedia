package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
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
	paRoot     string
	paDataRoot string
	outputDir  string
	allowEmpty bool
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
	describeFactionCmd.Flags().StringVar(&factionUnitTypeFlag, "faction-unit-type", "", "Faction unit type identifier (e.g., 'Custom1' for Legion, 'Custom58' for MLA)")
	describeFactionCmd.Flags().StringArrayVar(&modIDs, "mod", []string{}, "Mod identifier(s) to include (repeatable, first has priority)")

	// Common flags
	describeFactionCmd.Flags().StringVar(&paRoot, "pa-root", "", "Path to PA Titans media directory")
	describeFactionCmd.Flags().StringVar(&paDataRoot, "data-root", "", "Path to PA data directory (required when mods are involved)")
	describeFactionCmd.Flags().StringVar(&outputDir, "output", "./factions", "Output directory for faction folders")
	describeFactionCmd.Flags().BoolVar(&allowEmpty, "allow-empty", false, "Allow exporting factions with 0 units (normally an error)")
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

	// Validate mutually exclusive options
	if profileFlag != "" && factionNameFlag != "" {
		return fmt.Errorf("--profile and --name are mutually exclusive\n\nUse --profile for profile-based extraction (recommended)\nUse --name with --faction-unit-type for manual mode")
	}

	// Determine which mode we're in
	var profile *models.FactionProfile

	if profileFlag != "" {
		// Profile-based mode
		profile, err = profileLoader.GetProfile(profileFlag)
		if err != nil {
			return fmt.Errorf("profile '%s' not found\n\nUse --list-profiles to see available profiles", profileFlag)
		}
		logVerbose("Using profile: %s (%s)", profile.ID, profile.DisplayName)
	} else if factionNameFlag != "" {
		// Args-based mode - create a temporary profile from args
		if factionUnitTypeFlag == "" {
			return fmt.Errorf("--faction-unit-type is required when using --name\n\nExample: --faction-unit-type Custom58 (for MLA) or Custom1 (for Legion)")
		}

		profile = &models.FactionProfile{
			ID:              factionNameFlag,
			DisplayName:     factionNameFlag,
			FactionUnitType: factionUnitTypeFlag,
			Mods:            modIDs,
		}
		logVerbose("Using manual mode: %s with unit type %s", factionNameFlag, factionUnitTypeFlag)
	} else {
		return fmt.Errorf("either --profile or --name is required\n\nUse --profile for profile-based extraction (recommended)\nUse --name with --faction-unit-type for manual mode\nUse --list-profiles to see available profiles")
	}

	// Validate --pa-root
	if paRoot == "" {
		return fmt.Errorf("--pa-root is required")
	}

	// Validate --data-root for factions with mods
	if len(profile.Mods) > 0 && paDataRoot == "" {
		return fmt.Errorf("--data-root is required when mods are involved\n\nProfile '%s' requires mods: %v\n\nCommon locations:\n  Windows: %%LOCALAPPDATA%%\\Uber Entertainment\\Planetary Annihilation\n  macOS: ~/Library/Application Support/Uber Entertainment/Planetary Annihilation\n  Linux: ~/.local/Uber Entertainment/Planetary Annihilation",
			profile.ID, profile.Mods)
	}

	// Validate data-root structure if provided
	if paDataRoot != "" {
		if err := validateDataRoot(paDataRoot); err != nil {
			return fmt.Errorf("invalid --data-root: %w", err)
		}
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
	fmt.Println("=== PA-Pedia Faction Description ===")
	fmt.Println()
	fmt.Printf("Faction: %s\n", profile.DisplayName)
	fmt.Printf("Filtering for faction unit type: UNITTYPE_%s\n", profile.FactionUnitType)
	if len(profile.Mods) > 0 {
		fmt.Printf("Mods: %v\n", profile.Mods)
	}
	fmt.Println()

	var resolvedMods []*loader.ModInfo

	// If profile has mods, discover and resolve them
	if len(profile.Mods) > 0 {
		fmt.Println("Discovering mods from all locations...")
		allMods, err := loader.FindAllMods(paDataRoot, verbose)
		if err != nil {
			return fmt.Errorf("failed to discover mods: %w", err)
		}

		fmt.Printf("Found %d total mods across all locations\n", len(allMods))
		if verbose {
			for id, mod := range allMods {
				fmt.Printf("  - %s (%s) [%s]\n", id, mod.DisplayName, mod.SourceType)
			}
		}
		fmt.Println()

		// Resolve requested mods in priority order
		fmt.Println("Resolving requested mods...")
		resolvedMods = make([]*loader.ModInfo, 0, len(profile.Mods))
		for _, modID := range profile.Mods {
			modInfo, ok := allMods[modID]
			if !ok {
				showAvailableMods(modID, allMods)
				return fmt.Errorf("mod not found: %s", modID)
			}

			resolvedMods = append(resolvedMods, modInfo)
			fmt.Printf("  ✓ %s (%s) [%s]\n", modInfo.Identifier, modInfo.DisplayName, modInfo.SourceType)
			if modInfo.IsZipped {
				fmt.Printf("    Source: %s (zip)\n", modInfo.ZipPath)
			} else {
				fmt.Printf("    Source: %s (directory)\n", modInfo.Directory)
			}
		}
		fmt.Println()
	}

	// Create multi-source loader (works for both base game and modded)
	fmt.Println("Initializing loader...")
	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", resolvedMods)
	if err != nil {
		return fmt.Errorf("failed to create loader: %w", err)
	}
	defer l.Close()

	// Load merged unit list (for verbose output)
	if len(profile.Mods) > 0 {
		fmt.Println("Loading and merging unit lists...")
		unitPaths, provenance, err := l.LoadMergedUnitList()
		if err != nil {
			return fmt.Errorf("failed to load merged unit list: %w", err)
		}

		fmt.Printf("Merged %d unique units from all sources\n", len(unitPaths))
		if verbose {
			sourceCounts := make(map[string]int)
			for _, source := range provenance {
				sourceCounts[source]++
			}
			fmt.Println("\nUnit distribution by source:")
			for source, count := range sourceCounts {
				fmt.Printf("  - %s: %d units\n", source, count)
			}
		}
		fmt.Println()
	}

	// Create database parser and load units
	fmt.Println("Loading units...")
	db := parser.NewDatabase(l)
	if err := db.LoadUnits(verbose, profile.FactionUnitType, allowEmpty); err != nil {
		return fmt.Errorf("failed to load units: %w", err)
	}

	// Get units array
	units := db.GetUnitsArray()
	fmt.Printf("\nLoaded %d units (filtered by UNITTYPE_%s)\n", len(units), profile.FactionUnitType)

	// Create metadata from profile
	metadata := exporter.CreateMetadataFromProfile(profile, resolvedMods)

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
func copyBackgroundImage(profile *models.FactionProfile, factionDir string, exp *exporter.FactionExporter) error {
	// No background image specified
	if profile.BackgroundImage == "" {
		return nil
	}

	// Determine destination path (standardized name with original extension)
	ext := filepath.Ext(profile.BackgroundImage)
	dstPath := filepath.Join(factionDir, "background"+ext)

	// Copy from mod sources using the exporter
	if err := exp.CopyResourceToFile(profile.BackgroundImage, dstPath); err != nil {
		fmt.Printf("Warning: Could not copy background image: %v\n", err)
		return nil // Non-fatal - faction can still be exported without background
	}

	logVerbose("Copied background image: %s -> %s", profile.BackgroundImage, dstPath)
	return nil
}
