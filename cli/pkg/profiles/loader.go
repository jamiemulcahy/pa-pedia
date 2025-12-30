package profiles

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/profiles/embedded"
)

// factionUnitTypePattern validates faction unit type format.
// Should be alphanumeric (e.g., Custom1, Custom58, Tank, etc.)
var factionUnitTypePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]*$`)

// Loader handles profile discovery and loading from embedded and local sources.
type Loader struct {
	profiles map[string]*models.FactionProfile // Indexed by ID (lowercase)
}

// NewLoader creates a loader with embedded profiles loaded.
func NewLoader() (*Loader, error) {
	l := &Loader{
		profiles: make(map[string]*models.FactionProfile),
	}

	// Load embedded profiles
	entries, err := embedded.Profiles.ReadDir(".")
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded profiles: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		data, err := embedded.Profiles.ReadFile(entry.Name())
		if err != nil {
			return nil, fmt.Errorf("failed to read embedded profile %s: %w", entry.Name(), err)
		}

		profile, err := parseProfile(data, entry.Name())
		if err != nil {
			return nil, fmt.Errorf("failed to parse embedded profile %s: %w", entry.Name(), err)
		}

		l.profiles[profile.ID] = profile
	}

	return l, nil
}

// LoadLocalProfiles loads profiles from a directory.
// Local profiles override embedded profiles with the same ID.
func (l *Loader) LoadLocalProfiles(profileDir string) error {
	// Check if directory exists
	info, err := os.Stat(profileDir)
	if os.IsNotExist(err) {
		return nil // Directory doesn't exist, no local profiles to load
	}
	if err != nil {
		return fmt.Errorf("failed to stat profile directory: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("profile path is not a directory: %s", profileDir)
	}

	entries, err := os.ReadDir(profileDir)
	if err != nil {
		return fmt.Errorf("failed to read profile directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		path := filepath.Join(profileDir, entry.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read profile %s: %w", entry.Name(), err)
		}

		profile, err := parseProfile(data, entry.Name())
		if err != nil {
			return fmt.Errorf("failed to parse profile %s: %w", entry.Name(), err)
		}

		// Local profiles override embedded
		l.profiles[profile.ID] = profile
	}

	return nil
}

// GetProfile returns a profile by ID (case-insensitive).
func (l *Loader) GetProfile(id string) (*models.FactionProfile, error) {
	profile, ok := l.profiles[strings.ToLower(id)]
	if !ok {
		return nil, fmt.Errorf("profile not found: %s", id)
	}
	return profile, nil
}

// ListProfileIDs returns all available profile IDs sorted alphabetically.
func (l *Loader) ListProfileIDs() []string {
	ids := make([]string, 0, len(l.profiles))
	for id := range l.profiles {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

// GetAllProfiles returns all profiles sorted by ID.
func (l *Loader) GetAllProfiles() []*models.FactionProfile {
	profiles := make([]*models.FactionProfile, 0, len(l.profiles))
	for _, p := range l.profiles {
		profiles = append(profiles, p)
	}
	sort.Slice(profiles, func(i, j int) bool {
		return profiles[i].ID < profiles[j].ID
	})
	return profiles
}

// parseProfile parses JSON data into a FactionProfile.
func parseProfile(data []byte, filename string) (*models.FactionProfile, error) {
	var profile models.FactionProfile
	if err := json.Unmarshal(data, &profile); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	// Derive ID from filename
	profile.ID = strings.ToLower(strings.TrimSuffix(filename, ".json"))

	// Validate required fields
	if profile.DisplayName == "" {
		return nil, fmt.Errorf("displayName is required")
	}

	// Require factionUnitType unless this is an addon profile.
	// Addon profiles filter by exclusion (remove base game units) rather than by unit type.
	if profile.FactionUnitType == "" && !profile.IsAddon {
		return nil, fmt.Errorf("factionUnitType is required (or set isAddon: true for addon mods)")
	}

	// Validate factionUnitType format if provided (should be alphanumeric identifier like Custom1, Custom58)
	if profile.FactionUnitType != "" && !factionUnitTypePattern.MatchString(profile.FactionUnitType) {
		return nil, fmt.Errorf("factionUnitType must be alphanumeric identifier (e.g., Custom1, Custom58), got: %s", profile.FactionUnitType)
	}

	return &profile, nil
}
