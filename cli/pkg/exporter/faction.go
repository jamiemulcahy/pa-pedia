package exporter

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// FactionExporter handles exporting faction data to folder structure
type FactionExporter struct {
	OutputDir string
	Verbose   bool
}

// NewFactionExporter creates a new faction exporter
func NewFactionExporter(outputDir string, verbose bool) *FactionExporter {
	return &FactionExporter{
		OutputDir: outputDir,
		Verbose:   verbose,
	}
}

// ExportFaction exports a complete faction to a folder
func (e *FactionExporter) ExportFaction(metadata models.FactionMetadata, units []models.Unit) error {
	// Create faction folder
	factionDir := filepath.Join(e.OutputDir, sanitizeFolderName(metadata.DisplayName))

	if e.Verbose {
		fmt.Printf("Creating faction folder: %s\n", factionDir)
	}

	if err := os.MkdirAll(factionDir, 0755); err != nil {
		return fmt.Errorf("failed to create faction directory: %w", err)
	}

	// Create assets subdirectory
	assetsDir := filepath.Join(factionDir, "assets")
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		return fmt.Errorf("failed to create assets directory: %w", err)
	}

	// Create README in assets folder explaining image strategy
	readmePath := filepath.Join(assetsDir, "README.md")
	readmeContent := `# Unit Assets

This directory is intended for unit icon images.

## Image Format

Each unit should have a corresponding PNG image named after its unit ID:
- Example: tank.png for the unit with ID "tank"
- Format: PNG (recommended size: 128x128 or 256x256)

## Current Status

Asset extraction is not yet implemented. Unit images can be:

1. **Manually added**: Place PNG files in this directory with names matching unit IDs
2. **Generated**: Create placeholder images programmatically
3. **External**: The web UI can be configured to use external image sources

## Future Enhancement

A future CLI command will extract unit icons directly from PA installation files.

## Fallback Strategy

The web UI should implement a fallback strategy:
1. Try to load from ./assets/{unitId}.png
2. If not found, use a default placeholder image
3. Optionally, reference external PA community databases
`
	if err := os.WriteFile(readmePath, []byte(readmeContent), 0644); err != nil {
		return fmt.Errorf("failed to write assets README: %w", err)
	}

	// Write metadata.json
	if err := e.writeMetadata(factionDir, metadata); err != nil {
		return fmt.Errorf("failed to write metadata: %w", err)
	}

	// Write units.json
	if err := e.writeUnits(factionDir, units); err != nil {
		return fmt.Errorf("failed to write units: %w", err)
	}

	if e.Verbose {
		fmt.Printf("Successfully exported faction to %s\n", factionDir)
		fmt.Printf("  - Metadata: metadata.json\n")
		fmt.Printf("  - Units: %d units in units.json\n", len(units))
		fmt.Printf("  - Assets: assets/ directory created\n")
	}

	return nil
}

// writeMetadata writes the metadata.json file
func (e *FactionExporter) writeMetadata(factionDir string, metadata models.FactionMetadata) error {
	metadataPath := filepath.Join(factionDir, "metadata.json")

	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	if err := os.WriteFile(metadataPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write metadata file: %w", err)
	}

	if e.Verbose {
		fmt.Printf("  ✓ Wrote metadata.json\n")
	}

	return nil
}

// writeUnits writes the units.json file
func (e *FactionExporter) writeUnits(factionDir string, units []models.Unit) error {
	unitsPath := filepath.Join(factionDir, "units.json")

	database := models.FactionDatabase{
		Units: units,
	}

	data, err := json.MarshalIndent(database, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal units: %w", err)
	}

	if err := os.WriteFile(unitsPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write units file: %w", err)
	}

	if e.Verbose {
		fmt.Printf("  ✓ Wrote units.json (%d units)\n", len(units))
	}

	return nil
}

// CreateBaseGameMetadata creates metadata for the base game faction
func CreateBaseGameMetadata(factionName string, build string) models.FactionMetadata {
	return models.FactionMetadata{
		Identifier:  "com.uberent.pa.titans.mla",
		DisplayName: factionName,
		Version:     "1.0.0",
		Author:      "Uber Entertainment",
		Description: "MLA (Machine, Legion, and Armada) - The base Planetary Annihilation: Titans faction",
		DateCreated: time.Now().Format("2006-01-02"),
		Build:       build,
		Type:        "base-game",
	}
}

// CreateModMetadata creates metadata from mod info
func CreateModMetadata(identifier, displayName, version, author, description, date, build string) models.FactionMetadata {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	return models.FactionMetadata{
		Identifier:  identifier,
		DisplayName: displayName,
		Version:     version,
		Author:      author,
		Description: description,
		DateCreated: date,
		Build:       build,
		Type:        "mod",
	}
}

// CreateCustomFactionMetadata creates metadata for a custom faction composed of multiple mods
func CreateCustomFactionMetadata(factionName string, modIDs []string, mods []*loader.ModInfo) models.FactionMetadata {
	// Generate identifier from faction name
	identifier := "custom." + sanitizeFolderName(factionName)

	// Combine authors from all mods
	authors := make(map[string]bool)
	for _, mod := range mods {
		if mod.Author != "" {
			authors[mod.Author] = true
		}
	}
	authorList := make([]string, 0, len(authors))
	for author := range authors {
		authorList = append(authorList, author)
	}

	var authorStr string
	if len(authorList) > 0 {
		if len(authorList) == 1 {
			authorStr = authorList[0]
		} else {
			authorStr = fmt.Sprintf("%s and others", authorList[0])
		}
	} else {
		authorStr = "Community"
	}

	// Create description
	description := fmt.Sprintf("Custom faction combining: %s", modIDs[0])
	if len(modIDs) > 1 {
		description += fmt.Sprintf(" and %d other mod(s)", len(modIDs)-1)
	}

	// Use latest version from mods
	version := "1.0.0"
	if len(mods) > 0 && mods[0].Version != "" {
		version = mods[0].Version
	}

	// Use latest build from mods
	build := ""
	if len(mods) > 0 && mods[0].Build != "" {
		build = mods[0].Build
	}

	return models.FactionMetadata{
		Identifier:  identifier,
		DisplayName: factionName,
		Version:     version,
		Author:      authorStr,
		Description: description,
		DateCreated: time.Now().Format("2006-01-02"),
		Build:       build,
		Type:        "mod",
		Mods:        modIDs,
	}
}

// sanitizeFolderName converts a display name to a safe folder name
func sanitizeFolderName(name string) string {
	// Replace spaces with hyphens
	name = filepath.Base(name)

	// Remove or replace invalid characters
	safe := ""
	for _, r := range name {
		switch r {
		case ' ':
			safe += "-"
		case '/', '\\', ':', '*', '?', '"', '<', '>', '|':
			// Skip invalid characters
		default:
			safe += string(r)
		}
	}

	// Convert to lowercase
	return filepath.Clean(safe)
}
