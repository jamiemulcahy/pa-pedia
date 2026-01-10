package loader

import (
	"testing"
)

func TestIsGitHubURL(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		// Valid URLs
		{"simple github.com", "github.com/owner/repo", true},
		{"https github.com", "https://github.com/owner/repo", true},
		{"http github.com", "http://github.com/owner/repo", true},
		{"with trailing slash", "github.com/owner/repo/", true},
		{"https with trailing slash", "https://github.com/owner/repo/", true},
		{"with .git suffix", "github.com/owner/repo.git", true},
		{"https with .git suffix", "https://github.com/owner/repo.git", true},
		{"with branch", "github.com/owner/repo/tree/main", true},
		{"https with branch", "https://github.com/owner/repo/tree/main", true},
		{"with version tag", "github.com/owner/repo/tree/v1.2.3", true},
		{"with feature branch", "github.com/owner/repo/tree/feature-branch", true},
		{"with trailing slash on branch", "github.com/owner/repo/tree/main/", true},
		{"with subfolder path", "github.com/owner/repo/tree/main/src/server", true},
		{"https with subfolder path", "https://github.com/owner/repo/tree/develop/src/client", true},
		{"with deep path", "github.com/owner/repo/tree/main/path/to/nested/folder", true},
		{"with trailing slash on path", "github.com/owner/repo/tree/main/src/server/", true},

		// Invalid URLs
		{"empty string", "", false},
		{"not github", "gitlab.com/owner/repo", false},
		{"just owner", "github.com/owner", false},
		{"local mod id", "com.pa.legion-expansion-server", false},
		{"random string", "some-random-string", false},
		{"partial url", "github.com/", false},
		{"blob instead of tree", "github.com/owner/repo/blob/main/file.txt", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsGitHubURL(tt.input)
			if result != tt.expected {
				t.Errorf("IsGitHubURL(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestParseGitHubURL(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		expectedOwner string
		expectedRepo  string
		expectedRef   string
		expectedPath  string
		shouldError   bool
	}{
		// Valid URLs
		{
			name:          "simple github.com",
			input:         "github.com/owner/repo",
			expectedOwner: "owner",
			expectedRepo:  "repo",
			expectedRef:   "main",
		},
		{
			name:          "https github.com",
			input:         "https://github.com/owner/repo",
			expectedOwner: "owner",
			expectedRepo:  "repo",
			expectedRef:   "main",
		},
		{
			name:          "with branch",
			input:         "github.com/owner/repo/tree/develop",
			expectedOwner: "owner",
			expectedRepo:  "repo",
			expectedRef:   "develop",
		},
		{
			name:          "https with branch",
			input:         "https://github.com/owner/repo/tree/develop",
			expectedOwner: "owner",
			expectedRepo:  "repo",
			expectedRef:   "develop",
		},
		{
			name:          "with version tag",
			input:         "github.com/owner/repo/tree/v1.2.3",
			expectedOwner: "owner",
			expectedRepo:  "repo",
			expectedRef:   "v1.2.3",
		},
		{
			name:          "with .git suffix",
			input:         "github.com/owner/repo.git",
			expectedOwner: "owner",
			expectedRepo:  "repo",
			expectedRef:   "main",
		},
		{
			name:          "with trailing slash",
			input:         "github.com/owner/repo/",
			expectedOwner: "owner",
			expectedRepo:  "repo",
			expectedRef:   "main",
		},
		{
			name:          "real repo example",
			input:         "github.com/NiklasKroworsch/Exiles",
			expectedOwner: "NiklasKroworsch",
			expectedRepo:  "Exiles",
			expectedRef:   "main",
		},
		{
			name:          "with hyphenated names",
			input:         "github.com/some-org/my-cool-mod",
			expectedOwner: "some-org",
			expectedRepo:  "my-cool-mod",
			expectedRef:   "main",
		},
		{
			name:          "with subfolder path",
			input:         "github.com/Legion-Expansion/Legion-Expansion/tree/develop/src/server",
			expectedOwner: "Legion-Expansion",
			expectedRepo:  "Legion-Expansion",
			expectedRef:   "develop",
			expectedPath:  "src/server",
		},
		{
			name:          "https with subfolder path",
			input:         "https://github.com/Legion-Expansion/Legion-Expansion/tree/develop/src/client",
			expectedOwner: "Legion-Expansion",
			expectedRepo:  "Legion-Expansion",
			expectedRef:   "develop",
			expectedPath:  "src/client",
		},
		{
			name:          "with deep nested path",
			input:         "github.com/owner/repo/tree/main/path/to/deeply/nested/folder",
			expectedOwner: "owner",
			expectedRepo:  "repo",
			expectedRef:   "main",
			expectedPath:  "path/to/deeply/nested/folder",
		},
		{
			name:          "path with trailing slash",
			input:         "github.com/owner/repo/tree/main/src/server/",
			expectedOwner: "owner",
			expectedRepo:  "repo",
			expectedRef:   "main",
			expectedPath:  "src/server",
		},

		// Invalid URLs
		{
			name:        "empty string",
			input:       "",
			shouldError: true,
		},
		{
			name:        "not github",
			input:       "gitlab.com/owner/repo",
			shouldError: true,
		},
		{
			name:        "local mod id",
			input:       "com.pa.legion-expansion-server",
			shouldError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseGitHubURL(tt.input)

			if tt.shouldError {
				if err == nil {
					t.Errorf("ParseGitHubURL(%q) expected error, got nil", tt.input)
				}
				return
			}

			if err != nil {
				t.Errorf("ParseGitHubURL(%q) unexpected error: %v", tt.input, err)
				return
			}

			if result.Owner != tt.expectedOwner {
				t.Errorf("ParseGitHubURL(%q).Owner = %q, want %q", tt.input, result.Owner, tt.expectedOwner)
			}
			if result.Repo != tt.expectedRepo {
				t.Errorf("ParseGitHubURL(%q).Repo = %q, want %q", tt.input, result.Repo, tt.expectedRepo)
			}
			if result.Ref != tt.expectedRef {
				t.Errorf("ParseGitHubURL(%q).Ref = %q, want %q", tt.input, result.Ref, tt.expectedRef)
			}
			if result.Path != tt.expectedPath {
				t.Errorf("ParseGitHubURL(%q).Path = %q, want %q", tt.input, result.Path, tt.expectedPath)
			}
		})
	}
}

func TestGetGitHubArchiveURL(t *testing.T) {
	tests := []struct {
		name     string
		source   *GitHubSource
		expected string
	}{
		{
			name: "simple repo with main",
			source: &GitHubSource{
				Owner: "owner",
				Repo:  "repo",
				Ref:   "main",
			},
			expected: "https://github.com/owner/repo/archive/main.zip",
		},
		{
			name: "with version tag",
			source: &GitHubSource{
				Owner: "owner",
				Repo:  "repo",
				Ref:   "v1.2.3",
			},
			expected: "https://github.com/owner/repo/archive/v1.2.3.zip",
		},
		{
			name: "real repo example",
			source: &GitHubSource{
				Owner: "NiklasKroworsch",
				Repo:  "Exiles",
				Ref:   "main",
			},
			expected: "https://github.com/NiklasKroworsch/Exiles/archive/main.zip",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetGitHubArchiveURL(tt.source)
			if result != tt.expected {
				t.Errorf("GetGitHubArchiveURL() = %q, want %q", result, tt.expected)
			}
		})
	}
}

