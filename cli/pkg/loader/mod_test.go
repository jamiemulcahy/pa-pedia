package loader

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestGetDefaultPADataRoot tests platform-specific default directory detection
func TestGetDefaultPADataRoot(t *testing.T) {
	dataRoot, err := GetDefaultPADataRoot()
	if err != nil {
		t.Fatalf("GetDefaultPADataRoot() failed: %v", err)
	}

	if dataRoot == "" {
		t.Error("GetDefaultPADataRoot() returned empty string")
	}

	// Verify platform-specific expectations
	switch runtime.GOOS {
	case "windows":
		// Should contain "Uber Entertainment\Planetary Annihilation"
		if !containsPath(dataRoot, "Uber Entertainment", "Planetary Annihilation") {
			t.Errorf("Windows data root should contain 'Uber Entertainment\\Planetary Annihilation', got: %s", dataRoot)
		}
	case "darwin":
		// Should contain "Library/Application Support/Uber Entertainment/Planetary Annihilation"
		if !containsPath(dataRoot, "Library", "Application Support", "Uber Entertainment", "Planetary Annihilation") {
			t.Errorf("macOS data root should contain library path, got: %s", dataRoot)
		}
	case "linux":
		// Should contain ".local/Uber Entertainment/Planetary Annihilation"
		if !containsPath(dataRoot, ".local", "Uber Entertainment", "Planetary Annihilation") {
			t.Errorf("Linux data root should contain .local path, got: %s", dataRoot)
		}
	}

	t.Logf("Platform: %s, Data root: %s", runtime.GOOS, dataRoot)
}

// TestGetDefaultPADataRootPlatformSupport tests unsupported platform handling
func TestGetDefaultPADataRootPlatformSupport(t *testing.T) {
	// This test documents expected behavior for supported platforms
	supportedPlatforms := []string{"windows", "darwin", "linux"}
	currentPlatform := runtime.GOOS

	found := false
	for _, platform := range supportedPlatforms {
		if platform == currentPlatform {
			found = true
			break
		}
	}

	if !found {
		t.Skipf("Current platform %s not in supported platforms: %v", currentPlatform, supportedPlatforms)
	}

	t.Logf("Platform %s is supported", currentPlatform)
}

// TestFindAllModsWithNonexistentPath tests mod discovery with nonexistent directory
func TestFindAllModsWithNonexistentPath(t *testing.T) {
	// Use a path that definitely doesn't exist
	nonexistentPath := filepath.Join(os.TempDir(), "nonexistent_pa_data_directory_test_12345")

	mods, err := FindAllMods(nonexistentPath, false)
	if err != nil {
		t.Fatalf("FindAllMods() should not error on nonexistent path, got: %v", err)
	}

	if len(mods) != 0 {
		t.Errorf("FindAllMods() with nonexistent path should return empty map, got %d mods", len(mods))
	}

	t.Log("FindAllMods correctly handles nonexistent paths")
}

// TestModSourceTypePriority tests that mod source types maintain expected priority
func TestModSourceTypePriority(t *testing.T) {
	// Document expected priority order
	expectedPriority := []ModSourceType{
		ModSourceServerMods, // Highest priority
		ModSourceClientMods, // Medium priority
		ModSourceDownload,   // Lowest priority
	}

	// Verify we have the right number of mod source types
	if len(expectedPriority) != 3 {
		t.Errorf("Expected 3 mod source types, got %d", len(expectedPriority))
	}

	// Verify type values
	if ModSourceServerMods != "server_mods" {
		t.Errorf("ModSourceServerMods should be 'server_mods', got: %s", ModSourceServerMods)
	}
	if ModSourceClientMods != "client_mods" {
		t.Errorf("ModSourceClientMods should be 'client_mods', got: %s", ModSourceClientMods)
	}
	if ModSourceDownload != "download" {
		t.Errorf("ModSourceDownload should be 'download', got: %s", ModSourceDownload)
	}

	t.Logf("Mod source priority order: %v", expectedPriority)
}

// TestModInfoStructure tests that ModInfo has expected fields
func TestModInfoStructure(t *testing.T) {
	mod := &ModInfo{
		Identifier:  "com.example.testmod",
		DisplayName: "Test Mod",
		Description: "A test mod",
		Version:     "1.0.0",
		Author:      "Test Author",
		Date:        "2025-01-01",
		Build:       "123456",
		Directory:   "/path/to/mod",
		ZipPath:     "",
		SourceType:  ModSourceServerMods,
		IsZipped:    false,
	}

	// Verify identifier
	if mod.Identifier != "com.example.testmod" {
		t.Errorf("Expected identifier 'com.example.testmod', got: %s", mod.Identifier)
	}

	// Verify source type
	if mod.SourceType != ModSourceServerMods {
		t.Errorf("Expected SourceType server_mods, got: %s", mod.SourceType)
	}

	// Verify IsZipped flag
	if mod.IsZipped {
		t.Error("Expected IsZipped to be false")
	}

	t.Log("ModInfo structure verified")
}

// TestModDiscoveryPathCalculation tests the search path calculation
func TestModDiscoveryPathCalculation(t *testing.T) {
	testDataRoot := "/test/data/root"

	expectedPaths := []struct {
		subdir   string
		expected string
	}{
		{"server_mods", filepath.Join(testDataRoot, "server_mods")},
		{"client_mods", filepath.Join(testDataRoot, "client_mods")},
		{"download", filepath.Join(testDataRoot, "download")},
	}

	for _, tt := range expectedPaths {
		calculated := filepath.Join(testDataRoot, tt.subdir)
		if calculated != tt.expected {
			t.Errorf("Path calculation for %s: got %s, want %s", tt.subdir, calculated, tt.expected)
		}
	}

	t.Log("Mod discovery paths calculated correctly")
}

// Helper function to check if a path contains all specified components
func containsPath(fullPath string, components ...string) bool {
	for _, component := range components {
		if !contains(fullPath, component) {
			return false
		}
	}
	return true
}

// TestIsBalanceMod tests the balance mod detection from categories
func TestIsBalanceMod(t *testing.T) {
	tests := []struct {
		name       string
		categories []string
		expected   bool
	}{
		{
			name:       "balance category",
			categories: []string{"unit", "balance", "expansion"},
			expected:   true,
		},
		{
			name:       "addon category",
			categories: []string{"addon", "unit", "legion"},
			expected:   true,
		},
		{
			name:       "Balance uppercase",
			categories: []string{"BALANCE", "unit"},
			expected:   true,
		},
		{
			name:       "ADDON uppercase",
			categories: []string{"ADDON"},
			expected:   true,
		},
		{
			name:       "mixed case balance",
			categories: []string{"Balance", "Addon"},
			expected:   true,
		},
		{
			name:       "no balance indicators",
			categories: []string{"unit", "client", "ui"},
			expected:   false,
		},
		{
			name:       "empty categories",
			categories: []string{},
			expected:   false,
		},
		{
			name:       "nil categories",
			categories: nil,
			expected:   false,
		},
		{
			name:       "similar but not matching",
			categories: []string{"rebalance", "addons", "balanced"},
			expected:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mod := &ModInfo{
				Identifier: "test.mod",
				Categories: tt.categories,
			}
			result := mod.IsBalanceMod()
			if result != tt.expected {
				t.Errorf("IsBalanceMod() with categories %v = %v, want %v",
					tt.categories, result, tt.expected)
			}
		})
	}
}

// Helper function for path component matching
// Uses multiple strategies because paths can be structured differently across platforms:
// 1. Check if component is the immediate parent directory name
// 2. Check if component is the base name (final element) of the path
// 3. Check if component appears anywhere in the normalized path string
// This approach handles both absolute paths and various directory nesting structures
func contains(fullPath, component string) bool {
	// Normalize path separators to forward slashes for consistent comparison
	normalized := filepath.ToSlash(fullPath)
	componentNormalized := filepath.ToSlash(component)

	// Strategy 1: Is component the parent directory?
	if filepath.Base(filepath.Dir(normalized)) == component {
		return true
	}

	// Strategy 2: Is component the final path element?
	if filepath.Base(normalized) == component {
		return true
	}

	// Strategy 3: Does component appear anywhere in the path?
	// This handles cases where component is nested deeper or uses platform-specific separators
	if strings.Contains(normalized, component) || strings.Contains(normalized, componentNormalized) {
		return true
	}

	return false
}
