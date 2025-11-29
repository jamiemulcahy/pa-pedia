package updater

import (
	"os"
	"testing"
	"time"
)

func TestIsDevelopmentVersion(t *testing.T) {
	tests := []struct {
		version string
		want    bool
	}{
		{"dev", true},
		{"", true},
		{"v1.0.0", false},
		{"1.0.0", false},
		{"0.1.0", false},
		{"v0.0.1-alpha", false},
	}
	for _, tt := range tests {
		t.Run(tt.version, func(t *testing.T) {
			if got := IsDevelopmentVersion(tt.version); got != tt.want {
				t.Errorf("IsDevelopmentVersion(%q) = %v, want %v", tt.version, got, tt.want)
			}
		})
	}
}

func TestGetStartupCheckTimeout(t *testing.T) {
	// Save original env and restore after test
	origTimeout := os.Getenv("PA_PEDIA_UPDATE_TIMEOUT")
	defer os.Setenv("PA_PEDIA_UPDATE_TIMEOUT", origTimeout)

	tests := []struct {
		name     string
		envValue string
		want     time.Duration
	}{
		{"default when unset", "", DefaultStartupCheckTimeout},
		{"valid 5 seconds", "5", 5 * time.Second},
		{"valid 30 seconds", "30", 30 * time.Second},
		{"invalid negative", "-1", DefaultStartupCheckTimeout},
		{"invalid zero", "0", DefaultStartupCheckTimeout},
		{"invalid non-numeric", "abc", DefaultStartupCheckTimeout},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue == "" {
				os.Unsetenv("PA_PEDIA_UPDATE_TIMEOUT")
			} else {
				os.Setenv("PA_PEDIA_UPDATE_TIMEOUT", tt.envValue)
			}
			if got := GetStartupCheckTimeout(); got != tt.want {
				t.Errorf("GetStartupCheckTimeout() = %v, want %v", got, tt.want)
			}
		})
	}
}
