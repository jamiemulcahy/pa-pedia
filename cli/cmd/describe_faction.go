package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
	"github.com/spf13/cobra"
)

const (
	// Base game faction name aliases
	FactionNameMLA    = "mla"
	FactionNameBase   = "base"
	FactionNameTitans = "titans"
)

var (
	factionNameFlag string
	modIDs          []string
	paRoot          string
	paDataRoot      string
	outputDir       string
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

The tool automatically discovers and merges unit data from:
  - Base game files (MLA faction)
  - Installed server mods
  - Client mods
  - Downloaded mod zip files

For the base game, use --name mla (or --name base/titans).
For modded factions, provide a faction name and one or more --mod identifiers.`,
	Example: `  # Base game (MLA) faction
  pa-pedia describe-faction --name mla --pa-root "C:/PA/media" --output "./factions"

  # Custom faction with multiple mods (first in list has priority)
  pa-pedia describe-faction --name "Legion Enhanced" \
    --pa-root "C:/PA/media" \
    --data-root "%LOCALAPPDATA%/Uber Entertainment/Planetary Annihilation" \
    --mod com.pa.legion-expansion-server \
    --mod com.pa.legion-expansion-client \
    --output "./factions"

  # Single mod faction
  pa-pedia describe-faction --name "Queller AI" \
    --pa-root "C:/PA/media" \
    --data-root "%LOCALAPPDATA%/Uber Entertainment/Planetary Annihilation" \
    --mod com.pa.queller \
    --output "./factions"`,
	RunE: runDescribeFaction,
}

func init() {
	rootCmd.AddCommand(describeFactionCmd)

	describeFactionCmd.Flags().StringVar(&factionNameFlag, "name", "", "Faction display name (required)")
	describeFactionCmd.Flags().StringVar(&paRoot, "pa-root", "", "Path to PA Titans media directory (required)")
	describeFactionCmd.Flags().StringVar(&paDataRoot, "data-root", "", "Path to PA data directory (required for modded factions)")
	describeFactionCmd.Flags().StringVar(&outputDir, "output", "./factions", "Output directory for faction folders")
	describeFactionCmd.Flags().StringArrayVar(&modIDs, "mod", []string{}, "Mod identifier(s) to include (repeatable, first has priority)")

	describeFactionCmd.MarkFlagRequired("name")
	describeFactionCmd.MarkFlagRequired("pa-root")
}

func runDescribeFaction(cmd *cobra.Command, args []string) error {
	logVerbose("Describing faction: %s", factionNameFlag)
	logVerbose("PA Root: %s", paRoot)
	logVerbose("Output: %s", outputDir)
	logVerbose("Mods: %v", modIDs)

	fmt.Println("=== PA-Pedia Faction Description ===")
	fmt.Println()

	// Validate: mods cannot be used with base game
	factionNameLower := strings.ToLower(factionNameFlag)
	isMLA := factionNameLower == FactionNameMLA || factionNameLower == FactionNameBase || factionNameLower == FactionNameTitans
	if isMLA && len(modIDs) > 0 {
		return fmt.Errorf("cannot use --mod flags with base game faction (%s/%s/%s)", FactionNameMLA, FactionNameBase, FactionNameTitans)
	}

	// Validate: modded factions require data-root
	if !isMLA && len(modIDs) > 0 && paDataRoot == "" {
		return fmt.Errorf("--data-root is required for modded factions\n\nCommon locations:\n  Windows: %%LOCALAPPDATA%%\\Uber Entertainment\\Planetary Annihilation\n  macOS: ~/Library/Application Support/Uber Entertainment/Planetary Annihilation\n  Linux: ~/.local/Uber Entertainment/Planetary Annihilation")
	}

	// Validate data-root structure if provided
	if paDataRoot != "" {
		if err := validateDataRoot(paDataRoot); err != nil {
			return fmt.Errorf("invalid --data-root: %w", err)
		}
	}

	// Determine if this is base game or custom faction
	if isMLA {
		return describeMLA(factionNameFlag)
	}

	return describeCustomFaction(factionNameFlag, modIDs, paDataRoot)
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

// describeMLA extracts the base game (MLA) faction
func describeMLA(name string) error {
	fmt.Println("Extracting base game faction (MLA)...")
	fmt.Println()

	// Create loader for base game only (use MultiSourceLoader for consistency)
	fmt.Println("Initializing loader...")
	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		return fmt.Errorf("failed to create loader: %w", err)
	}
	defer l.Close()

	// Create database parser
	fmt.Println("Loading units...")
	db := parser.NewDatabase(l)
	if err := db.LoadUnits(verbose); err != nil {
		return fmt.Errorf("failed to load units: %w", err)
	}

	// Get units array
	units := db.GetUnitsArray()
	fmt.Printf("\nLoaded %d units\n", len(units))

	// Create metadata
	metadata := exporter.CreateBaseGameMetadata(name, "PA Titans")

	// Export faction
	fmt.Println("\nExporting faction folder...")
	exp := exporter.NewFactionExporter(outputDir, l, verbose)
	if err := exp.ExportFaction(metadata, units); err != nil {
		return fmt.Errorf("failed to export faction: %w", err)
	}

	fmt.Println("\n✓ Base game faction extraction complete!")
	return nil
}

// describeCustomFaction extracts a custom faction from multiple mods
func describeCustomFaction(name string, modIdentifiers []string, dataRoot string) error {
	fmt.Printf("Describing custom faction: %s\n", name)
	fmt.Printf("Mods to merge: %v\n", modIdentifiers)
	fmt.Println()

	// Discover all available mods
	fmt.Println("Discovering mods from all locations...")
	allMods, err := loader.FindAllMods(dataRoot, verbose)
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
	resolvedMods := make([]*loader.ModInfo, 0, len(modIdentifiers))
	for _, modID := range modIdentifiers {
		modInfo, ok := allMods[modID]
		if !ok {
			// Mod not found, show available options
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

	// Create multi-source loader
	fmt.Println("Initializing multi-source loader...")
	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", resolvedMods)
	if err != nil {
		return fmt.Errorf("failed to create loader: %w", err)
	}
	defer l.Close()

	// Load merged unit list
	fmt.Println("Loading and merging unit lists...")
	unitPaths, provenance, err := l.LoadMergedUnitList()
	if err != nil {
		return fmt.Errorf("failed to load merged unit list: %w", err)
	}

	fmt.Printf("Merged %d unique units from all sources\n", len(unitPaths))
	if verbose {
		// Show provenance summary
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

	// Create database parser
	fmt.Println("Parsing units...")
	db := parser.NewDatabase(l)
	if err := db.LoadUnits(verbose); err != nil {
		return fmt.Errorf("failed to load units: %w", err)
	}

	// Get units array
	units := db.GetUnitsArray()
	fmt.Printf("\nParsed %d units\n", len(units))

	// Create metadata for custom faction
	modList := make([]string, len(modIdentifiers))
	copy(modList, modIdentifiers)

	metadata := exporter.CreateCustomFactionMetadata(
		name,
		modList,
		resolvedMods,
	)

	// Export faction
	fmt.Println("\nExporting faction folder...")
	exp := exporter.NewFactionExporter(outputDir, l, verbose)
	if err := exp.ExportFaction(metadata, units); err != nil {
		return fmt.Errorf("failed to export faction: %w", err)
	}

	fmt.Println("\n✓ Custom faction extraction complete!")
	fmt.Printf("Faction '%s' exported to: %s\n", name, outputDir)
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
