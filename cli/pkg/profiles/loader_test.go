package profiles

import (
	"testing"
)

// TestParseProfileValidation tests profile validation rules
func TestParseProfileValidation(t *testing.T) {
	tests := []struct {
		name        string
		json        string
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid with factionUnitType",
			json: `{
				"displayName": "Test Faction",
				"factionUnitType": "Custom58"
			}`,
			expectError: false,
		},
		{
			name: "valid addon profile without factionUnitType",
			json: `{
				"displayName": "Test Addon",
				"isAddon": true,
				"mods": ["com.example.addon"]
			}`,
			expectError: false,
		},
		{
			name: "valid addon profile with factionUnitType",
			json: `{
				"displayName": "Test Addon",
				"isAddon": true,
				"factionUnitType": "Custom58",
				"mods": ["com.example.addon"]
			}`,
			expectError: false,
		},
		{
			name: "missing displayName",
			json: `{
				"factionUnitType": "Custom58"
			}`,
			expectError: true,
			errorMsg:    "displayName is required",
		},
		{
			name: "missing factionUnitType for non-addon",
			json: `{
				"displayName": "Test Faction"
			}`,
			expectError: true,
			errorMsg:    "factionUnitType is required",
		},
		{
			name: "invalid factionUnitType format",
			json: `{
				"displayName": "Test Faction",
				"factionUnitType": "123-invalid"
			}`,
			expectError: true,
			errorMsg:    "factionUnitType must be alphanumeric",
		},
		{
			name: "valid alphanumeric factionUnitType",
			json: `{
				"displayName": "Test Faction",
				"factionUnitType": "Basic_Unit"
			}`,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			profile, err := parseProfile([]byte(tt.json), "test.json")

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error containing %q, got nil", tt.errorMsg)
					return
				}
				if tt.errorMsg != "" && !contains(err.Error(), tt.errorMsg) {
					t.Errorf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
					return
				}
				if profile == nil {
					t.Error("Expected profile, got nil")
					return
				}
				if profile.ID != "test" {
					t.Errorf("Expected ID 'test', got %q", profile.ID)
				}
			}
		})
	}
}

// TestParseProfileIDDerivation tests that profile ID is correctly derived from filename
func TestParseProfileIDDerivation(t *testing.T) {
	tests := []struct {
		filename   string
		expectedID string
	}{
		{"mla.json", "mla"},
		{"Legion.json", "legion"},
		{"second-wave.json", "second-wave"},
		{"MY_FACTION.json", "my_faction"},
	}

	validJSON := `{"displayName": "Test", "factionUnitType": "Custom1"}`

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			profile, err := parseProfile([]byte(validJSON), tt.filename)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if profile.ID != tt.expectedID {
				t.Errorf("Expected ID %q, got %q", tt.expectedID, profile.ID)
			}
		})
	}
}

// Helper function to check if string contains substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && searchString(s, substr)))
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
