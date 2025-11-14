package loader

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Source represents a data source (directory or zip file)
type Source struct {
	Type       ModSourceType  // Type of source (pa, pa_ex1, server_mods, etc.)
	Path       string         // Directory path or zip file path
	IsZip      bool           // Whether this is a zip file
	ZipReader  *zip.ReadCloser // Zip reader if IsZip is true
	Identifier string         // Source identifier (pa, pa_ex1, or mod identifier)
}

// Loader handles loading and caching JSON files from PA installation and mods
type Loader struct {
	sources   []Source                        // Priority-ordered sources to search
	jsonCache map[string]map[string]interface{} // Cached JSON data
	safeNames map[string]string               // resource path -> safe name
	fullNames map[string]string               // safe name -> resource path
	expansion string                          // Expansion directory (e.g., "pa_ex1")
}

// NewMultiSourceLoader creates a loader from ModInfo array
// Supports both directory and zip file sources
func NewMultiSourceLoader(paRoot string, expansion string, mods []*ModInfo) (*Loader, error) {
	sources := make([]Source, 0, len(mods)+2)

	// Add mods in order (first has highest priority)
	for _, mod := range mods {
		if mod.IsZipped {
			// Open zip file
			zipReader, err := zip.OpenReader(mod.ZipPath)
			if err != nil {
				return nil, fmt.Errorf("failed to open zip %s: %w", mod.ZipPath, err)
			}

			sources = append(sources, Source{
				Type:       mod.SourceType,
				Path:       mod.ZipPath,
				IsZip:      true,
				ZipReader:  zipReader,
				Identifier: mod.Identifier,
			})
		} else {
			// Regular directory
			sources = append(sources, Source{
				Type:       mod.SourceType,
				Path:       mod.Directory,
				IsZip:      false,
				Identifier: mod.Identifier,
			})
		}
	}

	// Add expansion if it exists
	if expansion != "" {
		expPath := filepath.Join(paRoot, expansion)
		if _, err := os.Stat(expPath); err == nil {
			sources = append(sources, Source{
				Type:       ModSourceExpansion,
				Path:       expPath,
				IsZip:      false,
				Identifier: expansion,
			})
		}
	}

	// Add base game last (lowest priority)
	paPath := filepath.Join(paRoot, "pa")
	if _, err := os.Stat(paPath); err == nil {
		sources = append(sources, Source{
			Type:       ModSourceBaseGame,
			Path:       paPath,
			IsZip:      false,
			Identifier: "pa",
		})
	}

	return &Loader{
		sources:   sources,
		jsonCache: make(map[string]map[string]interface{}),
		safeNames: make(map[string]string),
		fullNames: make(map[string]string),
		expansion: expansion,
	}, nil
}

// Close closes any open zip readers
func (l *Loader) Close() error {
	for _, src := range l.sources {
		if src.IsZip && src.ZipReader != nil {
			if err := src.ZipReader.Close(); err != nil {
				return err
			}
		}
	}
	return nil
}

// Sources returns the loader's sources for external access
func (l *Loader) Sources() []Source {
	return l.sources
}

// GetJSON loads and caches a JSON file by resource name
// Handles expansion shadowing (pa_ex1 overrides pa files)
func (l *Loader) GetJSON(resourceName string) (map[string]interface{}, error) {
	// Check cache first
	if cached, ok := l.jsonCache[resourceName]; ok {
		return cached, nil
	}

	// Build list of possible file paths
	var paths []string

	// If expansion is set and this is a /pa/ file, check expansion first
	if l.expansion != "" && strings.HasPrefix(resourceName, "/pa/") {
		expPath := "/" + l.expansion + "/" + resourceName[4:]
		paths = append(paths, expPath)
	}
	paths = append(paths, resourceName)

	// Try each source in priority order
	for _, src := range l.sources {
		for _, resPath := range paths {
			var data map[string]interface{}
			var err error

			if src.IsZip {
				data, err = l.loadJSONFromZip(src, resPath)
			} else {
				data, err = l.loadJSONFromDir(src, resPath)
			}

			if err == nil {
				// Cache under all possible names
				for _, p := range paths {
					l.jsonCache[p] = data
				}
				return data, nil
			}
		}
	}

	return nil, fmt.Errorf("resource not found: %s", resourceName)
}

// GetSafeName returns a unique short identifier for a resource path
// Priority: filename > dirname > dirname_N
func (l *Loader) GetSafeName(resourceName string) string {
	if safeName, ok := l.safeNames[resourceName]; ok {
		return safeName
	}

	// Extract directory and filename
	parts := strings.Split(strings.Trim(resourceName, "/"), "/")
	if len(parts) < 2 {
		// Fallback for unusual paths
		safeName := strings.TrimSuffix(filepath.Base(resourceName), ".json")
		l.safeNames[resourceName] = safeName
		l.fullNames[safeName] = resourceName
		return safeName
	}

	dirname := parts[len(parts)-2]
	filename := strings.TrimSuffix(parts[len(parts)-1], ".json")

	// Try filename first
	if _, exists := l.fullNames[filename]; !exists {
		l.safeNames[resourceName] = filename
		l.fullNames[filename] = resourceName
		return filename
	}

	// Try dirname
	if _, exists := l.fullNames[dirname]; !exists {
		l.safeNames[resourceName] = dirname
		l.fullNames[dirname] = resourceName
		return dirname
	}

	// Fallback: add numeric suffix
	for i := 2; ; i++ {
		safeName := fmt.Sprintf("%s_%d", dirname, i)
		if _, exists := l.fullNames[safeName]; !exists {
			l.safeNames[resourceName] = safeName
			l.fullNames[safeName] = resourceName
			return safeName
		}
	}
}

// Helper functions for extracting typed values from JSON maps

// GetString extracts a string value with a default
func GetString(data map[string]interface{}, key string, defaultVal string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultVal
}

// GetFloat extracts a float64 value with a default (handles both float and int)
func GetFloat(data map[string]interface{}, key string, defaultVal float64) float64 {
	if val, ok := data[key]; ok {
		switch v := val.(type) {
		case float64:
			return v
		case int:
			return float64(v)
		}
	}
	return defaultVal
}

// GetInt extracts an int value with a default (handles both int and float64)
func GetInt(data map[string]interface{}, key string, defaultVal int) int {
	if val, ok := data[key]; ok {
		switch v := val.(type) {
		case float64:
			return int(v)
		case int:
			return v
		}
	}
	return defaultVal
}

// GetBool extracts a boolean value with a default
func GetBool(data map[string]interface{}, key string, defaultVal bool) bool {
	if val, ok := data[key]; ok {
		if b, ok := val.(bool); ok {
			return b
		}
	}
	return defaultVal
}

// GetMap extracts a nested map (returns empty map if not found)
func GetMap(data map[string]interface{}, key string) map[string]interface{} {
	if val, ok := data[key]; ok {
		if m, ok := val.(map[string]interface{}); ok {
			return m
		}
	}
	return make(map[string]interface{})
}

// GetArray extracts an array (returns empty array if not found)
func GetArray(data map[string]interface{}, key string) []interface{} {
	if val, ok := data[key]; ok {
		if arr, ok := val.([]interface{}); ok {
			return arr
		}
	}
	return []interface{}{}
}

// Delocalize removes localization markers from text
func Delocalize(text string) string {
	// Handle !LOC(...):text format (old-style)
	if strings.HasPrefix(text, "!LOC(") {
		if idx := strings.Index(text, "):"); idx != -1 {
			return text[idx+2:]
		}
	}

	// Handle !LOC:text format (new-style)
	if strings.HasPrefix(text, "!LOC:") {
		return text[5:]
	}

	return text
}

// LoadMergedUnitList loads and merges unit_list.json from all sources (Phase 1.5+)
// Returns deduplicated list of unit paths with provenance tracking
func (l *Loader) LoadMergedUnitList() ([]string, map[string]string, error) {
	unitPaths := make([]string, 0)
	seenUnits := make(map[string]bool)
	provenance := make(map[string]string) // unit path -> source identifier

	// Process sources in priority order
	for _, src := range l.sources {
		unitListPath := "/pa/units/unit_list.json"

		var data map[string]interface{}
		var err error

		if src.IsZip {
			data, err = l.loadJSONFromZip(src, unitListPath)
		} else {
			data, err = l.loadJSONFromDir(src, unitListPath)
		}

		if err != nil {
			// Unit list might not exist in this source, continue
			continue
		}

		// Parse units array
		unitsInterface, ok := data["units"]
		if !ok {
			continue
		}

		unitsList, ok := unitsInterface.([]interface{})
		if !ok {
			continue
		}

		// Add units to merged list (skip duplicates)
		for _, u := range unitsList {
			if unitPath, ok := u.(string); ok {
				if !seenUnits[unitPath] {
					unitPaths = append(unitPaths, unitPath)
					seenUnits[unitPath] = true
					provenance[unitPath] = src.Identifier
				}
			}
		}
	}

	if len(unitPaths) == 0 {
		return nil, nil, fmt.Errorf("no unit_list.json found in any source")
	}

	return unitPaths, provenance, nil
}

// loadJSONFromZip loads a JSON file from a zip archive
func (l *Loader) loadJSONFromZip(src Source, resourcePath string) (map[string]interface{}, error) {
	if src.ZipReader == nil {
		return nil, fmt.Errorf("zip reader is nil")
	}

	// Convert resource path to zip entry path (remove leading slash)
	entryPath := strings.TrimPrefix(resourcePath, "/")

	// Search for the file in the zip
	for _, file := range src.ZipReader.File {
		if file.Name == entryPath || strings.HasSuffix(file.Name, entryPath) {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open file in zip: %w", err)
			}
			defer rc.Close()

			data, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("failed to read file from zip: %w", err)
			}

			var result map[string]interface{}
			if err := json.Unmarshal(data, &result); err != nil {
				return nil, fmt.Errorf("failed to parse JSON: %w", err)
			}

			return result, nil
		}
	}

	return nil, fmt.Errorf("file not found in zip: %s", resourcePath)
}

// loadJSONFromDir loads a JSON file from a directory
func (l *Loader) loadJSONFromDir(src Source, resourcePath string) (map[string]interface{}, error) {
	// Strip leading /pa/ or /pa_ex1/ prefix since source path already includes it
	trimmedPath := resourcePath
	if strings.HasPrefix(resourcePath, "/"+src.Identifier+"/") {
		trimmedPath = strings.TrimPrefix(resourcePath, "/"+src.Identifier+"/")
	} else if strings.HasPrefix(resourcePath, "/pa/") && src.Identifier == "pa_ex1" {
		// For expansion, also try pa paths
		trimmedPath = strings.TrimPrefix(resourcePath, "/pa/")
	}

	fullPath := filepath.Join(src.Path, filepath.FromSlash(trimmedPath))

	if _, err := os.Stat(fullPath); err != nil {
		return nil, err
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return result, nil
}

// UnitFileInfo represents a discovered file for a unit with its source
type UnitFileInfo struct {
	RelativePath string // Relative path within unit folder (e.g., "tank.json", "tank_icon_buildbar.png")
	FullPath     string // Full filesystem path or zip entry path
	Source       string // Source identifier (pa, pa_ex1, mod identifier)
	IsFromZip    bool   // Whether this file comes from a zip
}

// GetAllFilesForUnit discovers all files related to a unit across all sources
// Returns map of filename -> UnitFileInfo with first-wins priority
func (l *Loader) GetAllFilesForUnit(unitPath string) (map[string]*UnitFileInfo, error) {
	files := make(map[string]*UnitFileInfo)

	// Extract unit directory from unit path (use path package, not filepath, to keep forward slashes)
	// e.g., "/pa/units/land/tank/tank.json" -> "pa/units/land/tank"
	trimmed := strings.TrimPrefix(unitPath, "/")
	lastSlash := strings.LastIndex(trimmed, "/")
	var unitDir string
	if lastSlash >= 0 {
		unitDir = trimmed[:lastSlash]
	} else {
		unitDir = ""
	}

	// Extract unit identifier for icon search
	// e.g., "tank.json" -> "tank"
	unitID := strings.TrimSuffix(filepath.Base(unitPath), ".json")

	// Search all sources for files in the unit directory
	for _, src := range l.sources {
		if src.IsZip {
			// Search in zip file
			filesInZip := l.findFilesInZip(src, unitDir, unitID)
			for filename, fileInfo := range filesInZip {
				if _, exists := files[filename]; !exists {
					files[filename] = fileInfo
				}
			}
		} else {
			// Search in directory
			filesInDir := l.findFilesInDir(src, unitDir, unitID)
			for filename, fileInfo := range filesInDir {
				if _, exists := files[filename]; !exists {
					files[filename] = fileInfo
				}
			}
		}
	}

	return files, nil
}

// findFilesInDir finds all files in a unit directory from a directory source
func (l *Loader) findFilesInDir(src Source, unitDir string, unitID string) map[string]*UnitFileInfo {
	files := make(map[string]*UnitFileInfo)

	// Strip leading pa/ or pa_ex1/ from unitDir since src.Path already includes it
	trimmedUnitDir := unitDir
	if strings.HasPrefix(unitDir, src.Identifier+"/") {
		trimmedUnitDir = strings.TrimPrefix(unitDir, src.Identifier+"/")
	} else if strings.HasPrefix(unitDir, "pa/") && src.Identifier == "pa_ex1" {
		trimmedUnitDir = strings.TrimPrefix(unitDir, "pa/")
	}

	// Check unit directory
	fullUnitDir := filepath.Join(src.Path, filepath.FromSlash(trimmedUnitDir))
	if entries, err := os.ReadDir(fullUnitDir); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				filename := entry.Name()
				// Skip .papa files (3D models/textures - too large)
				if strings.HasSuffix(strings.ToLower(filename), ".papa") {
					continue
				}
				files[filename] = &UnitFileInfo{
					RelativePath: filename,
					FullPath:     filepath.Join(fullUnitDir, filename),
					Source:       src.Identifier,
					IsFromZip:    false,
				}
			}
		}
	}

	// Also search for icon in common locations (may be in different directory)
	iconName := unitID + "_icon_buildbar.png"
	iconPaths := []string{
		filepath.Join(trimmedUnitDir, iconName),                                    // Same directory as unit
		filepath.Join(filepath.Dir(trimmedUnitDir), "icon_atlas", iconName),       // icon_atlas subdirectory
		filepath.Join("ui", "mods", filepath.Base(trimmedUnitDir), iconName),      // UI mods directory
	}

	for _, iconPath := range iconPaths {
		fullIconPath := filepath.Join(src.Path, filepath.FromSlash(iconPath))
		if _, err := os.Stat(fullIconPath); err == nil {
			if _, exists := files[iconName]; !exists {
				files[iconName] = &UnitFileInfo{
					RelativePath: iconName,
					FullPath:     fullIconPath,
					Source:       src.Identifier,
					IsFromZip:    false,
				}
			}
		}
	}

	return files
}

// findFilesInZip finds all files in a unit directory from a zip source
func (l *Loader) findFilesInZip(src Source, unitDir string, unitID string) map[string]*UnitFileInfo {
	files := make(map[string]*UnitFileInfo)

	if src.ZipReader == nil {
		return files
	}

	// Normalize unit directory for zip entries
	unitDirNorm := strings.TrimPrefix(unitDir, "/")

	// Search zip entries
	for _, file := range src.ZipReader.File {
		// Check if file is in unit directory
		if strings.HasPrefix(file.Name, unitDirNorm+"/") {
			relPath := strings.TrimPrefix(file.Name, unitDirNorm+"/")
			// Skip subdirectories
			if !strings.Contains(relPath, "/") && relPath != "" {
				filename := filepath.Base(file.Name)
				// Skip .papa files (3D models/textures - too large)
				if strings.HasSuffix(strings.ToLower(filename), ".papa") {
					continue
				}
				files[filename] = &UnitFileInfo{
					RelativePath: filename,
					FullPath:     file.Name,
					Source:       src.Identifier,
					IsFromZip:    true,
				}
			}
		}

		// Also check for icon files (may be in different locations)
		iconName := unitID + "_icon_buildbar.png"
		if strings.HasSuffix(file.Name, iconName) {
			if _, exists := files[iconName]; !exists {
				files[iconName] = &UnitFileInfo{
					RelativePath: iconName,
					FullPath:     file.Name,
					Source:       src.Identifier,
					IsFromZip:    true,
				}
			}
		}
	}

	return files
}
