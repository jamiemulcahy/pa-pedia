package cmd

import (
	"fmt"
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
	"github.com/spf13/cobra"
)

var (
	factionNameFlag string
	modIDs          []string
)

// describeFactionCmd represents the describe-faction command
var describeFactionCmd = &cobra.Command{
	Use:   "describe-faction",
	Short: "Describe a faction by extracting and merging data from base game and mods",
	Long: `Describe a faction by discovering and merging unit data from the base game
and/or multiple mods. Supports both extracted directories and zip files.

This command replaces the old 'extract base' and 'extract mod' commands with a
unified approach that handles multi-source factions (e.g., a faction composed
of multiple mods).

The command will:
  - Search for mods in server_mods, client_mods, and download folders
  - Read zip files directly without extraction
  - Merge unit lists from all sources
  - Track file provenance (which mod provided each file)
  - Generate a lightweight index with detailed unit folders

For base game only, use --name mla (without --mod flags).
For custom factions, provide a name and one or more --mod flags.`,
	Example: `  # Base game (MLA) faction
  pa-pedia describe-faction --name mla --pa-root "C:/PA/media" --output "./factions"

  # Custom faction with multiple mods (first in list has priority)
  pa-pedia describe-faction --name "Legion Enhanced" \
    --pa-root "C:/PA/media" \
    --mod com.pa.legion-expansion \
    --mod com.pa.legion-client \
    --output "./factions"

  # Single mod faction
  pa-pedia describe-faction --name "Queller AI" \
    --pa-root "C:/PA/media" \
    --mod com.pa.queller \
    --output "./factions"`,
	RunE: runDescribeFaction,
}

func init() {
	rootCmd.AddCommand(describeFactionCmd)

	describeFactionCmd.Flags().StringVar(&factionNameFlag, "name", "", "Faction display name (required)")
	describeFactionCmd.Flags().StringVar(&paRoot, "pa-root", "", "Path to PA Titans media directory (required)")
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
	isMLA := strings.ToLower(factionNameFlag) == "mla"
	if isMLA && len(modIDs) > 0 {
		return fmt.Errorf("cannot use --mod flags with base game faction (mla)")
	}

	// Determine if this is base game or custom faction
	if isMLA {
		return describeMLA(factionNameFlag)
	}

	return describeCustomFaction(factionNameFlag, modIDs)
}

// describeMLA extracts the base game (MLA) faction
func describeMLA(name string) error {
	fmt.Println("Extracting base game faction (MLA)...")
	fmt.Println()

	// Create loader for base game only
	fmt.Println("Initializing loader...")
	l := loader.NewLoader(paRoot, "pa_ex1")

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

	// Export faction (using old exporter for now - will be updated)
	fmt.Println("\nExporting faction folder...")
	exp := exporter.NewFactionExporter(outputDir, verbose)
	if err := exp.ExportFaction(metadata, units); err != nil {
		return fmt.Errorf("failed to export faction: %w", err)
	}

	fmt.Println("\n✓ Base game faction extraction complete!")
	return nil
}

// describeCustomFaction extracts a custom faction from multiple mods
func describeCustomFaction(name string, modIdentifiers []string) error {
	fmt.Printf("Describing custom faction: %s\n", name)
	fmt.Printf("Mods to merge: %v\n", modIdentifiers)
	fmt.Println()

	// Discover all available mods
	fmt.Println("Discovering mods from all locations...")
	allMods, err := loader.FindAllMods(paRoot)
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
			fmt.Printf("\nError: Mod '%s' not found\n\n", modID)
			fmt.Println("Available mods:")
			for id, info := range allMods {
				fmt.Printf("  - %s (%s)\n", id, info.DisplayName)
			}
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
	defer l.Close() // Close any open zip readers

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

	// Export faction (using old exporter for now - will be updated)
	fmt.Println("\nExporting faction folder...")
	exp := exporter.NewFactionExporter(outputDir, verbose)
	if err := exp.ExportFaction(metadata, units); err != nil {
		return fmt.Errorf("failed to export faction: %w", err)
	}

	fmt.Println("\n✓ Custom faction extraction complete!")
	fmt.Printf("Faction '%s' exported to: %s\n", name, outputDir)
	return nil
}
