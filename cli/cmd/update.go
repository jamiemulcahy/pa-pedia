package cmd

import (
	"fmt"

	"github.com/jamiemulcahy/pa-pedia/pkg/updater"
	"github.com/spf13/cobra"
)

var (
	updateCheck bool
)

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update pa-pedia to the latest version",
	Long: `Check for and install updates to pa-pedia.

By default, this command checks for updates and installs them automatically.
Use --check to only check for updates without installing.`,
	RunE: runUpdate,
}

func init() {
	rootCmd.AddCommand(updateCmd)
	updateCmd.Flags().BoolVar(&updateCheck, "check", false,
		"Check for updates without installing")
}

func runUpdate(cmd *cobra.Command, args []string) error {
	if updater.IsDevelopmentVersion(Version) {
		fmt.Println("Skipping update check in development mode")
		return nil
	}

	fmt.Println("Checking for updates...")

	info, err := updater.CheckForUpdate(Version, updater.CheckTimeout)
	if err != nil {
		return fmt.Errorf("failed to check for updates: %w", err)
	}

	fmt.Printf("Current version: %s\n", info.CurrentVersion)
	fmt.Printf("Latest version:  %s\n", info.LatestVersion)

	if !info.UpdateAvailable {
		fmt.Println("\nYou are running the latest version!")
		return nil
	}

	fmt.Println("\nA new version is available!")

	if updateCheck {
		fmt.Println("\nRun 'pa-pedia update' to install.")
		return nil
	}

	fmt.Printf("\nDownloading pa-pedia %s...\n", info.LatestVersion)

	result, err := updater.PerformUpdate(Version)
	if err != nil {
		return fmt.Errorf("update failed: %w", err)
	}

	fmt.Printf("\nSuccessfully updated to %s\n", result.LatestVersion)

	if result.ReleaseNotes != "" {
		fmt.Printf("\nRelease notes:\n%s\n", result.ReleaseNotes)
	}

	return nil
}
