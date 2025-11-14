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

// FindAllMods searches for mods across all three locations (server_mods, client_mods, download)
// and returns a deduplicated map with priority: server_mods > client_mods > download
//
// IMPORTANT: This function assumes paRoot points to the PA installation's media directory.
// The directory structure is expected to be:
//   {PA_DATA_ROOT}/Planetary Annihilation/
//     ├── media/                          (this is paRoot)
//     ├── server_mods/{mod-identifier}/   (user-installed server mods, highest priority)
//     ├── client_mods/{mod-identifier}/   (user-installed client mods, medium priority)
//     └── download/{mod-identifier}.zip   (PA-managed mod downloads, lowest priority)
//
// We calculate PA_DATA_ROOT as paRoot/../.. to find the mod directories.
func FindAllMods(paRoot string, verbose bool) (map[string]*ModInfo, error) {
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
		mods, err := discoverModsInLocation(search.path, search.sourceType, verbose)
		if err != nil {
			// Log warning to stderr but continue (location might not exist)
			if verbose {
				fmt.Fprintf(os.Stderr, "Warning: Failed to search %s: %v\n", search.path, err)
			}
			continue
		}

		// Add mods to map with first-wins priority
		// (Earlier sources have higher priority, so don't overwrite existing entries)
		for identifier, modInfo := range mods {
			if _, exists := allMods[identifier]; !exists {
				allMods[identifier] = modInfo
			} // else: mod already found in higher-priority location, skip this duplicate
		}
	}

	return allMods, nil
}

// discoverModsInLocation scans a specific directory for mods (both extracted and zipped)
func discoverModsInLocation(locationPath string, sourceType ModSourceType, verbose bool) (map[string]*ModInfo, error) {
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
			// Log warning to stderr only if verbose
			if verbose {
				fmt.Fprintf(os.Stderr, "Warning: Failed to load mod from %s: %v\n", entry.Name(), err)
			}
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
