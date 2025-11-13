package loader

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Loader handles loading and caching JSON files from PA installation and mods
type Loader struct {
	dataDirs  []string                       // Priority-ordered directories to search
	jsonCache map[string]map[string]interface{} // Cached JSON data
	safeNames map[string]string              // resource path -> safe name
	fullNames map[string]string              // safe name -> resource path
	expansion string                         // Expansion directory (e.g., "pa_ex1")
}

// NewLoader creates a new loader for the base game
func NewLoader(paRoot string, expansion string) *Loader {
	return &Loader{
		dataDirs:  []string{paRoot},
		jsonCache: make(map[string]map[string]interface{}),
		safeNames: make(map[string]string),
		fullNames: make(map[string]string),
		expansion: expansion,
	}
}

// NewModLoader creates a new loader with mod overlay support
func NewModLoader(paRoot string, expansion string, modDirs []string) *Loader {
	// Build priority list: mods first (highest priority), then base game
	dataDirs := make([]string, 0, len(modDirs)+1)

	// Add mod directories in order (first mod has highest priority)
	for _, modDir := range modDirs {
		if info, err := os.Stat(modDir); err == nil && info.IsDir() {
			dataDirs = append(dataDirs, modDir)
		}
	}

	// Add base game last (lowest priority)
	dataDirs = append(dataDirs, paRoot)

	return &Loader{
		dataDirs:  dataDirs,
		jsonCache: make(map[string]map[string]interface{}),
		safeNames: make(map[string]string),
		fullNames: make(map[string]string),
		expansion: expansion,
	}
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

	// Try each data directory (mods first, then base)
	for _, dataDir := range l.dataDirs {
		for _, resPath := range paths {
			fullPath := filepath.Join(dataDir, filepath.FromSlash(resPath))

			if _, err := os.Stat(fullPath); err == nil {
				// File exists, load it
				data, err := os.ReadFile(fullPath)
				if err != nil {
					return nil, fmt.Errorf("failed to read %s: %w", fullPath, err)
				}

				var result map[string]interface{}
				if err := json.Unmarshal(data, &result); err != nil {
					return nil, fmt.Errorf("failed to parse JSON in %s: %w", fullPath, err)
				}

				// Cache under all possible names
				for _, p := range paths {
					l.jsonCache[p] = result
				}

				return result, nil
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

// LoadUnitList loads the main unit_list.json file
func (l *Loader) LoadUnitList() ([]string, error) {
	unitListPath := "/pa/units/unit_list.json"

	data, err := l.GetJSON(unitListPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load unit list: %w", err)
	}

	unitsInterface, ok := data["units"]
	if !ok {
		return nil, fmt.Errorf("unit_list.json missing 'units' key")
	}

	unitsList, ok := unitsInterface.([]interface{})
	if !ok {
		return nil, fmt.Errorf("units field is not an array")
	}

	units := make([]string, 0, len(unitsList))
	for _, u := range unitsList {
		if unitPath, ok := u.(string); ok {
			units = append(units, unitPath)
		}
	}

	return units, nil
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
