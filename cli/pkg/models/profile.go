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
	FactionUnitType string `json:"factionUnitType" jsonschema:"required,description=Faction unit type identifier without UNITTYPE_ prefix (e.g. 'Custom58' for MLA)"`

	// Mods lists mod identifiers that layer on top of base game.
	// Order determines priority (first = highest). Empty for base game only factions.
	Mods []string `json:"mods,omitempty" jsonschema:"description=Mod identifiers that layer on base game in priority order (empty for base game only)"`

	// Author credit for the faction/profile.
	Author string `json:"author,omitempty" jsonschema:"description=Faction or profile author"`

	// Description provides context about the faction.
	Description string `json:"description,omitempty" jsonschema:"description=Brief description of the faction"`

	// BackgroundImage is an optional resource path to a background image within the mod sources.
	// Uses the same path format as other PA resources (e.g., "/ui/mods/my_mod/img/background.png").
	// The image will be loaded from mod sources and copied to the faction output folder during export.
	BackgroundImage string `json:"backgroundImage,omitempty" jsonschema:"description=Resource path to background image within mod sources (e.g. /ui/mods/my_mod/img/bg.png)"`
}
