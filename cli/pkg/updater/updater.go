// Package updater provides self-update functionality for the PA-Pedia CLI.
package updater

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/creativeprojects/go-selfupdate"
)

const (
	// GitHubSlug is the GitHub repository in "owner/repo" format
	GitHubSlug = "jamiemulcahy/pa-pedia"

	// CheckTimeout is the timeout for version checks
	CheckTimeout = 30 * time.Second
	// DownloadTimeout is the timeout for downloading updates
	DownloadTimeout = 5 * time.Minute
	// DefaultStartupCheckTimeout is the default timeout for startup checks.
	// Can be overridden via PA_PEDIA_UPDATE_TIMEOUT environment variable.
	DefaultStartupCheckTimeout = 10 * time.Second
)

// UpdateInfo contains information about available updates
type UpdateInfo struct {
	CurrentVersion  string
	LatestVersion   string
	UpdateAvailable bool
	ReleaseURL      string
	ReleaseNotes    string
	AssetByteSize   int
}

// CheckForUpdate queries GitHub for the latest release and compares it to the current version
func CheckForUpdate(currentVersion string, timeout time.Duration) (*UpdateInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	source, err := selfupdate.NewGitHubSource(selfupdate.GitHubConfig{})
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub source: %w", err)
	}

	updater, err := selfupdate.NewUpdater(selfupdate.Config{
		Source: source,
		Validator: &selfupdate.ChecksumValidator{
			UniqueFilename: "checksums.txt",
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create updater: %w", err)
	}

	latest, found, err := updater.DetectLatest(ctx, selfupdate.ParseSlug(GitHubSlug))
	if err != nil {
		return nil, fmt.Errorf("failed to detect latest version: %w", err)
	}
	if !found {
		return nil, fmt.Errorf("no releases found")
	}

	info := &UpdateInfo{
		CurrentVersion:  currentVersion,
		LatestVersion:   latest.Version(),
		UpdateAvailable: latest.GreaterThan(currentVersion),
		ReleaseURL:      latest.URL,
		ReleaseNotes:    latest.ReleaseNotes,
		AssetByteSize:   latest.AssetByteSize,
	}

	return info, nil
}

// PerformUpdate downloads and installs the latest version
func PerformUpdate(currentVersion string) (*UpdateInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), DownloadTimeout)
	defer cancel()

	source, err := selfupdate.NewGitHubSource(selfupdate.GitHubConfig{})
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub source: %w", err)
	}

	updater, err := selfupdate.NewUpdater(selfupdate.Config{
		Source: source,
		Validator: &selfupdate.ChecksumValidator{
			UniqueFilename: "checksums.txt",
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create updater: %w", err)
	}

	latest, found, err := updater.DetectLatest(ctx, selfupdate.ParseSlug(GitHubSlug))
	if err != nil {
		return nil, fmt.Errorf("failed to detect latest version: %w", err)
	}
	if !found {
		return nil, fmt.Errorf("no releases found")
	}

	if !latest.GreaterThan(currentVersion) {
		return &UpdateInfo{
			CurrentVersion:  currentVersion,
			LatestVersion:   latest.Version(),
			UpdateAvailable: false,
		}, nil
	}

	exe, err := selfupdate.ExecutablePath()
	if err != nil {
		return nil, fmt.Errorf("failed to get executable path: %w", err)
	}

	if err := updater.UpdateTo(ctx, latest, exe); err != nil {
		return nil, fmt.Errorf("failed to update: %w", err)
	}

	return &UpdateInfo{
		CurrentVersion:  currentVersion,
		LatestVersion:   latest.Version(),
		UpdateAvailable: true,
		ReleaseURL:      latest.URL,
		ReleaseNotes:    latest.ReleaseNotes,
		AssetByteSize:   latest.AssetByteSize,
	}, nil
}

// IsDevelopmentVersion returns true if the version indicates a development build
func IsDevelopmentVersion(version string) bool {
	return version == "dev" || version == ""
}

// GetStartupCheckTimeout returns the timeout for startup update checks.
// It can be overridden via the PA_PEDIA_UPDATE_TIMEOUT environment variable (in seconds).
func GetStartupCheckTimeout() time.Duration {
	if envTimeout := os.Getenv("PA_PEDIA_UPDATE_TIMEOUT"); envTimeout != "" {
		if seconds, err := strconv.Atoi(envTimeout); err == nil && seconds > 0 {
			return time.Duration(seconds) * time.Second
		}
	}
	return DefaultStartupCheckTimeout
}
