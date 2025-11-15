package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/invopop/jsonschema"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

func main() {
	// Parse command-line flags
	outputDir := flag.String("output", "./schema", "Output directory for schema files")
	verbose := flag.Bool("verbose", false, "Enable verbose logging")
	flag.Parse()

	if *verbose {
		fmt.Printf("Generating JSON schemas\n")
		fmt.Printf("Output directory: %s\n\n", *outputDir)
	}

	// Create schema directory if it doesn't exist
	if err := os.MkdirAll(*outputDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to create schema directory: %v\n", err)
		os.Exit(1)
	}

	// Generate schemas for each type
	schemas := []struct {
		name string
		typ  interface{}
	}{
		{"faction-metadata", &models.FactionMetadata{}},
		{"faction-database", &models.FactionDatabase{}},
		{"faction-index", &models.FactionIndex{}},
		{"unit", &models.Unit{}},
		{"weapon", &models.Weapon{}},
		{"build-arm", &models.BuildArm{}},
	}

	for _, s := range schemas {
		if err := generateSchema(*outputDir, s.name, s.typ, *verbose); err != nil {
			fmt.Fprintf(os.Stderr, "Error: failed to generate schema for %s: %v\n", s.name, err)
			os.Exit(1)
		}
		fmt.Printf("✓ Generated: %s.schema.json\n", s.name)
	}

	fmt.Println("\nSchema generation complete!")
}

func generateSchema(outputDir, name string, typ interface{}, verbose bool) error {
	if verbose {
		fmt.Printf("Generating schema for: %s\n", name)
	}

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
