package cmd

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/jamiemulcahy/pa-pedia/pkg/updater"
	"github.com/spf13/cobra"
)

var (
	verbose bool
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "pa-pedia",
	Short: "PA-Pedia - Planetary Annihilation Unit Database Tool",
	Long: `PA-Pedia is a CLI tool for extracting and organizing Planetary Annihilation
unit data into portable faction folders.

It supports extracting data from:
- Base game (PA Titans)
- Server mods (including zip files)

Generated faction folders can be used with the PA-Pedia web application
or shared with other users.`,
	SilenceUsage:      true,
	SilenceErrors:     true,
	PersistentPreRunE: checkForUpdates,
}

// Execute adds all child commands to the root command and sets flags appropriately.
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// Disable auto-generated completion command
	rootCmd.CompletionOptions.DisableDefaultCmd = true

	// Global flags
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose logging")
}

// Helper function for verbose logging
func logVerbose(format string, args ...interface{}) {
	if verbose {
		fmt.Fprintf(os.Stderr, "[VERBOSE] "+format+"\n", args...)
	}
}

// checkForUpdates runs before any command to check for and install updates
func checkForUpdates(cmd *cobra.Command, args []string) error {
	// Skip update check for version and update commands to avoid recursion
	cmdName := cmd.Name()
	if cmdName == "version" || cmdName == "update" {
		return nil
	}

	// Skip if disabled via environment variable
	if disableUpdateCheck {
		logVerbose("Update check disabled via PA_PEDIA_NO_UPDATE_CHECK")
		return nil
	}

	// Skip in development mode
	if updater.IsDevelopmentVersion(Version) {
		logVerbose("Skipping update check in development mode")
		return nil
	}

	logVerbose("Checking for updates...")

	// Use short timeout for startup check (configurable via PA_PEDIA_UPDATE_TIMEOUT)
	info, err := updater.CheckForUpdate(Version, updater.GetStartupCheckTimeout())
	if err != nil {
		// Silently ignore update check failures to not block user's command
		logVerbose("Update check failed: %v", err)
		return nil
	}

	if !info.UpdateAvailable {
		logVerbose("Already running latest version (%s)", info.CurrentVersion)
		return nil
	}

	fmt.Printf("New version available: %s (current: %s)\n", info.LatestVersion, info.CurrentVersion)
	fmt.Println("Updating...")

	result, err := updater.PerformUpdate(Version)
	if err != nil {
		// Log error but don't block the user's command
		fmt.Fprintf(os.Stderr, "Update failed: %v\n", err)
		fmt.Fprintln(os.Stderr, "Continuing with current version...")
		return nil
	}

	fmt.Printf("Successfully updated to %s\n\n", result.LatestVersion)

	// Re-exec the command with the new binary
	return reExecWithNewBinary()
}

// reExecWithNewBinary replaces the current process with the updated binary.
// The go-selfupdate library handles Windows binary replacement by renaming the
// running executable to .old and writing the new one in its place.
func reExecWithNewBinary() error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	cmd := exec.Command(exe, os.Args[1:]...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err = cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			// Command failed to start
			return fmt.Errorf("failed to re-exec: %w", err)
		}
	}
	os.Exit(exitCode)
	return nil // unreachable, but needed for compilation
}

// disableUpdateCheck can be set to true to disable the startup update check
// This is useful for testing or when running in CI environments
var disableUpdateCheck bool

func init() {
	// Check for environment variable to disable update check
	if os.Getenv("PA_PEDIA_NO_UPDATE_CHECK") == "1" {
		disableUpdateCheck = true
	}
}
