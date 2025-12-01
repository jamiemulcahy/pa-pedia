package exporter

import (
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

// ExportFaction exports a faction using the new assets structure
func (e *FactionExporter) ExportFaction(metadata models.FactionMetadata, units []models.Unit) error {
	// Create faction folder
	factionDir := filepath.Join(e.OutputDir, SanitizeFolderName(metadata.DisplayName))

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

	// Write metadata.json
	if err := e.writeMetadata(factionDir, metadata); err != nil {
		return fmt.Errorf("failed to write metadata: %w", err)
	}

	// Build lightweight index and export unit files to assets
	index, err := e.exportUnitsToAssets(assetsDir, units)
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
		fmt.Printf("  - Assets: mirrored PA structure in assets/\n")
	}

	return nil
}

// exportUnitsToAssets exports all unit files and referenced specs to assets folder
// Uses PA path structure (e.g., assets/pa/units/land/tank/tank.json)
func (e *FactionExporter) exportUnitsToAssets(assetsDir string, units []models.Unit) (*models.FactionIndex, error) {
	index := &models.FactionIndex{
		Units: make([]models.UnitIndexEntry, 0, len(units)),
	}

	// Track all copied assets for deduplication (first-wins)
	copiedAssets := make(map[string]bool)

	var criticalFailures []string // Track units that failed to export their primary JSON

	for i, unit := range units {
		// Report progress at 10% intervals or on completion for smoother feedback
		if e.Verbose {
			progress := float64(i+1) / float64(len(units)) * 100
			prevProgress := float64(i) / float64(len(units)) * 100
			// Update when crossing a 10% threshold or on last unit
			if int(progress/10) > int(prevProgress/10) || i == len(units)-1 {
				fmt.Printf("  Processing units: %d/%d (%.0f%%)\r", i+1, len(units), progress)
			}
		}

		// Collect all referenced spec files for this unit
		specFiles, err := e.Loader.GetReferencedSpecFiles(unit.ResourceName, e.Verbose)
		if err != nil {
			if e.Verbose {
				fmt.Fprintf(os.Stderr, "\nWarning: Failed to collect spec files for %s: %v\n", unit.ID, err)
			}
		}

		// Also get unit files (for icon)
		unitFiles, err := e.Loader.GetAllFilesForUnit(unit.ResourceName)
		if err != nil {
			if e.Verbose {
				fmt.Fprintf(os.Stderr, "\nWarning: Failed to discover files for %s: %v\n", unit.ID, err)
			}
			unitFiles = make(map[string]*loader.UnitFileInfo)
		}

		// Track files for this unit's index entry
		indexFiles := make([]models.UnitFile, 0)
		primaryJSONFound := false

		// Copy all spec files to assets with PA path structure
		for resourcePath, specInfo := range specFiles {
			// Convert resource path to assets path (e.g., /pa/units/land/tank/tank.json -> pa/units/land/tank/tank.json)
			assetPath := strings.TrimPrefix(resourcePath, "/")

			// Skip if already copied (first-wins deduplication)
			if copiedAssets[assetPath] {
				// Still track if this is the primary JSON for this unit
				if resourcePath == unit.ResourceName {
					primaryJSONFound = true
					indexFiles = append(indexFiles, models.UnitFile{
						Path:   assetPath,
						Source: specInfo.Source,
					})
				}
				continue
			}

			// Create destination path
			destPath := filepath.Join(assetsDir, filepath.FromSlash(assetPath))

			// Ensure directory exists
			if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
				if e.Verbose {
					fmt.Fprintf(os.Stderr, "\nWarning: Failed to create directory for %s: %v\n", assetPath, err)
				}
				continue
			}

			// Copy the file
			if err := e.copySpecFile(specInfo, destPath); err != nil {
				// Check if this is the primary unit JSON
				if resourcePath == unit.ResourceName {
					fmt.Fprintf(os.Stderr, "\nError: Failed to copy primary file for unit %s: %v\n", unit.ID, err)
					criticalFailures = append(criticalFailures, unit.ID)
				} else if e.Verbose {
					fmt.Fprintf(os.Stderr, "\nWarning: Failed to copy %s: %v\n", assetPath, err)
				}
				continue
			}

			copiedAssets[assetPath] = true

			// Track primary JSON for this unit
			if resourcePath == unit.ResourceName {
				primaryJSONFound = true
				indexFiles = append(indexFiles, models.UnitFile{
					Path:   assetPath,
					Source: specInfo.Source,
				})
			}
		}

		// Copy icon file to assets
		for filename, fileInfo := range unitFiles {
			// Only copy icon files (primary JSON is handled via spec files)
			if !strings.HasSuffix(filename, "_icon_buildbar.png") {
				continue
			}

			// Determine asset path for icon - use same directory as unit JSON
			unitDir := strings.TrimPrefix(filepath.Dir(unit.ResourceName), "/")
			assetPath := filepath.ToSlash(filepath.Join(unitDir, filename))

			// Skip if already copied
			if copiedAssets[assetPath] {
				continue
			}

			destPath := filepath.Join(assetsDir, filepath.FromSlash(assetPath))

			// Ensure directory exists
			if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
				if e.Verbose {
					fmt.Fprintf(os.Stderr, "\nWarning: Failed to create directory for icon %s: %v\n", assetPath, err)
				}
				continue
			}

			// Copy icon file
			if err := e.copyFile(fileInfo, filepath.Dir(destPath)); err != nil {
				if e.Verbose {
					fmt.Fprintf(os.Stderr, "\nWarning: Failed to copy icon %s for unit %s: %v\n", filename, unit.ID, err)
				}
				continue
			}

			copiedAssets[assetPath] = true
			indexFiles = append(indexFiles, models.UnitFile{
				Path:   assetPath,
				Source: fileInfo.Source,
			})
		}

		// Warn if primary JSON wasn't found
		if !primaryJSONFound {
			fmt.Fprintf(os.Stderr, "\nWarning: Primary file not found for unit %s\n", unit.ID)
		}

		// Update unit image path to new assets structure
		unitDir := strings.TrimPrefix(filepath.Dir(unit.ResourceName), "/")
		unit.Image = filepath.ToSlash(filepath.Join("assets", unitDir, unit.ID+"_icon_buildbar.png"))

		// Create index entry with embedded unit data
		indexEntry := models.UnitIndexEntry{
			Identifier:  unit.ID,
			DisplayName: unit.DisplayName,
			UnitTypes:   unit.UnitTypes,
			Source:      determineUnitSource(unit.ResourceName),
			Files:       indexFiles,
			Unit:        unit,
		}

		index.Units = append(index.Units, indexEntry)
	}

	if e.Verbose {
		fmt.Println() // New line after progress indicator
		fmt.Printf("  Total unique assets copied: %d\n", len(copiedAssets))
	}

	// Report critical failures summary if any
	if len(criticalFailures) > 0 {
		fmt.Fprintf(os.Stderr, "\nWarning: %d unit(s) failed to export their primary JSON file:\n", len(criticalFailures))
		for _, unitID := range criticalFailures {
			fmt.Fprintf(os.Stderr, "  - %s\n", unitID)
		}
		fmt.Fprintln(os.Stderr)
	}

	return index, nil
}

// copySpecFile copies a spec file from source to destination
func (e *FactionExporter) copySpecFile(specInfo *loader.SpecFileInfo, destPath string) error {
	if specInfo.IsFromZip {
		// Find the source in the loader
		var source *loader.Source
		for _, src := range e.Loader.Sources() {
			if src.IsZip && src.Identifier == specInfo.Source {
				s := src
				source = &s
				break
			}
		}

		if source == nil || source.ZipReader == nil {
			return fmt.Errorf("zip reader not found for source %s", specInfo.Source)
		}

		// Use zip index for O(1) lookup
		file, found := source.ZipIndex()[specInfo.FullPath]
		if !found {
			return fmt.Errorf("file not found in zip: %s", specInfo.FullPath)
		}

		// Validate path to prevent path traversal attacks
		cleanPath := filepath.Clean(file.Name)
		if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) {
			return fmt.Errorf("invalid path in zip (path traversal attempt): %s", file.Name)
		}

		// Check file size
		if file.UncompressedSize64 > maxFileSize {
			return fmt.Errorf("file too large: %s (%d bytes, max %d bytes)", file.Name, file.UncompressedSize64, maxFileSize)
		}

		// Extract file
		rc, err := file.Open()
		if err != nil {
			return fmt.Errorf("failed to open file in zip: %w", err)
		}
		defer rc.Close()

		destFile, err := os.Create(destPath)
		if err != nil {
			return fmt.Errorf("failed to create destination file: %w", err)
		}
		defer destFile.Close()

		if _, err := io.Copy(destFile, rc); err != nil {
			return fmt.Errorf("failed to copy file data: %w", err)
		}

		return nil
	}

	// Copy from filesystem
	return e.copyFromFilesystem(specInfo.FullPath, destPath)
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

// Security limits for zip extraction to prevent zip bomb attacks
// These limits protect against malicious archives that could expand to consume excessive disk space
const (
	// maxFileSize limits individual file extraction to 100MB
	// PA unit files are typically small (JSON ~1-50KB, icons ~10-100KB, models ~1-5MB)
	// This limit is generous while preventing decompression bombs
	maxFileSize = 100 * 1024 * 1024 // 100MB per file

	// maxTotalSize provides a ceiling for total extraction size (500MB)
	// Currently not enforced but reserved for future total extraction tracking
	// A typical faction with 200 units should be well under this limit (~50-100MB total)
	maxTotalSize = 500 * 1024 * 1024 // 500MB total (tracked elsewhere if needed)
)

// copyFromZip extracts a file from a zip archive
func (e *FactionExporter) copyFromZip(fileInfo *loader.UnitFileInfo, destPath string) error {
	// Find the source in the loader
	var source *loader.Source
	for _, src := range e.Loader.Sources() {
		if src.IsZip && src.Identifier == fileInfo.Source {
			s := src // Create a copy to take address of
			source = &s
			break
		}
	}

	if source == nil || source.ZipReader == nil {
		return fmt.Errorf("zip reader not found for source %s", fileInfo.Source)
	}

	// Normalize paths for comparison
	// Clean path first to ensure consistent separators, then convert to forward slashes
	normalizedFullPath := strings.TrimPrefix(filepath.ToSlash(filepath.Clean(fileInfo.FullPath)), "/")

	// Use zip index for O(1) lookup instead of O(n) scan
	file, found := source.ZipIndex()[normalizedFullPath]
	if !found {
		return fmt.Errorf("file not found in zip: %s", fileInfo.FullPath)
	}

	// Validate path to prevent path traversal attacks
	if strings.Contains(file.Name, "..") {
		return fmt.Errorf("invalid path in zip (contains ..): %s", file.Name)
	}

	// Check file size to prevent zip bomb attacks
	if file.UncompressedSize64 > maxFileSize {
		return fmt.Errorf("file too large: %s (%d bytes, max %d bytes)", file.Name, file.UncompressedSize64, maxFileSize)
	}

	// Use anonymous function to ensure deferred closes happen immediately
	err := func() error {
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
	}()

	return err
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

// CopyResourceToFile copies a resource from the loader sources to a destination file.
// The resourcePath should be a PA resource path (e.g., "/ui/mods/my_mod/img/bg.png").
// Returns nil if the resource was copied successfully, or an error if not found or copy failed.
func (e *FactionExporter) CopyResourceToFile(resourcePath, destPath string) error {
	// Normalize the resource path
	normalizedPath := strings.TrimPrefix(filepath.ToSlash(filepath.Clean(resourcePath)), "/")

	// Search through all sources (first-wins priority)
	for _, src := range e.Loader.Sources() {
		if src.IsZip {
			// Check in zip
			if src.ZipReader == nil {
				continue
			}
			file, found := src.ZipIndex()[normalizedPath]
			if !found {
				continue
			}

			// Validate path to prevent path traversal attacks
			cleanPath := filepath.Clean(file.Name)
			if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) {
				return fmt.Errorf("invalid path in zip (path traversal attempt): %s", file.Name)
			}
			if file.UncompressedSize64 > maxFileSize {
				return fmt.Errorf("file too large: %s (%d bytes)", file.Name, file.UncompressedSize64)
			}

			// Create destination directory
			if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
				return fmt.Errorf("failed to create destination directory: %w", err)
			}

			// Extract from zip
			rc, err := file.Open()
			if err != nil {
				return fmt.Errorf("failed to open file in zip: %w", err)
			}
			defer rc.Close()

			destFile, err := os.Create(destPath)
			if err != nil {
				return fmt.Errorf("failed to create destination file: %w", err)
			}
			defer destFile.Close()

			// Use LimitReader to prevent decompression bombs
			limitedReader := io.LimitReader(rc, int64(maxFileSize)+1)
			n, err := io.Copy(destFile, limitedReader)
			if err != nil {
				return fmt.Errorf("failed to copy file from zip: %w", err)
			}
			if n > int64(maxFileSize) {
				os.Remove(destPath)
				return fmt.Errorf("file exceeded size limit during extraction")
			}

			if e.Verbose {
				fmt.Printf("  Copied resource: %s -> %s\n", resourcePath, destPath)
			}
			return nil
		} else {
			// Check in directory
			fullPath := filepath.Join(src.Path, normalizedPath)
			info, err := os.Stat(fullPath)
			if err != nil || info.IsDir() {
				continue
			}

			// Create destination directory
			if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
				return fmt.Errorf("failed to create destination directory: %w", err)
			}

			// Copy from filesystem
			if err := e.copyFromFilesystem(fullPath, destPath); err != nil {
				return err
			}

			if e.Verbose {
				fmt.Printf("  Copied resource: %s -> %s\n", resourcePath, destPath)
			}
			return nil
		}
	}

	return fmt.Errorf("resource not found in any source: %s", resourcePath)
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
// This provides a fallback source identifier based on the resource path prefix.
// For base game and expansion units, this correctly identifies the source from the path.
// For modded units, the actual source tracking via GetAllFilesForUnit provides more
// accurate provenance information since mods can modify base game paths.
// This function is primarily used as a simple heuristic when detailed provenance is unavailable.
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

// SanitizeFolderName converts a faction name to a valid folder name
func SanitizeFolderName(name string) string {
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
		Identifier:  strings.ToLower(displayName),
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
	// Build description with mod names instead of just IDs
	var description string
	if len(mods) > 0 {
		description = fmt.Sprintf("Custom faction combining %s", mods[0].DisplayName)
		if len(modIdentifiers) > 1 {
			description += fmt.Sprintf(" and %d other mod(s): %s", len(modIdentifiers)-1, strings.Join(modIdentifiers[1:], ", "))
		}
	} else {
		description = fmt.Sprintf("Custom faction: %s", displayName)
	}

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
		Type:        "mod", // Use "mod" type; custom factions are distinguished by presence of Mods field
		Mods:        modIdentifiers,
	}
}

// CreateMetadataFromProfile creates faction metadata from a profile and optional resolved mods.
// This is the unified way to create metadata for both base-game and modded factions.
func CreateMetadataFromProfile(profile *models.FactionProfile, resolvedMods []*loader.ModInfo) models.FactionMetadata {
	metadata := models.FactionMetadata{
		Identifier:  profile.ID,
		DisplayName: profile.DisplayName,
		Version:     "1.0.0",
	}

	// Use profile author if provided, otherwise collect from mods
	if profile.Author != "" {
		metadata.Author = profile.Author
	} else if len(resolvedMods) > 0 {
		// Collect unique authors from mods
		authors := make([]string, 0, len(resolvedMods))
		seenAuthors := make(map[string]bool)
		for _, mod := range resolvedMods {
			if mod.Author != "" && !seenAuthors[mod.Author] {
				authors = append(authors, mod.Author)
				seenAuthors[mod.Author] = true
			}
		}
		metadata.Author = strings.Join(authors, ", ")
	}

	// Use profile description if provided
	if profile.Description != "" {
		metadata.Description = profile.Description
	}

	// Set type based on whether mods are involved
	if len(profile.Mods) > 0 {
		metadata.Type = "mod"
		metadata.Mods = profile.Mods
	} else {
		metadata.Type = "base-game"
	}

	// Set background image path if provided (mirrors original path in assets/, actual copy happens in describe_faction)
	if profile.BackgroundImage != "" {
		normalizedPath := filepath.ToSlash(filepath.Clean(profile.BackgroundImage))
		normalizedPath = strings.TrimPrefix(normalizedPath, "/")
		metadata.BackgroundImage = "assets/" + normalizedPath
	}

	return metadata
}
