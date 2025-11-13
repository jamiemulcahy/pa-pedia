package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/invopop/jsonschema"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/spf13/cobra"
)

var (
	schemaOutputDir string
)

// generateSchemaCmd represents the generate-schema command
var generateSchemaCmd = &cobra.Command{
	Use:   "generate-schema",
	Short: "Generate JSON Schema files from Go models",
	Long: `Generate JSON Schema files from Go data structures.

These schemas are used to:
- Validate faction folder data
- Generate TypeScript types for the web application
- Document the data format`,
	Example: `  pa-pedia generate-schema
  pa-pedia generate-schema --output ./custom-schema-dir`,
	RunE: runGenerateSchema,
}

func init() {
	rootCmd.AddCommand(generateSchemaCmd)
	generateSchemaCmd.Flags().StringVarP(&schemaOutputDir, "output", "o", "./schema", "Output directory for schema files")
}

func runGenerateSchema(cmd *cobra.Command, args []string) error {
	logVerbose("Generating JSON schemas")
	logVerbose("Output directory: %s", schemaOutputDir)

	// Create schema directory if it doesn't exist
	if err := os.MkdirAll(schemaOutputDir, 0755); err != nil {
		return fmt.Errorf("failed to create schema directory: %w", err)
	}

	// Generate schemas for each type
	schemas := []struct {
		name string
		typ  interface{}
	}{
		{"faction-metadata", &models.FactionMetadata{}},
		{"faction-database", &models.FactionDatabase{}},
		{"unit", &models.Unit{}},
		{"weapon", &models.Weapon{}},
		{"build-arm", &models.BuildArm{}},
	}

	for _, s := range schemas {
		if err := generateSchema(schemaOutputDir, s.name, s.typ); err != nil {
			return fmt.Errorf("failed to generate schema for %s: %w", s.name, err)
		}
		fmt.Printf("✓ Generated: %s.schema.json\n", s.name)
	}

	fmt.Println("\nSchema generation complete!")
	return nil
}

func generateSchema(outputDir, name string, typ interface{}) error {
	logVerbose("Generating schema for: %s", name)

	// Create reflector with configuration
	reflector := &jsonschema.Reflector{
		AllowAdditionalProperties: false,
		DoNotReference:           false,
	}

	// Generate schema
	schema := reflector.Reflect(typ)

	// Add metadata
	schema.Title = name
	schema.Version = "https://json-schema.org/draft/2020-12/schema"

	// Marshal to JSON with indentation
	data, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal schema: %w", err)
	}

	// Write to file
	filename := filepath.Join(outputDir, name+".schema.json")
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write schema file: %w", err)
	}

	return nil
}
