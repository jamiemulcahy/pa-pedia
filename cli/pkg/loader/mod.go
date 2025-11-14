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

// ModSourceType indicates where a mod was found
type ModSourceType string

const (
	ModSourceServerMods ModSourceType = "server_mods" // User-installed server mods (highest priority)
	ModSourceClientMods ModSourceType = "client_mods" // User-installed client mods (medium priority)
	ModSourceDownload   ModSourceType = "download"    // PA-managed downloads as zip files (lowest priority)
	ModSourceBaseGame   ModSourceType = "pa"          // Base game files
	ModSourceExpansion  ModSourceType = "pa_ex1"      // Titans expansion
)

// ModInfo represents metadata about a PA server mod
type ModInfo struct {
	Identifier  string        `json:"identifier"`
	DisplayName string        `json:"display_name"`
	Description string        `json:"description"`
	Version     string        `json:"version"`
	Author      string        `json:"author"`
	Date        string        `json:"date"`
	Build       string        `json:"build"`
	Directory   string        `json:"-"` // Not in JSON, added by loader (for extracted mods)
	ZipPath     string        `json:"-"` // Path to zip file (for zipped mods)
	SourceType  ModSourceType `json:"-"` // Where this mod was found
	IsZipped    bool          `json:"-"` // Whether this mod is in a zip file
}

// DiscoverMods scans the server_mods directory and returns available mods
func DiscoverMods(modsRoot string) (map[string]*ModInfo, error) {
	mods := make(map[string]*ModInfo)

	if modsRoot == "" {
		return mods, nil
	}

	// Check if mods_root exists
	if _, err := os.Stat(modsRoot); os.IsNotExist(err) {
		return mods, nil // No mods directory, return empty map
	}

	// Read directory entries
	entries, err := os.ReadDir(modsRoot)
	if err != nil {
		return nil, fmt.Errorf("failed to read mods directory: %w", err)
	}

	// Scan each subdirectory for modinfo.json
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		modDir := filepath.Join(modsRoot, entry.Name())
		modinfoPath := filepath.Join(modDir, "modinfo.json")

		// Check if modinfo.json exists
		if _, err := os.Stat(modinfoPath); err != nil {
			continue // No modinfo.json, skip this directory
		}

		// Load modinfo.json
		data, err := os.ReadFile(modinfoPath)
		if err != nil {
			fmt.Printf("Warning: Failed to read %s: %v\n", modinfoPath, err)
			continue
		}

		var modInfo ModInfo
		if err := json.Unmarshal(data, &modInfo); err != nil {
			fmt.Printf("Warning: Failed to parse %s: %v\n", modinfoPath, err)
			continue
		}

		// Add directory path
		modInfo.Directory = modDir

		// Store by identifier
		if modInfo.Identifier != "" {
			mods[modInfo.Identifier] = &modInfo
		} else {
			fmt.Printf("Warning: Mod at %s has no identifier\n", modDir)
		}
	}

	return mods, nil
}

// LoadModInfo loads modinfo.json from a specific mod directory
func LoadModInfo(modDir string) (*ModInfo, error) {
	modinfoPath := filepath.Join(modDir, "modinfo.json")

	data, err := os.ReadFile(modinfoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read modinfo.json: %w", err)
	}

	var modInfo ModInfo
	if err := json.Unmarshal(data, &modInfo); err != nil {
		return nil, fmt.Errorf("failed to parse modinfo.json: %w", err)
	}

	modInfo.Directory = modDir
	return &modInfo, nil
}

// FindAllMods searches for mods across all three locations (server_mods, client_mods, download)
// and returns a deduplicated map with priority: server_mods > client_mods > download
func FindAllMods(paRoot string) (map[string]*ModInfo, error) {
	allMods := make(map[string]*ModInfo)

	// Determine base path (PA Data Root is parent of parent of media folder)
	// e.g., C:/PA/media -> C:/Users/.../AppData/Local/Uber Entertainment/Planetary Annihilation
	paDataRoot := filepath.Join(paRoot, "..", "..")

	// Search priority locations
	searchPaths := []struct {
		path       string
		sourceType ModSourceType
	}{
		{filepath.Join(paDataRoot, "server_mods"), ModSourceServerMods},
		{filepath.Join(paDataRoot, "client_mods"), ModSourceClientMods},
		{filepath.Join(paDataRoot, "download"), ModSourceDownload},
	}

	// Search each location in priority order
	for _, search := range searchPaths {
		mods, err := discoverModsInLocation(search.path, search.sourceType)
		if err != nil {
			// Log warning but continue (location might not exist)
			fmt.Printf("Warning: Failed to search %s: %v\n", search.path, err)
			continue
		}

		// Add mods to map (earlier sources have priority, so don't overwrite)
		for identifier, modInfo := range mods {
			if _, exists := allMods[identifier]; !exists {
				allMods[identifier] = modInfo
			}
		}
	}

	return allMods, nil
}

// discoverModsInLocation scans a specific directory for mods (both extracted and zipped)
func discoverModsInLocation(locationPath string, sourceType ModSourceType) (map[string]*ModInfo, error) {
	mods := make(map[string]*ModInfo)

	// Check if location exists
	if _, err := os.Stat(locationPath); os.IsNotExist(err) {
		return mods, nil // Location doesn't exist, return empty map
	}

	// Read directory entries
	entries, err := os.ReadDir(locationPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	// Scan each entry
	for _, entry := range entries {
		var modInfo *ModInfo
		var err error

		if entry.IsDir() {
			// Extracted mod directory
			modInfo, err = loadModInfoFromDirectory(filepath.Join(locationPath, entry.Name()), sourceType)
		} else if strings.HasSuffix(entry.Name(), ".zip") {
			// Zipped mod (only in download folder typically)
			modInfo, err = loadModInfoFromZip(filepath.Join(locationPath, entry.Name()), sourceType)
		} else {
			continue // Skip non-mod files
		}

		if err != nil {
			fmt.Printf("Warning: Failed to load mod from %s: %v\n", entry.Name(), err)
			continue
		}

		if modInfo != nil && modInfo.Identifier != "" {
			mods[modInfo.Identifier] = modInfo
		}
	}

	return mods, nil
}

// loadModInfoFromDirectory loads modinfo.json from an extracted mod directory
func loadModInfoFromDirectory(modDir string, sourceType ModSourceType) (*ModInfo, error) {
	modinfoPath := filepath.Join(modDir, "modinfo.json")

	// Check if modinfo.json exists
	if _, err := os.Stat(modinfoPath); err != nil {
		return nil, nil // No modinfo.json, not a mod directory
	}

	data, err := os.ReadFile(modinfoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read modinfo.json: %w", err)
	}

	var modInfo ModInfo
	if err := json.Unmarshal(data, &modInfo); err != nil {
		return nil, fmt.Errorf("failed to parse modinfo.json: %w", err)
	}

	modInfo.Directory = modDir
	modInfo.SourceType = sourceType
	modInfo.IsZipped = false

	return &modInfo, nil
}

// loadModInfoFromZip loads modinfo.json from a zipped mod file
func loadModInfoFromZip(zipPath string, sourceType ModSourceType) (*ModInfo, error) {
	// Open zip file
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open zip: %w", err)
	}
	defer reader.Close()

	// Look for modinfo.json in the zip
	for _, file := range reader.File {
		if file.Name == "modinfo.json" || strings.HasSuffix(file.Name, "/modinfo.json") {
			// Found modinfo.json, read it
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open modinfo.json in zip: %w", err)
			}
			defer rc.Close()

			data, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("failed to read modinfo.json from zip: %w", err)
			}

			var modInfo ModInfo
			if err := json.Unmarshal(data, &modInfo); err != nil {
				return nil, fmt.Errorf("failed to parse modinfo.json: %w", err)
			}

			modInfo.ZipPath = zipPath
			modInfo.SourceType = sourceType
			modInfo.IsZipped = true

			return &modInfo, nil
		}
	}

	// No modinfo.json found in zip
	return nil, nil
}
