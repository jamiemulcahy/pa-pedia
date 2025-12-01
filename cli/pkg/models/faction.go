package models

// FactionMetadata represents the metadata.json file for a faction folder
type FactionMetadata struct {
	Identifier  string   `json:"identifier" jsonschema:"required,description=Unique identifier for the faction (e.g. com.pa.legion-expansion)"`
	DisplayName string   `json:"displayName" jsonschema:"required,description=Human-readable name for the faction"`
	Version     string   `json:"version" jsonschema:"required,description=Semantic version of the faction data (e.g. 1.2.0)"`
	Author      string   `json:"author,omitempty" jsonschema:"description=Author or organization that created this faction"`
	Description string   `json:"description,omitempty" jsonschema:"description=Brief description of the faction"`
	DateCreated string   `json:"dateCreated,omitempty" jsonschema:"description=ISO 8601 date when faction was created (YYYY-MM-DD)"`
	Build       string   `json:"build,omitempty" jsonschema:"description=PA game build number this faction targets"`
	Type            string   `json:"type" jsonschema:"required,enum=base-game,enum=mod,description=Type of faction (base-game or mod)"`
	Mods            []string `json:"mods,omitempty" jsonschema:"description=List of mod identifiers that compose this faction"`
	BackgroundImage string   `json:"backgroundImage,omitempty" jsonschema:"description=Path to faction background image relative to faction folder root"`
}

// FactionDatabase represents the units.json file for a faction folder
// DEPRECATED in Phase 1.5: Use FactionIndex for new implementations.
// This format is kept for backward compatibility with Phase 1.0 exporters.
// The old format embedded all unit data in a single large file, whereas
// FactionIndex provides a lightweight index with references to individual unit files.
type FactionDatabase struct {
	Units []Unit `json:"units" jsonschema:"required,description=Complete list of units in this faction"`
}

// FactionIndex represents the new lightweight units.json index format (Phase 1.5+)
type FactionIndex struct {
	Units []UnitIndexEntry `json:"units" jsonschema:"required,description=Lightweight unit index with file provenance"`
}

// UnitIndexEntry represents a single unit in the faction index
type UnitIndexEntry struct {
	Identifier  string     `json:"identifier" jsonschema:"required,description=Unit identifier such as tank or commander"`
	DisplayName string     `json:"displayName" jsonschema:"required,description=Human-readable unit name such as Ant or Commander"`
	UnitTypes   []string   `json:"unitTypes" jsonschema:"required,description=Unit type tags such as Mobile, Tank, Basic, Land"`
	Source      string     `json:"source" jsonschema:"required,description=Primary source that first defined this unit such as pa, pa_ex1, or com.pa.legion-expansion. For base game units modified by mods, this reflects the original source. See Files array for complete provenance of all unit files including modifications."`
	Files       []UnitFile `json:"files" jsonschema:"required,description=All discovered files for this unit with provenance"`
	Unit        Unit       `json:"unit" jsonschema:"required,description=Complete resolved unit specification with base_spec inheritance merged and all calculations complete. This contains the full parsed Unit object ready for consumption by the web app."`
}

// UnitFile represents a single file associated with a unit
type UnitFile struct {
	Path   string `json:"path" jsonschema:"required,description=Relative path within the unit folder such as tank.json or tank_icon_buildbar.png"`
	Source string `json:"source" jsonschema:"required,description=Source that provided this file such as pa, pa_ex1, or com.pa.legion-expansion"`
}
