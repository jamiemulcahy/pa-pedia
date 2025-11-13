package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var (
	factionPath string
)

// validateCmd represents the validate command
var validateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate a faction folder structure",
	Long: `Validate that a faction folder has the correct structure and valid data.

This command checks:
- Required files exist (metadata.json, units.json)
- JSON files are valid and match schemas
- Referenced assets exist
- Unit data is consistent`,
	Example: `  pa-pedia validate --faction "./factions/base-game"
  pa-pedia validate --faction "./factions/legion"`,
	RunE: runValidate,
}

func init() {
	rootCmd.AddCommand(validateCmd)
	validateCmd.Flags().StringVar(&factionPath, "faction", "", "Path to faction folder to validate (required)")
	validateCmd.MarkFlagRequired("faction")
}

func runValidate(cmd *cobra.Command, args []string) error {
	logVerbose("Validating faction folder: %s", factionPath)

	// TODO: Implement validation
	return fmt.Errorf("validation not yet implemented")
}
