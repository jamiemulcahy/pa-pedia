package cmd

import (
	"fmt"
	"os"

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
	SilenceUsage:  true,
	SilenceErrors: true,
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
