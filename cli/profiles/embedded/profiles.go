package embedded

import "embed"

// Profiles contains all built-in faction profile JSON files.
//
//go:embed *.json
var Profiles embed.FS
