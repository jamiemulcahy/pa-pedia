package loader

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Source represents a data source (directory or zip file)
type Source struct {
	Type       ModSourceType         // Type of source (pa, pa_ex1, server_mods, etc.)
	Path       string                // Directory path or zip file path
	IsZip      bool                  // Whether this is a zip file
	ZipReader  *zip.ReadCloser       // Zip reader if IsZip is true
	Identifier string                // Source identifier (pa, pa_ex1, or mod identifier)
	zipIndex   map[string]*zip.File  // Index of zip files by normalized path (populated once on open)
}

// ZipIndex returns the zip file index for this source (O(1) file lookups)
// Returns nil if this is not a zip source
func (s *Source) ZipIndex() map[string]*zip.File {
	return s.zipIndex
}

// Loader handles loading and caching JSON files from PA installation and mods
type Loader struct {
	sources     []Source                        // Priority-ordered sources to search
	jsonCache   map[string]map[string]interface{} // Cached JSON data
	sourceCache map[string]*SpecFileInfo        // Cached source info for resources
	safeNames   map[string]string               // resource path -> safe name
	fullNames   map[string]string               // safe name -> resource path
	expansion   string                          // Expansion directory (e.g., "pa_ex1")
}

// NewMultiSourceLoader creates a loader from ModInfo array
// Supports both directory and zip file sources
//
// IMPORTANT: Callers MUST call Close() to release zip file resources:
//   l, err := loader.NewMultiSourceLoader(...)
//   if err != nil {
//     return err  // Resources already cleaned up
//   }
//   defer l.Close()  // Essential for zip resource cleanup
//
// Note: This function automatically cleans up any opened resources before returning an error,
// so callers do NOT need to call Close() on error. On success, the returned loader must be
// closed by the caller using defer.
func NewMultiSourceLoader(paRoot string, expansion string, mods []*ModInfo) (*Loader, error) {
	l := &Loader{
		sources:     make([]Source, 0, len(mods)+2),
		jsonCache:   make(map[string]map[string]interface{}),
		sourceCache: make(map[string]*SpecFileInfo),
		safeNames:   make(map[string]string),
		fullNames:   make(map[string]string),
		expansion:   expansion,
	}

	// Add mods in order (first has highest priority)
	for _, mod := range mods {
		if mod.IsZipped {
			// Open zip file
			zipReader, err := zip.OpenReader(mod.ZipPath)
			if err != nil {
				// Clean up already-opened zips before returning error
				l.Close()
				return nil, fmt.Errorf("failed to open zip %s: %w", mod.ZipPath, err)
			}

			// Build zip file index for O(1) lookups (populated once per zip)
			// For typical PA mods with ~100-500 files, this index uses ~10-50KB of memory
			// but saves O(n) scans on every file copy, making extraction much faster
			zipIndex := make(map[string]*zip.File, len(zipReader.File))
			for _, file := range zipReader.File {
				// Normalize path for consistent lookups (remove leading slash, convert to forward slashes)
				normalizedPath := strings.TrimPrefix(filepath.ToSlash(file.Name), "/")
				zipIndex[normalizedPath] = file
			}

			l.sources = append(l.sources, Source{
				Type:       mod.SourceType,
				Path:       mod.ZipPath,
				IsZip:      true,
				ZipReader:  zipReader,
				Identifier: mod.Identifier,
				zipIndex:   zipIndex,
			})
		} else {
			// Regular directory
			l.sources = append(l.sources, Source{
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
			l.sources = append(l.sources, Source{
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
		l.sources = append(l.sources, Source{
			Type:       ModSourceBaseGame,
			Path:       paPath,
			IsZip:      false,
			Identifier: "pa",
		})
	}

	return l, nil
}

// Close closes any open zip readers
// Collects all errors instead of returning on first error to ensure all resources are cleaned up
func (l *Loader) Close() error {
	var errs []error
	for _, src := range l.sources {
		if src.IsZip && src.ZipReader != nil {
			if err := src.ZipReader.Close(); err != nil {
				errs = append(errs, fmt.Errorf("failed to close %s: %w", src.Path, err))
			}
		}
	}

	// Use errors.Join to properly combine errors with unwrapping support
	return errors.Join(errs...)
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
			var fullPath string

			if src.IsZip {
				data, err = l.loadJSONFromZip(src, resPath)
				if err == nil {
					// For zip, the full path is the normalized path
					fullPath = strings.TrimPrefix(filepath.ToSlash(resPath), "/")
				}
			} else {
				data, err = l.loadJSONFromDir(src, resPath)
				if err == nil {
					// For filesystem, compute full path
					trimmedPath := resPath
					if strings.HasPrefix(resPath, "/"+src.Identifier+"/") {
						trimmedPath = strings.TrimPrefix(resPath, "/"+src.Identifier+"/")
					} else if strings.HasPrefix(resPath, "/pa/") && src.Identifier == "pa_ex1" {
						trimmedPath = strings.TrimPrefix(resPath, "/pa/")
					}
					fullPath = filepath.Join(src.Path, filepath.FromSlash(trimmedPath))
				}
			}

			if err == nil {
				// Cache under all possible names
				for _, p := range paths {
					l.jsonCache[p] = data
				}
				// Cache source information
				l.sourceCache[resourceName] = &SpecFileInfo{
					ResourcePath: resourceName,
					Source:       src.Identifier,
					IsFromZip:    src.IsZip,
					FullPath:     fullPath,
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
//
// Memory usage: Maintains two maps (seenUnits, provenance) with one entry per unique unit.
// For PA Titans with ~200-300 units across all sources, this is ~20-30KB total.
// The maps are small because they only store unit paths (strings), not full unit data.
func (l *Loader) LoadMergedUnitList() ([]string, map[string]string, error) {
	// Check that sources are configured
	if len(l.sources) == 0 {
		return nil, nil, fmt.Errorf("no sources configured in loader")
	}

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

	// Normalize resource path for comparison (remove leading slash)
	normalizedResourcePath := strings.TrimPrefix(filepath.ToSlash(resourcePath), "/")

	// Use zip index for O(1) lookup instead of O(n) scan
	file, found := src.zipIndex[normalizedResourcePath]
	if !found {
		return nil, fmt.Errorf("file not found in zip: %s", resourcePath)
	}

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

// shouldIncludeUnitFile determines if a file should be included in the unit export.
// We only include essential files:
// - <unit_id>.json (raw PA data)
// - <unit_id>_icon_buildbar.png (unit icon)
// Note: <unit_id>_resolved.json is generated by the exporter, not copied from sources
func shouldIncludeUnitFile(filename string, unitID string) bool {
	// Include the primary unit JSON file
	if filename == unitID+".json" {
		return true
	}

	// Include the buildbar icon
	if filename == unitID+"_icon_buildbar.png" {
		return true
	}

	// Exclude all other files (tool_weapon, ammo, etc.)
	return false
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
				// Only include essential files
				if !shouldIncludeUnitFile(filename, unitID) {
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
	// Break after finding first icon to avoid unnecessary filesystem checks
	iconName := unitID + "_icon_buildbar.png"
	if _, exists := files[iconName]; !exists {
		iconPaths := []string{
			filepath.Join(trimmedUnitDir, iconName),                                    // Same directory as unit
			filepath.Join(filepath.Dir(trimmedUnitDir), "icon_atlas", iconName),       // icon_atlas subdirectory
			filepath.Join("ui", "mods", filepath.Base(trimmedUnitDir), iconName),      // UI mods directory
		}

		for _, iconPath := range iconPaths {
			fullIconPath := filepath.Join(src.Path, filepath.FromSlash(iconPath))
			if _, err := os.Stat(fullIconPath); err == nil {
				files[iconName] = &UnitFileInfo{
					RelativePath: iconName,
					FullPath:     fullIconPath,
					Source:       src.Identifier,
					IsFromZip:    false,
				}
				break // Stop searching once icon is found
			}
		}
	}

	return files
}

// SpecFileInfo represents a discovered spec file (weapon, ammo, base_spec) with its source
type SpecFileInfo struct {
	ResourcePath string // PA resource path (e.g., "/pa/units/land/tank/tank_tool_weapon.json")
	Source       string // Source identifier (pa, pa_ex1, mod identifier)
	IsFromZip    bool   // Whether this file comes from a zip
	FullPath     string // Full filesystem path or zip entry path
}

// GetReferencedSpecFiles collects all spec files referenced by a unit (base_specs, weapons, ammo)
// Returns map of resource path -> SpecFileInfo with first-wins priority
func (l *Loader) GetReferencedSpecFiles(unitPath string) (map[string]*SpecFileInfo, error) {
	specs := make(map[string]*SpecFileInfo)
	visited := make(map[string]bool) // Prevent infinite recursion

	// Start with the unit file itself
	if err := l.collectSpecsRecursively(unitPath, specs, visited); err != nil {
		return nil, err
	}

	return specs, nil
}

// collectSpecsRecursively loads a JSON file and collects all referenced specs
func (l *Loader) collectSpecsRecursively(resourcePath string, specs map[string]*SpecFileInfo, visited map[string]bool) error {
	// Prevent infinite recursion
	if visited[resourcePath] {
		return nil
	}
	visited[resourcePath] = true

	// Load the JSON file
	data, err := l.GetJSON(resourcePath)
	if err != nil {
		return nil // File might not exist, skip silently
	}

	// Find which source provided this file and add it to specs
	specInfo := l.findSpecSource(resourcePath)
	if specInfo != nil {
		specs[resourcePath] = specInfo
	}

	// Collect base_spec
	if baseSpec, ok := data["base_spec"].(string); ok && baseSpec != "" {
		if err := l.collectSpecsRecursively(baseSpec, specs, visited); err != nil {
			// Log but don't fail - base spec might not exist
		}
	}

	// Collect tools (weapons, build arms)
	if toolsInterface, ok := data["tools"].([]interface{}); ok {
		for _, toolInterface := range toolsInterface {
			if tool, ok := toolInterface.(map[string]interface{}); ok {
				if specID, ok := tool["spec_id"].(string); ok && specID != "" {
					if err := l.collectSpecsRecursively(specID, specs, visited); err != nil {
						// Log but don't fail
					}
				}
			}
		}
	}

	// Collect ammo_id from weapon specs
	if ammoID, ok := data["ammo_id"].(string); ok && ammoID != "" {
		if err := l.collectSpecsRecursively(ammoID, specs, visited); err != nil {
			// Log but don't fail
		}
	}

	// Handle ammo_id as array format
	if ammoIDArray, ok := data["ammo_id"].([]interface{}); ok {
		for _, ammoItem := range ammoIDArray {
			if ammoMap, ok := ammoItem.(map[string]interface{}); ok {
				if id, ok := ammoMap["id"].(string); ok && id != "" {
					if err := l.collectSpecsRecursively(id, specs, visited); err != nil {
						// Log but don't fail
					}
				}
			}
		}
	}

	// Collect death_weapon ground_ammo_spec
	if deathWeapon, ok := data["death_weapon"].(map[string]interface{}); ok {
		if groundAmmoSpec, ok := deathWeapon["ground_ammo_spec"].(string); ok && groundAmmoSpec != "" {
			if err := l.collectSpecsRecursively(groundAmmoSpec, specs, visited); err != nil {
				// Log but don't fail
			}
		}
	}

	return nil
}

// findSpecSource finds which source provides a resource and returns its info
// Uses cached source information from GetJSON calls for performance
func (l *Loader) findSpecSource(resourcePath string) *SpecFileInfo {
	// Check source cache first (populated by GetJSON)
	if cached, ok := l.sourceCache[resourcePath]; ok {
		return cached
	}

	// Fallback: search all sources (shouldn't happen often if GetJSON was called first)
	// Build list of possible file paths (handle expansion shadowing)
	var paths []string
	if l.expansion != "" && strings.HasPrefix(resourcePath, "/pa/") {
		expPath := "/" + l.expansion + "/" + resourcePath[4:]
		paths = append(paths, expPath)
	}
	paths = append(paths, resourcePath)

	// Try each source in priority order
	for _, src := range l.sources {
		for _, resPath := range paths {
			if src.IsZip {
				// Check in zip
				normalizedPath := strings.TrimPrefix(filepath.ToSlash(resPath), "/")
				if _, found := src.zipIndex[normalizedPath]; found {
					info := &SpecFileInfo{
						ResourcePath: resourcePath,
						Source:       src.Identifier,
						IsFromZip:    true,
						FullPath:     normalizedPath,
					}
					l.sourceCache[resourcePath] = info
					return info
				}
			} else {
				// Check in directory
				trimmedPath := resPath
				if strings.HasPrefix(resPath, "/"+src.Identifier+"/") {
					trimmedPath = strings.TrimPrefix(resPath, "/"+src.Identifier+"/")
				} else if strings.HasPrefix(resPath, "/pa/") && src.Identifier == "pa_ex1" {
					trimmedPath = strings.TrimPrefix(resPath, "/pa/")
				}

				fullPath := filepath.Join(src.Path, filepath.FromSlash(trimmedPath))
				if _, err := os.Stat(fullPath); err == nil {
					info := &SpecFileInfo{
						ResourcePath: resourcePath,
						Source:       src.Identifier,
						IsFromZip:    false,
						FullPath:     fullPath,
					}
					l.sourceCache[resourcePath] = info
					return info
				}
			}
		}
	}

	return nil
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
			// Skip subdirectories - we only want files directly in the unit directory
			// (not nested directories). relPath should not contain "/" for direct children.
			if !strings.Contains(relPath, "/") && relPath != "" {
				filename := filepath.Base(file.Name)
				// Only include essential files
				if !shouldIncludeUnitFile(filename, unitID) {
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
