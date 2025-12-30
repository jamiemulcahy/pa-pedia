package models

// FactionProfile defines a faction's identity for extraction.
// Profiles are loaded from embedded resources or local ./profiles/ directory.
// All factions layer on base game - MLA has no mods, other factions add mod layers.
type FactionProfile struct {
	// ID is derived from filename (e.g., "mla" from "mla.json").
	// Not stored in JSON - computed at load time.
	ID string `json:"-"`

	// DisplayName is the human-readable faction name shown in output.
	DisplayName string `json:"displayName" jsonschema:"required,description=Human-readable faction name (e.g. 'MLA' or 'Legion')"`

	// FactionUnitType is the UNITTYPE_ identifier for filtering units.
	// Examples: "Custom58" (MLA), "Custom1" (Legion).
	// For addon profiles (IsAddon=true), this is used only for display/categorization, not filtering.
	FactionUnitType string `json:"factionUnitType,omitempty" jsonschema:"description=Faction unit type identifier (e.g. Custom58 for MLA or Custom1 for Legion)"`

	// IsAddon indicates this profile adds units to an existing base faction.
	// When true, units are filtered by exclusion (remove base game units) rather than inclusion.
	// The extraction compares against MLA base game units and keeps only NEW units.
	IsAddon bool `json:"isAddon,omitempty" jsonschema:"description=True if this profile adds units to an existing base faction rather than defining a new one"`

	// Mods lists mod identifiers that layer on top of base game.
	// Order determines priority (first = highest). Empty for base game only factions.
	Mods []string `json:"mods,omitempty" jsonschema:"description=Mod identifiers that layer on base game in priority order (empty for base game only)"`

	// Author credit for the faction/profile.
	// For modded factions, auto-detected from primary mod's modinfo.json if not specified.
	Author string `json:"author,omitempty" jsonschema:"description=Faction or profile author (auto-detected from primary mod if not specified)"`

	// Description provides context about the faction.
	// For modded factions, auto-detected from primary mod's modinfo.json if not specified.
	Description string `json:"description,omitempty" jsonschema:"description=Brief description of the faction (auto-detected from primary mod if not specified)"`

	// Version is the semantic version for this faction export.
	// For modded factions, auto-detected from primary mod's modinfo.json if not specified.
	// Defaults to "1.0.0" if not specified and no mod version is available.
	Version string `json:"version,omitempty" jsonschema:"description=Semantic version (auto-detected from primary mod if not specified)"`

	// DateCreated is the ISO 8601 date (YYYY-MM-DD) when the faction was created.
	// For modded factions, auto-detected from primary mod's modinfo.json date field if not specified.
	DateCreated string `json:"dateCreated,omitempty" jsonschema:"description=ISO 8601 date (auto-detected from primary mod if not specified)"`

	// Build is the PA game build number this faction targets.
	// For modded factions, auto-detected from primary mod's modinfo.json if not specified.
	Build string `json:"build,omitempty" jsonschema:"description=PA game build number (auto-detected from primary mod if not specified)"`

	// BackgroundImage is an optional resource path to a background image within the mod sources.
	// Uses the same path format as other PA resources (e.g., "/ui/mods/my_mod/img/background.png").
	// The image will be loaded from mod sources and copied to the faction output folder during export.
	BackgroundImage string `json:"backgroundImage,omitempty" jsonschema:"description=Resource path to background image within mod sources (e.g. /ui/mods/my_mod/img/bg.png)"`
}
