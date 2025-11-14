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
	Type        string   `json:"type" jsonschema:"required,enum=base-game,enum=mod,description=Type of faction (base-game or mod)"`
	Mods        []string `json:"mods,omitempty" jsonschema:"description=List of mod identifiers that compose this faction"`
}

// FactionDatabase represents the units.json file for a faction folder (DEPRECATED in Phase 1.5)
// This is kept for backward compatibility but new code should use FactionIndex
type FactionDatabase struct {
	Units []Unit `json:"units" jsonschema:"required,description=Complete list of units in this faction"`
}

// FactionIndex represents the new lightweight units.json index format (Phase 1.5+)
type FactionIndex struct {
	Units []UnitIndexEntry `json:"units" jsonschema:"required,description=Lightweight unit index with file provenance"`
}

// UnitIndexEntry represents a single unit in the faction index
type UnitIndexEntry struct {
	Identifier  string     `json:"identifier" jsonschema:"required,description=Unit identifier (e.g. tank, commander)"`
	DisplayName string     `json:"displayName" jsonschema:"required,description=Human-readable unit name (e.g. Ant, Commander)"`
	UnitTypes   []string   `json:"unitTypes" jsonschema:"required,description=Unit type tags (e.g. Mobile, Tank, Basic, Land)"`
	Source      string     `json:"source" jsonschema:"required,description=Primary source that defined this unit (e.g. pa, pa_ex1, com.pa.legion-expansion)"`
	Files       []UnitFile `json:"files" jsonschema:"required,description=All discovered files for this unit with provenance"`
}

// UnitFile represents a single file associated with a unit
type UnitFile struct {
	Path   string `json:"path" jsonschema:"required,description=Relative path within the unit folder (e.g. tank.json, tank_icon_buildbar.png)"`
	Source string `json:"source" jsonschema:"required,description=Source that provided this file (e.g. pa, pa_ex1, com.pa.legion-expansion)"`
}
