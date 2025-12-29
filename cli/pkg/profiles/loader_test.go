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
			name: "valid with factionUnitType (deprecated)",
			json: `{
				"displayName": "Test Faction",
				"factionUnitType": "Custom58"
			}`,
			expectError: false,
		},
		{
			name: "valid with factionUnitTypes array",
			json: `{
				"displayName": "Test Faction",
				"factionUnitTypes": ["Custom58", "Custom1"]
			}`,
			expectError: false,
		},
		{
			name: "valid with single factionUnitTypes",
			json: `{
				"displayName": "Test Faction",
				"factionUnitTypes": ["Custom58"]
			}`,
			expectError: false,
		},
		{
			name: "valid with both fields",
			json: `{
				"displayName": "Test Faction",
				"factionUnitType": "Custom58",
				"factionUnitTypes": ["Custom1", "Custom2"]
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
			name: "missing both faction unit type fields",
			json: `{
				"displayName": "Test Faction"
			}`,
			expectError: true,
			errorMsg:    "factionUnitType or factionUnitTypes is required",
		},
		{
			name: "empty factionUnitTypes array",
			json: `{
				"displayName": "Test Faction",
				"factionUnitTypes": []
			}`,
			expectError: true,
			errorMsg:    "factionUnitType or factionUnitTypes is required",
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
			name: "invalid factionUnitTypes entry",
			json: `{
				"displayName": "Test Faction",
				"factionUnitTypes": ["Custom58", "invalid-type"]
			}`,
			expectError: true,
			errorMsg:    "factionUnitTypes entries must be alphanumeric",
		},
		{
			name: "valid alphanumeric types",
			json: `{
				"displayName": "Test Faction",
				"factionUnitTypes": ["Custom58", "Custom1", "Tank", "Basic_Unit"]
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
