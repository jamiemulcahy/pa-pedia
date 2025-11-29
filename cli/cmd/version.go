package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// These variables are set via ldflags at build time by GoReleaser
// Version is exported for use by the updater package
var (
	Version = "dev"
	Commit  = "none"
	Date    = "unknown"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version of PA-Pedia",
	Long: `Print the version of PA-Pedia.

Use the --verbose (-v) flag to see additional build information:
  pa-pedia version -v
  pa-pedia v1.0.0
    commit: abc1234
    built:  2025-01-15T10:30:00Z`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("pa-pedia %s\n", Version)
		// verbose is a persistent flag defined on rootCmd and inherited by all subcommands
		if verbose {
			fmt.Printf("  commit: %s\n", Commit)
			fmt.Printf("  built:  %s\n", Date)
		}
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
