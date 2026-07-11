package cmd

import (
	"fmt"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
	"github.com/jamiemulcahy/pa-pedia/pkg/profiles"
)

// resolveProfileFromFlags turns the profile/manual-mode flags into a
// FactionProfile, applying the same rules as describe-faction (mutually
// exclusive --profile/--name, CLI --mod flags prepended at highest priority).
// Shared by describe-faction and extract-models.
func resolveProfileFromFlags(pl *profiles.Loader, profileID, name, unitType string, mods []string) (*models.FactionProfile, error) {
	if profileID != "" && name != "" {
		return nil, fmt.Errorf("--profile and --name are mutually exclusive\n\nUse --profile for profile-based extraction (recommended)\nUse --name with --faction-unit-type for manual mode")
	}

	if profileID != "" {
		profile, err := pl.GetProfile(profileID)
		if err != nil {
			return nil, fmt.Errorf("profile '%s' not found\n\nUse --list-profiles to see available profiles", profileID)
		}
		logVerbose("Using profile: %s (%s)", profile.ID, profile.DisplayName)
		// CLI --mod flags go first (highest priority)
		if len(mods) > 0 {
			profile.Mods = append(mods, profile.Mods...)
		}
		return profile, nil
	}

	if name != "" {
		if unitType == "" {
			return nil, fmt.Errorf("--faction-unit-type is required when using --name\n\nExample: --faction-unit-type Custom58 (for MLA) or Custom1 (for Legion)")
		}
		logVerbose("Using manual mode: %s with unit type %s", name, unitType)
		return &models.FactionProfile{
			ID:              name,
			DisplayName:     name,
			FactionUnitType: unitType,
			Mods:            mods,
		}, nil
	}

	return nil, fmt.Errorf("either --profile or --name is required\n\nUse --profile for profile-based extraction (recommended)\nUse --name with --faction-unit-type for manual mode\nUse --list-profiles to see available profiles")
}

// validateFactionInputs checks --pa-root is set and that --data-root is present
// (and structurally valid) whenever the profile needs local mods. Shared by
// describe-faction and extract-models.
func validateFactionInputs(profile *models.FactionProfile, paRoot, paDataRoot string) error {
	if paRoot == "" {
		return fmt.Errorf("--pa-root is required")
	}

	hasLocalMods := false
	for _, mod := range profile.Mods {
		if !loader.IsGitHubURL(mod) {
			hasLocalMods = true
			break
		}
	}
	if hasLocalMods && paDataRoot == "" {
		return fmt.Errorf("--data-root is required when local mods are involved\n\nProfile '%s' has local mods that need to be discovered\n\nCommon locations:\n  Windows: %%LOCALAPPDATA%%\\Uber Entertainment\\Planetary Annihilation\n  macOS: ~/Library/Application Support/Uber Entertainment/Planetary Annihilation\n  Linux: ~/.local/Uber Entertainment/Planetary Annihilation",
			profile.ID)
	}

	if paDataRoot != "" {
		if err := validateDataRoot(paDataRoot); err != nil {
			return fmt.Errorf("invalid --data-root: %w", err)
		}
	}
	return nil
}

// loadFactionUnits resolves a profile's mod sources, builds a multi-source
// loader with the correct first-wins overlay, and loads the faction's units
// (handling both the normal faction-type filter path and the addon
// exclusion path).
//
// The returned loader is left OPEN so callers can continue to resolve/copy
// resources (specs, icons, .papa models) from the same overlay. Callers MUST
// defer l.Close().
//
// baseFactions is populated (from detected unit faction types) only for addon
// profiles; it is nil otherwise.
//
// Shared by `describe-faction` and `extract-models` so both consume identical
// overlay/provenance resolution.
func loadFactionUnits(profile *models.FactionProfile, paRoot, paDataRoot string, allowEmpty bool) (*loader.Loader, []models.Unit, []*loader.ModInfo, []string, error) {
	var resolvedMods []*loader.ModInfo

	// If profile has mods, discover and resolve them
	if len(profile.Mods) > 0 {
		// Separate GitHub mods from local mods
		var githubModURLs []string
		var localModIDs []string
		for _, mod := range profile.Mods {
			if loader.IsGitHubURL(mod) {
				githubModURLs = append(githubModURLs, mod)
			} else {
				localModIDs = append(localModIDs, mod)
			}
		}

		resolvedMods = make([]*loader.ModInfo, 0, len(profile.Mods))

		// Resolve GitHub mods first (they have highest priority as they appear first in the list)
		if len(githubModURLs) > 0 {
			fmt.Println("Resolving GitHub mods...")
			for _, url := range githubModURLs {
				modInfo, err := loader.ResolveGitHubMod(url, verbose)
				if err != nil {
					return nil, nil, nil, nil, fmt.Errorf("failed to resolve GitHub mod: %w", err)
				}
				resolvedMods = append(resolvedMods, modInfo)
				fmt.Printf("  ✓ %s (%s) [%s]\n", modInfo.Identifier, modInfo.DisplayName, modInfo.SourceType)
				fmt.Printf("    Source: %s (zip)\n", modInfo.ZipPath)
			}
			fmt.Println()
		}

		// Resolve local mods (if any)
		if len(localModIDs) > 0 {
			fmt.Println("Discovering local mods...")
			allMods, err := loader.FindAllMods(paDataRoot, verbose)
			if err != nil {
				return nil, nil, nil, nil, fmt.Errorf("failed to discover mods: %w", err)
			}

			fmt.Printf("Found %d total mods across all locations\n", len(allMods))
			if verbose {
				for id, mod := range allMods {
					fmt.Printf("  - %s (%s) [%s]\n", id, mod.DisplayName, mod.SourceType)
				}
			}
			fmt.Println()

			fmt.Println("Resolving requested local mods...")
			for _, modID := range localModIDs {
				modInfo, ok := allMods[modID]
				if !ok {
					showAvailableMods(modID, allMods)
					return nil, nil, nil, nil, fmt.Errorf("mod not found: %s", modID)
				}

				resolvedMods = append(resolvedMods, modInfo)
				fmt.Printf("  ✓ %s (%s) [%s]\n", modInfo.Identifier, modInfo.DisplayName, modInfo.SourceType)
				if modInfo.IsZipped {
					fmt.Printf("    Source: %s (zip)\n", modInfo.ZipPath)
				} else {
					fmt.Printf("    Source: %s (directory)\n", modInfo.Directory)
				}
			}
			fmt.Println()
		}
	}

	// Create multi-source loader (works for both base game and modded)
	fmt.Println("Initializing loader...")
	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", resolvedMods)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("failed to create loader: %w", err)
	}

	// From here on, any error must close the loader before returning.
	fail := func(err error) (*loader.Loader, []models.Unit, []*loader.ModInfo, []string, error) {
		l.Close()
		return nil, nil, nil, nil, err
	}

	// Load merged unit list (for verbose output)
	if len(profile.Mods) > 0 {
		fmt.Println("Loading and merging unit lists...")
		unitPaths, provenance, err := l.LoadMergedUnitList()
		if err != nil {
			return fail(fmt.Errorf("failed to load merged unit list: %w", err))
		}

		fmt.Printf("Merged %d unique units from all sources\n", len(unitPaths))
		if verbose {
			sourceCounts := make(map[string]int)
			for _, source := range provenance {
				sourceCounts[source]++
			}
			fmt.Println("\nUnit distribution by source:")
			for source, count := range sourceCounts {
				fmt.Printf("  - %s: %d units\n", source, count)
			}
		}
		fmt.Println()
	}

	// Create database parser and load units
	fmt.Println("Loading units...")
	db := parser.NewDatabase(l)

	var units []models.Unit
	var baseFactions []string

	if profile.IsAddon {
		// ADDON PATH: Load all units, then filter out base game units
		if err := db.LoadUnitsNoFilter(verbose); err != nil {
			return fail(fmt.Errorf("failed to load units: %w", err))
		}

		// Load base game units for comparison (MLA = Custom58).
		// All PA addon mods shadow MLA units regardless of which factions they extend.
		fmt.Println("\nLoading base game units for comparison...")
		baseLoader, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
		if err != nil {
			return fail(fmt.Errorf("failed to create base game loader: %w", err))
		}
		defer baseLoader.Close()

		baseDB := parser.NewDatabase(baseLoader)
		if err := baseDB.LoadUnitsNoFilter(verbose); err != nil {
			return fail(fmt.Errorf("failed to load base game units: %w", err))
		}

		baseUnitIDs := baseDB.GetUnitIDs()
		fmt.Printf("Loaded %d base game units for comparison\n", len(baseUnitIDs))

		filteredCount := db.FilterOutUnits(baseUnitIDs)
		fmt.Printf("Filtered out %d base game units, keeping %d addon units\n", filteredCount, len(db.Units))

		if len(db.Units) == 0 {
			if allowEmpty {
				fmt.Printf("\n⚠ WARNING: No new units found in addon (all units exist in base game)\n")
				fmt.Printf("   The faction export will contain 0 units (--allow-empty is set).\n\n")
			} else {
				return fail(fmt.Errorf("no new units found in addon (all units exist in base game)\n\nThe addon appears to only shadow base game units without adding new ones.\nTo allow empty exports, use the --allow-empty flag"))
			}
		}

		units = db.GetUnitsArray()
		fmt.Printf("\nLoaded %d addon units\n", len(units))

		// Auto-detect which base factions this addon extends from the
		// remaining units' faction types (used for the "Extends: ..." UI).
		baseFactions = db.DetectBaseFactions()
		if verbose && len(baseFactions) > 0 {
			fmt.Printf("Detected base factions: %v\n", baseFactions)
		}
	} else {
		// NORMAL PATH: Filter by faction unit type
		if err := db.LoadUnits(verbose, profile.FactionUnitType, allowEmpty); err != nil {
			return fail(fmt.Errorf("failed to load units: %w", err))
		}
		units = db.GetUnitsArray()
		fmt.Printf("\nLoaded %d units (filtered by UNITTYPE_%s)\n", len(units), profile.FactionUnitType)
	}

	return l, units, resolvedMods, baseFactions, nil
}
