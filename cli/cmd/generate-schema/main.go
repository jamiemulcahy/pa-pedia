package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/invopop/jsonschema"
	"github.com/planetaryannihilation/pa-pedia/pkg/models"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	// Determine schema output directory (relative to CLI root)
	schemaDir := filepath.Join("..", "..", "schema")

	// Create schema directory if it doesn't exist
	if err := os.MkdirAll(schemaDir, 0755); err != nil {
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
		if err := generateSchema(schemaDir, s.name, s.typ); err != nil {
			return fmt.Errorf("failed to generate schema for %s: %w", s.name, err)
		}
		fmt.Printf("Generated schema: %s.schema.json\n", s.name)
	}

	fmt.Println("\nSchema generation complete!")
	return nil
}

func generateSchema(outputDir, name string, typ interface{}) error {
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
