package cmd

import (
	"fmt"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
	"github.com/spf13/cobra"
)

var (
	paRoot      string
	modsFolder  string
	modID       string
	outputDir   string
	factionName string
)

// extractCmd represents the extract command
var extractCmd = &cobra.Command{
	Use:   "extract",
	Short: "Extract unit data from PA installation or mods",
	Long: `Extract unit data from Planetary Annihilation Titans installation
or server mods and generate portable faction folders.

Available subcommands:
  base - Extract base game faction
  mod  - Extract mod faction`,
}

// extractBaseCmd extracts base game units
var extractBaseCmd = &cobra.Command{
	Use:   "base",
	Short: "Extract base game faction data",
	Long: `Extract unit data from the base Planetary Annihilation Titans installation.

This will scan the PA media directory for unit definitions and generate
a faction folder with metadata, unit database, and extracted assets.`,
	Example: `  pa-pedia extract base --pa-root "C:/PA/media" --output "./factions"
  pa-pedia extract base --pa-root "/path/to/PA/media" --output "./output" --faction-name "Base Game"`,
	RunE: runExtractBase,
}

// extractModCmd extracts mod units
var extractModCmd = &cobra.Command{
	Use:   "mod",
	Short: "Extract mod faction data",
	Long: `Extract unit data from a server mod (including zip files).

This will read the mod's modinfo.json for metadata and extract all
unit definitions, handling base game overlays appropriately.`,
	Example: `  pa-pedia extract mod --mod-id "com.pa.legion-expansion" --mods-folder "C:/Users/.../server_mods" --output "./factions"
  pa-pedia extract mod --mod-id "com.pa.queller" --mods-folder "/path/to/server_mods" --output "./output"`,
	RunE: runExtractMod,
}

func init() {
	rootCmd.AddCommand(extractCmd)
	extractCmd.AddCommand(extractBaseCmd)
	extractCmd.AddCommand(extractModCmd)

	// Base command flags
	extractBaseCmd.Flags().StringVar(&paRoot, "pa-root", "", "Path to PA Titans media directory (required)")
	extractBaseCmd.Flags().StringVar(&outputDir, "output", "./factions", "Output directory for faction folders")
	extractBaseCmd.Flags().StringVar(&factionName, "faction-name", "MLA", "Display name for the faction")
	extractBaseCmd.MarkFlagRequired("pa-root")

	// Mod command flags
	extractModCmd.Flags().StringVar(&modID, "mod-id", "", "Mod identifier (e.g., com.pa.legion-expansion) (required)")
	extractModCmd.Flags().StringVar(&modsFolder, "mods-folder", "", "Path to server_mods directory (required)")
	extractModCmd.Flags().StringVar(&paRoot, "pa-root", "", "Path to PA Titans media directory for base game data")
	extractModCmd.Flags().StringVar(&outputDir, "output", "./factions", "Output directory for faction folders")
	extractModCmd.MarkFlagRequired("mod-id")
	extractModCmd.MarkFlagRequired("mods-folder")
}

func runExtractBase(cmd *cobra.Command, args []string) error {
	logVerbose("Extracting base game faction")
	logVerbose("PA Root: %s", paRoot)
	logVerbose("Output: %s", outputDir)
	logVerbose("Faction Name: %s", factionName)

	fmt.Println("=== PA-Pedia Base Game Extraction ===")
	fmt.Println()

	// Create loader
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
	metadata := exporter.CreateBaseGameMetadata(factionName, "PA Titans")

	// Export faction
	fmt.Println("\nExporting faction folder...")
	exp := exporter.NewFactionExporter(outputDir, verbose)
	if err := exp.ExportFaction(metadata, units); err != nil {
		return fmt.Errorf("failed to export faction: %w", err)
	}

	fmt.Println("\n✓ Base game extraction complete!")
	return nil
}

func runExtractMod(cmd *cobra.Command, args []string) error {
	logVerbose("Extracting mod faction")
	logVerbose("Mod ID: %s", modID)
	logVerbose("Mods Folder: %s", modsFolder)
	logVerbose("PA Root: %s", paRoot)
	logVerbose("Output: %s", outputDir)

	fmt.Println("=== PA-Pedia Mod Extraction ===")
	fmt.Println()

	// Discover mods
	fmt.Println("Scanning for mods...")
	mods, err := loader.DiscoverMods(modsFolder)
	if err != nil {
		return fmt.Errorf("failed to discover mods: %w", err)
	}

	// Find the requested mod
	modInfo, ok := mods[modID]
	if !ok {
		fmt.Printf("\nError: Mod '%s' not found\n\n", modID)
		fmt.Println("Available mods:")
		for id, info := range mods {
			fmt.Printf("  - %s (%s)\n", id, info.DisplayName)
		}
		return fmt.Errorf("mod not found: %s", modID)
	}

	fmt.Printf("Found mod: %s\n", modInfo.DisplayName)
	fmt.Printf("  Version: %s\n", modInfo.Version)
	fmt.Printf("  Author: %s\n", modInfo.Author)
	fmt.Println()

	// Determine PA root (required for base game overlay)
	effectivePARoot := paRoot
	if effectivePARoot == "" {
		return fmt.Errorf("--pa-root is required for mod extraction (needed for base game overlay)")
	}

	// Create loader with mod overlay
	fmt.Println("Initializing loader with mod overlay...")
	l := loader.NewModLoader(effectivePARoot, "pa_ex1", []string{modInfo.Directory})

	// Create database parser
	fmt.Println("Loading units...")
	db := parser.NewDatabase(l)
	if err := db.LoadUnits(verbose); err != nil {
		return fmt.Errorf("failed to load units: %w", err)
	}

	// Get units array
	units := db.GetUnitsArray()
	fmt.Printf("\nLoaded %d units\n", len(units))

	// Create metadata from mod info
	metadata := exporter.CreateModMetadata(
		modInfo.Identifier,
		modInfo.DisplayName,
		modInfo.Version,
		modInfo.Author,
		modInfo.Description,
		modInfo.Date,
		modInfo.Build,
	)

	// Export faction
	fmt.Println("\nExporting faction folder...")
	exp := exporter.NewFactionExporter(outputDir, verbose)
	if err := exp.ExportFaction(metadata, units); err != nil {
		return fmt.Errorf("failed to export faction: %w", err)
	}

	fmt.Println("\n✓ Mod extraction complete!")
	return nil
}
