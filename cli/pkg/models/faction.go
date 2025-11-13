package models

// FactionMetadata represents the metadata.json file for a faction folder
type FactionMetadata struct {
	Identifier  string `json:"identifier" jsonschema:"required,description=Unique identifier for the faction (e.g. com.pa.legion-expansion)"`
	DisplayName string `json:"displayName" jsonschema:"required,description=Human-readable name for the faction"`
	Version     string `json:"version" jsonschema:"required,description=Semantic version of the faction data (e.g. 1.2.0)"`
	Author      string `json:"author,omitempty" jsonschema:"description=Author or organization that created this faction"`
	Description string `json:"description,omitempty" jsonschema:"description=Brief description of the faction"`
	DateCreated string `json:"dateCreated,omitempty" jsonschema:"description=ISO 8601 date when faction was created (YYYY-MM-DD)"`
	Build       string `json:"build,omitempty" jsonschema:"description=PA game build number this faction targets"`
	Type        string `json:"type" jsonschema:"required,enum=base-game,enum=mod,description=Type of faction (base-game or mod)"`
}

// FactionDatabase represents the units.json file for a faction folder
type FactionDatabase struct {
	Units []Unit `json:"units" jsonschema:"required,description=Complete list of units in this faction"`
}
