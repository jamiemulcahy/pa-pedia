package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// These variables are set via ldflags at build time by GoReleaser
var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version of PA-Pedia",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("pa-pedia %s\n", version)
		if verbose {
			fmt.Printf("  commit: %s\n", commit)
			fmt.Printf("  built:  %s\n", date)
		}
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
