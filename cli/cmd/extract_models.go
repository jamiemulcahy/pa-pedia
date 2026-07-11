package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/jamiemulcahy/pa-pedia/pkg/exporter"
	"github.com/jamiemulcahy/pa-pedia/pkg/models3d"
	"github.com/jamiemulcahy/pa-pedia/pkg/profiles"
	"github.com/spf13/cobra"
)

var (
	// Faction selection (mirrors describe-faction)
	emProfileFlag    string
	emProfileDirFlag string
	emFactionName    string
	emFactionType    string
	emModIDs         []string

	emPaRoot     string
	emPaDataRoot string
	emOutputDir  string

	// Model-specific
	emBlenderPath string
	emTextureSize int
)

// extractModelsCmd generates web-renderable 3D models for a faction's units.
var extractModelsCmd = &cobra.Command{
	Use:   "extract-models",
	Short: "Generate 3D unit models (glb + textures) for a faction using headless Blender",
	Long: `Convert a faction's PA .papa unit models into browser-renderable assets
(geometry .glb + grayscale diffuse + team-colour mask PNGs) via headless Blender
and the vendored Blender-PAPA-IO addon.

For each unit the command resolves its model .papa and linked texture .papa files
across the base game + mod overlay (first-wins), stages them so the addon can
auto-load textures, runs Blender, and writes:

  <output>/<Faction>/models/<unitId>.glb
  <output>/<Faction>/textures/<unitId>_{diffuse,mask,material}.png
  <output>/<Faction>/models.json     (availability index consumed by the web app)

Units with no resolvable model or a failed conversion are skipped and logged;
the run never aborts on a single unit.

REQUIREMENTS:
  - A local PA Titans install (--pa-root), same as describe-faction.
  - Blender 5.1.x on PATH, or via --blender / the BLENDER environment variable.
    (5.1.x is the pinned, validated version; other versions may drift on shader
    node socket names.)`,
	Example: `  # MLA (base game) at default texture size (512)
  pa-pedia extract-models --profile mla --pa-root "C:/PA/media" --output ./models

  # Legion with an explicit Blender path and higher-res textures
  pa-pedia extract-models --profile legion --pa-root "C:/PA/media" \
    --blender "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" \
    --texture-size 1024 --output ./models`,
	RunE: runExtractModels,
}

func init() {
	rootCmd.AddCommand(extractModelsCmd)

	extractModelsCmd.Flags().StringVar(&emProfileFlag, "profile", "", "Profile ID to use (recommended approach)")
	extractModelsCmd.Flags().StringVar(&emProfileDirFlag, "profile-dir", "./profiles", "Directory for custom faction profiles")
	extractModelsCmd.Flags().StringVar(&emFactionName, "name", "", "Faction display name (fallback/manual mode)")
	extractModelsCmd.Flags().StringVar(&emFactionType, "faction-unit-type", "", "Faction unit type identifier (e.g., Custom58 for MLA)")
	extractModelsCmd.Flags().StringArrayVar(&emModIDs, "mod", []string{}, "Mod source(s) - local mod ID or GitHub URL (repeatable, first has priority)")

	extractModelsCmd.Flags().StringVar(&emPaRoot, "pa-root", "", "Path to PA Titans media directory")
	extractModelsCmd.Flags().StringVar(&emPaDataRoot, "data-root", "", "Path to PA data directory (required when local mods are involved)")
	extractModelsCmd.Flags().StringVar(&emOutputDir, "output", "./models", "Output directory for faction model bundles")

	extractModelsCmd.Flags().StringVar(&emBlenderPath, "blender", "", "Path to the Blender executable (default: $BLENDER, then 'blender' on PATH)")
	extractModelsCmd.Flags().IntVar(&emTextureSize, "texture-size", 512, "Maximum texture edge size in pixels")
}

func runExtractModels(cmd *cobra.Command, args []string) error {
	// Initialize profile loader
	profileLoader, err := profiles.NewLoader()
	if err != nil {
		return fmt.Errorf("failed to initialize profile loader: %w", err)
	}
	if err := profileLoader.LoadLocalProfiles(emProfileDirFlag); err != nil {
		return fmt.Errorf("failed to load local profiles: %w", err)
	}

	profile, err := resolveProfileFromFlags(profileLoader, emProfileFlag, emFactionName, emFactionType, emModIDs)
	if err != nil {
		return err
	}

	if err := validateFactionInputs(profile, emPaRoot, emPaDataRoot); err != nil {
		return err
	}

	// Resolve the Blender executable early so we fail fast with clear guidance.
	blenderPath, err := resolveBlenderPath(emBlenderPath)
	if err != nil {
		return err
	}

	fmt.Println("=== PA-Pedia 3D Model Extraction ===")
	fmt.Println()
	fmt.Printf("Faction: %s\n", profile.DisplayName)
	fmt.Printf("Blender: %s\n", blenderPath)
	fmt.Printf("Texture size: %d\n", emTextureSize)
	fmt.Println()

	// Resolve mods, build the overlay loader, and load units (shared with describe-faction).
	// Use allow-empty semantics: a faction with no units simply yields an empty models.json.
	l, units, _, _, err := loadFactionUnits(profile, emPaRoot, emPaDataRoot, true)
	if err != nil {
		return err
	}
	defer l.Close()

	refs := make([]models3d.UnitRef, 0, len(units))
	for _, u := range units {
		refs = append(refs, models3d.UnitRef{ID: u.ID, ResourceName: u.ResourceName})
	}

	modelOutDir := filepath.Join(emOutputDir, exporter.SanitizeFolderName(profile.DisplayName))

	fmt.Printf("\nGenerating models for %d unit(s) into %s ...\n", len(refs), modelOutDir)
	idx, stats, err := models3d.Generate(l, refs, models3d.Options{
		BlenderPath: blenderPath,
		TextureSize: emTextureSize,
		OutDir:      modelOutDir,
		Verbose:     verbose,
	})
	if err != nil {
		return fmt.Errorf("model generation failed: %w", err)
	}

	fmt.Println()
	fmt.Println("✓ Model extraction complete!")
	fmt.Printf("  Units considered: %d\n", stats.Total)
	fmt.Printf("  Converted:        %d\n", stats.Converted)
	fmt.Printf("  Skipped (no model): %d\n", stats.Skipped)
	fmt.Printf("  Failed (conversion): %d\n", stats.Failed)
	fmt.Printf("  Crashed Blender (skipped): %d\n", stats.Crashed)
	fmt.Printf("  models.json: %s (%d units)\n", filepath.Join(modelOutDir, "models.json"), idx.UnitCount)
	return nil
}

// resolveBlenderPath resolves the Blender executable from the flag, then the
// BLENDER environment variable, then PATH, and verifies it is invokable.
func resolveBlenderPath(flagVal string) (string, error) {
	candidate := flagVal
	if candidate == "" {
		candidate = os.Getenv("BLENDER")
	}
	if candidate == "" {
		candidate = "blender"
	}

	resolved, err := exec.LookPath(candidate)
	if err != nil {
		return "", fmt.Errorf("could not find Blender executable %q\n\nInstall Blender 5.1.x and either add it to PATH, pass --blender <path>, or set the BLENDER environment variable.\nLookup error: %v", candidate, err)
	}
	return resolved, nil
}
