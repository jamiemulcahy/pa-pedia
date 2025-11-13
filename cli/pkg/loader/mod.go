package loader

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// ModInfo represents metadata about a PA server mod
type ModInfo struct {
	Identifier  string `json:"identifier"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	Version     string `json:"version"`
	Author      string `json:"author"`
	Date        string `json:"date"`
	Build       string `json:"build"`
	Directory   string `json:"-"` // Not in JSON, added by loader
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
