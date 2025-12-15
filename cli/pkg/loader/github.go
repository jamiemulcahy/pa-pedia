package loader

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

// GitHubSource represents a GitHub repository as a mod source
type GitHubSource struct {
	Owner string // Repository owner (user or org)
	Repo  string // Repository name
	Ref   string // Branch, tag, or commit SHA (default: "main")
	URL   string // Original URL for error messages
}

// gitHubURLPatterns matches various GitHub URL formats
var gitHubURLPatterns = []*regexp.Regexp{
	// https://github.com/owner/repo
	// https://github.com/owner/repo/
	regexp.MustCompile(`^https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$`),
	// https://github.com/owner/repo/tree/branch
	// https://github.com/owner/repo/tree/branch/
	regexp.MustCompile(`^https?://github\.com/([^/]+)/([^/]+)/tree/([^/]+)/?$`),
	// github.com/owner/repo
	// github.com/owner/repo/
	regexp.MustCompile(`^github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$`),
	// github.com/owner/repo/tree/branch
	// github.com/owner/repo/tree/branch/
	regexp.MustCompile(`^github\.com/([^/]+)/([^/]+)/tree/([^/]+)/?$`),
}

// IsGitHubURL checks if a string is a GitHub repository URL
func IsGitHubURL(s string) bool {
	s = strings.TrimSpace(s)
	for _, pattern := range gitHubURLPatterns {
		if pattern.MatchString(s) {
			return true
		}
	}
	return false
}

// ParseGitHubURL parses a GitHub URL into its components
func ParseGitHubURL(urlStr string) (*GitHubSource, error) {
	urlStr = strings.TrimSpace(urlStr)

	for _, pattern := range gitHubURLPatterns {
		matches := pattern.FindStringSubmatch(urlStr)
		if matches == nil {
			continue
		}

		src := &GitHubSource{
			Owner: matches[1],
			Repo:  matches[2],
			Ref:   "main", // Default branch
			URL:   urlStr,
		}

		// If pattern has 4 groups, the 4th is the branch/ref
		if len(matches) > 3 && matches[3] != "" {
			src.Ref = matches[3]
		}

		return src, nil
	}

	return nil, fmt.Errorf("invalid GitHub URL format: %s\nExpected formats:\n  github.com/owner/repo\n  github.com/owner/repo/tree/branch\n  https://github.com/owner/repo", urlStr)
}

// GetGitHubArchiveURL returns the zip archive download URL for a GitHub source
func GetGitHubArchiveURL(src *GitHubSource) string {
	// URL-encode the ref in case it contains special characters
	encodedRef := url.PathEscape(src.Ref)
	return fmt.Sprintf("https://github.com/%s/%s/archive/%s.zip", src.Owner, src.Repo, encodedRef)
}

// DownloadGitHubArchive downloads a GitHub repository archive to a temp file
func DownloadGitHubArchive(src *GitHubSource, verbose bool) (string, error) {
	// Download the archive
	archiveURL := GetGitHubArchiveURL(src)
	fmt.Printf("Downloading %s/%s@%s...\n", src.Owner, src.Repo, src.Ref)
	if verbose {
		fmt.Printf("URL: %s\n", archiveURL)
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 5 * time.Minute, // 5 minute timeout for large repos
	}

	resp, err := client.Get(archiveURL)
	if err != nil {
		return "", fmt.Errorf("failed to download from GitHub: %w", err)
	}
	defer resp.Body.Close()

	// Check HTTP status
	switch resp.StatusCode {
	case http.StatusOK:
		// Success
	case http.StatusNotFound:
		return "", fmt.Errorf("repository not found: %s\nEnsure the repository exists and is public", src.URL)
	case http.StatusForbidden:
		return "", fmt.Errorf("access denied: %s\nOnly public repositories are supported", src.URL)
	default:
		return "", fmt.Errorf("GitHub returned HTTP %d for %s", resp.StatusCode, src.URL)
	}

	// Create temp file for the download
	// Sanitize ref for use in filename (replace / with _ to handle branch names like feature/foo)
	safeRef := strings.ReplaceAll(src.Ref, "/", "_")
	filename := fmt.Sprintf("pa-pedia-%s_%s_%s-*.zip", src.Owner, src.Repo, safeRef)
	tmpFile, err := os.CreateTemp("", filename)
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer tmpFile.Close()

	// Copy response body to temp file
	written, err := io.Copy(tmpFile, resp.Body)
	if err != nil {
		os.Remove(tmpPath)
		return "", fmt.Errorf("failed to download archive: %w", err)
	}

	if verbose {
		fmt.Printf("Downloaded %d bytes to %s\n", written, tmpPath)
	}

	return tmpPath, nil
}

// LoadModInfoFromGitHubArchive extracts mod info from a GitHub archive zip file
func LoadModInfoFromGitHubArchive(src *GitHubSource, zipPath string) (*ModInfo, error) {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open GitHub archive: %w", err)
	}
	defer reader.Close()

	// GitHub archives have a root directory named "{repo}-{ref}/"
	// We need to look for modinfo.json inside this directory and strip this prefix when loading
	// Sanitize ref to prevent path traversal (defense-in-depth, GitHub likely sanitizes too)
	safeRef := strings.ReplaceAll(src.Ref, "..", "")
	safeRef = strings.ReplaceAll(safeRef, "\\", "")
	rootPrefix := fmt.Sprintf("%s-%s/", src.Repo, safeRef)

	// Look for modinfo.json
	var modinfoFile *zip.File
	for _, file := range reader.File {
		name := file.Name
		// Check for modinfo.json at root of repo content
		if name == rootPrefix+"modinfo.json" || name == "modinfo.json" {
			modinfoFile = file
			break
		}
	}

	if modinfoFile == nil {
		// No modinfo.json found - synthesize a minimal ModInfo
		fmt.Printf("Warning: No modinfo.json found in %s/%s. Using repository name as identifier.\n", src.Owner, src.Repo)
		return &ModInfo{
			Identifier:    fmt.Sprintf("github_%s_%s", src.Owner, src.Repo),
			DisplayName:   src.Repo,
			Description:   fmt.Sprintf("GitHub repository: %s/%s", src.Owner, src.Repo),
			ZipPath:       zipPath,
			ZipPathPrefix: rootPrefix,
			SourceType:    ModSourceGitHub,
			IsZipped:      true,
		}, nil
	}

	// Read modinfo.json
	rc, err := modinfoFile.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open modinfo.json in archive: %w", err)
	}
	defer rc.Close()

	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, fmt.Errorf("failed to read modinfo.json from archive: %w", err)
	}

	var modInfo ModInfo
	if err := json.Unmarshal(data, &modInfo); err != nil {
		return nil, fmt.Errorf("failed to parse modinfo.json: %w", err)
	}

	modInfo.ZipPath = zipPath
	modInfo.ZipPathPrefix = rootPrefix
	modInfo.SourceType = ModSourceGitHub
	modInfo.IsZipped = true

	return &modInfo, nil
}

// ResolveGitHubMod downloads and resolves a GitHub repository as a mod source
func ResolveGitHubMod(urlString string, verbose bool) (*ModInfo, error) {
	// Parse the URL
	src, err := ParseGitHubURL(urlString)
	if err != nil {
		return nil, err
	}

	// Download the archive
	zipPath, err := DownloadGitHubArchive(src, verbose)
	if err != nil {
		return nil, err
	}

	// Load mod info from the archive
	modInfo, err := LoadModInfoFromGitHubArchive(src, zipPath)
	if err != nil {
		return nil, err
	}

	return modInfo, nil
}
