package exporter

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// FactionExporter handles exporting faction data to the Phase 1.5 structure
type FactionExporter struct {
	OutputDir string
	Loader    *loader.Loader
	Verbose   bool
}

// NewFactionExporter creates a new faction exporter
func NewFactionExporter(outputDir string, l *loader.Loader, verbose bool) *FactionExporter {
	return &FactionExporter{
		OutputDir: outputDir,
		Loader:    l,
		Verbose:   verbose,
	}
}

// ExportFaction exports a faction using the Phase 1.5 structure
func (e *FactionExporter) ExportFaction(metadata models.FactionMetadata, units []models.Unit) error {
	// Create faction folder
	factionDir := filepath.Join(e.OutputDir, sanitizeFolderName(metadata.DisplayName))

	if e.Verbose {
		fmt.Printf("Creating faction folder: %s\n", factionDir)
	}

	if err := os.MkdirAll(factionDir, 0755); err != nil {
		return fmt.Errorf("failed to create faction directory: %w", err)
	}

	// Create units subdirectory
	unitsDir := filepath.Join(factionDir, "units")
	if err := os.MkdirAll(unitsDir, 0755); err != nil {
		return fmt.Errorf("failed to create units directory: %w", err)
	}

	// Write metadata.json
	if err := e.writeMetadata(factionDir, metadata); err != nil {
		return fmt.Errorf("failed to write metadata: %w", err)
	}

	// Build lightweight index and export unit files
	index, err := e.exportUnits(unitsDir, units)
	if err != nil {
		return fmt.Errorf("failed to export units: %w", err)
	}

	// Write lightweight units.json index
	if err := e.writeIndex(factionDir, index); err != nil {
		return fmt.Errorf("failed to write index: %w", err)
	}

	if e.Verbose {
		fmt.Printf("Successfully exported faction to %s\n", factionDir)
		fmt.Printf("  - Metadata: metadata.json\n")
		fmt.Printf("  - Index: %d units in units.json\n", len(index.Units))
		fmt.Printf("  - Units: %d unit folders in units/\n", len(units))
	}

	return nil
}

// exportUnits exports all unit files and builds the index
func (e *FactionExporter) exportUnits(unitsDir string, units []models.Unit) (*models.FactionIndex, error) {
	index := &models.FactionIndex{
		Units: make([]models.UnitIndexEntry, 0, len(units)),
	}

	for i, unit := range units {
		if e.Verbose && (i%50 == 0 || i == len(units)-1) {
			fmt.Printf("  Processing units: %d/%d\r", i+1, len(units))
		}

		// Create unit directory
		unitDir := filepath.Join(unitsDir, unit.ID)
		if err := os.MkdirAll(unitDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create unit directory for %s: %w", unit.ID, err)
		}

		// Discover all files for this unit
		unitFiles, err := e.Loader.GetAllFilesForUnit(unit.ResourceName)
		if err != nil {
			// Log warning but continue
			if e.Verbose {
				fmt.Printf("\nWarning: Failed to discover files for %s: %v\n", unit.ID, err)
			}
			unitFiles = make(map[string]*loader.UnitFileInfo)
		}

		// Copy all discovered files to unit directory
		indexFiles := make([]models.UnitFile, 0, len(unitFiles))
		for filename, fileInfo := range unitFiles {
			if err := e.copyFile(fileInfo, unitDir); err != nil {
				if e.Verbose {
					fmt.Printf("\nWarning: Failed to copy %s for unit %s: %v\n", filename, unit.ID, err)
				}
				continue
			}

			// Add to index
			indexFiles = append(indexFiles, models.UnitFile{
				Path:   filename,
				Source: fileInfo.Source,
			})
		}

		// Create index entry
		indexEntry := models.UnitIndexEntry{
			Identifier:  unit.ID,
			DisplayName: unit.DisplayName,
			UnitTypes:   unit.UnitTypes,
			Source:      determineUnitSource(unit.ResourceName),
			Files:       indexFiles,
		}

		index.Units = append(index.Units, indexEntry)
	}

	if e.Verbose {
		fmt.Println() // New line after progress indicator
	}

	return index, nil
}

// copyFile copies a unit file from source to destination
func (e *FactionExporter) copyFile(fileInfo *loader.UnitFileInfo, destDir string) error {
	destPath := filepath.Join(destDir, fileInfo.RelativePath)

	if fileInfo.IsFromZip {
		// Copy from zip file
		return e.copyFromZip(fileInfo, destPath)
	}

	// Copy from filesystem
	return e.copyFromFilesystem(fileInfo.FullPath, destPath)
}

// copyFromZip extracts a file from a zip archive
func (e *FactionExporter) copyFromZip(fileInfo *loader.UnitFileInfo, destPath string) error {
	// Find the source in the loader
	var zipReader *zip.ReadCloser
	for _, src := range e.Loader.Sources() {
		if src.IsZip && src.Identifier == fileInfo.Source {
			zipReader = src.ZipReader
			break
		}
	}

	if zipReader == nil {
		return fmt.Errorf("zip reader not found for source %s", fileInfo.Source)
	}

	// Find file in zip
	for _, file := range zipReader.File {
		if file.Name == fileInfo.FullPath || strings.HasSuffix(file.Name, fileInfo.FullPath) {
			rc, err := file.Open()
			if err != nil {
				return fmt.Errorf("failed to open file in zip: %w", err)
			}
			defer rc.Close()

			// Create destination file
			destFile, err := os.Create(destPath)
			if err != nil {
				return fmt.Errorf("failed to create destination file: %w", err)
			}
			defer destFile.Close()

			// Copy data
			if _, err := io.Copy(destFile, rc); err != nil {
				return fmt.Errorf("failed to copy file data: %w", err)
			}

			return nil
		}
	}

	return fmt.Errorf("file not found in zip: %s", fileInfo.FullPath)
}

// copyFromFilesystem copies a file from the filesystem
func (e *FactionExporter) copyFromFilesystem(srcPath, destPath string) error {
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer srcFile.Close()

	destFile, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, srcFile); err != nil {
		return fmt.Errorf("failed to copy file: %w", err)
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

// writeIndex writes the lightweight units.json index
func (e *FactionExporter) writeIndex(factionDir string, index *models.FactionIndex) error {
	indexPath := filepath.Join(factionDir, "units.json")

	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal index: %w", err)
	}

	if err := os.WriteFile(indexPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write index file: %w", err)
	}

	if e.Verbose {
		fmt.Printf("  ✓ Wrote units.json index (%d units)\n", len(index.Units))
	}

	return nil
}

// determineUnitSource extracts the source from a unit's resource name
func determineUnitSource(resourceName string) string {
	if strings.HasPrefix(resourceName, "/pa_ex1/") {
		return "pa_ex1"
	}
	if strings.HasPrefix(resourceName, "/pa/") {
		return "pa"
	}
	// For modded units, this will be overridden by actual source tracking
	return "unknown"
}

// sanitizeFolderName converts a faction name to a valid folder name
func sanitizeFolderName(name string) string {
	// Replace invalid characters with hyphens
	sanitized := strings.Map(func(r rune) rune {
		if r == ' ' {
			return '-'
		}
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			return r
		}
		return '-'
	}, name)

	// Remove consecutive hyphens
	for strings.Contains(sanitized, "--") {
		sanitized = strings.ReplaceAll(sanitized, "--", "-")
	}

	// Trim hyphens from start and end
	sanitized = strings.Trim(sanitized, "-")

	return sanitized
}

// CreateBaseGameMetadata creates metadata for the base game faction
func CreateBaseGameMetadata(displayName, description string) models.FactionMetadata {
	return models.FactionMetadata{
		Identifier:  "pa",
		DisplayName: displayName,
		Version:     "1.0.0",
		Author:      "Uber Entertainment",
		Description: description,
		Type:        "base-game",
	}
}

// CreateModMetadata creates metadata for a single mod faction
func CreateModMetadata(modInfo *loader.ModInfo) models.FactionMetadata {
	return models.FactionMetadata{
		Identifier:  modInfo.Identifier,
		DisplayName: modInfo.DisplayName,
		Version:     modInfo.Version,
		Author:      modInfo.Author,
		Description: modInfo.Description,
		DateCreated: modInfo.Date,
		Build:       modInfo.Build,
		Type:        "mod",
	}
}

// CreateCustomFactionMetadata creates metadata for a custom faction composed of multiple mods
func CreateCustomFactionMetadata(displayName string, modIdentifiers []string, mods []*loader.ModInfo) models.FactionMetadata {
	// Build description from mod list
	description := fmt.Sprintf("Custom faction composed of: %s", strings.Join(modIdentifiers, ", "))

	// Use first mod's identifier as base, or generate one
	identifier := displayName
	if len(modIdentifiers) > 0 {
		identifier = modIdentifiers[0]
	}

	// Collect authors
	authors := make([]string, 0, len(mods))
	seenAuthors := make(map[string]bool)
	for _, mod := range mods {
		if mod.Author != "" && !seenAuthors[mod.Author] {
			authors = append(authors, mod.Author)
			seenAuthors[mod.Author] = true
		}
	}

	return models.FactionMetadata{
		Identifier:  identifier,
		DisplayName: displayName,
		Version:     "1.0.0",
		Author:      strings.Join(authors, ", "),
		Description: description,
		Type:        "custom",
	}
}
