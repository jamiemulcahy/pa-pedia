# CLI CLAUDE.md

CLI-specific context for the PA-Pedia extraction tool.

> **For full project context**: See [../CLAUDE.md](../CLAUDE.md)

## Overview

Go CLI tool that extracts Planetary Annihilation faction data from game files into portable faction folders for the web app.

## Tech Stack

- **Language**: Go 1.21+
- **CLI Framework**: [Cobra](https://github.com/spf13/cobra)
- **JSON Schema**: [invopop/jsonschema](https://github.com/invopop/jsonschema) for generating schemas from Go structs
- **No external dependencies** for data parsing (pure Go stdlib)

## Architecture

```
cli/
├── cmd/               # Cobra commands
│   ├── root.go       # Root command + verbose flag
│   └── describe_faction.go  # Main faction extraction command
├── pkg/
│   ├── loader/       # Data loading from PA files (dirs + zips)
│   ├── parser/       # Unit/weapon/ammo parsing + build tree
│   ├── models/       # Go structs (source of truth for schemas)
│   ├── profiles/     # Faction profile loading (embedded + local)
│   └── exporter/     # Faction folder generation
├── profiles/
│   └── embedded/     # Built-in faction profiles (mla.json, legion.json)
└── tools/
    └── generate-schema/  # Schema generator from Go structs
```

## Core Business Logic

### 1. Multi-Source Data Loading (`pkg/loader`)

**Priority-based overlay system** (first-wins):
1. User-specified mods (in order: `--mod` flag order)
2. Expansion (`pa_ex1/`)
3. Base game (`pa/`)

**Key insight**: PA uses a "shadowing" system where expansion files override base game files with same path. The loader implements this via priority-ordered source list.

**Gotcha**: Zip files require index building on open (O(1) lookups vs O(n) scans). Small memory cost (~10-50KB per mod) for major speed gain.

### 2. Unit Parsing (`pkg/parser`)

**Base spec inheritance**: Units can inherit from templates via `base_spec` field. Parser recursively loads and merges base specs (depth-first).

**Unit type normalization**: PA prefixes all types with `UNITTYPE_` - we strip this during parsing for cleaner data model.

**Faction filtering** (NEW): Filter units by faction identifier (e.g., `Custom58` for MLA, `Custom1` for Legion) to separate faction units from base game units.

**Build tree construction**: After parsing all units, construct bidirectional build relationships:
- Parse `buildable_types` grammar (AND/OR/MINUS operators)
- Match against each unit's types
- Build `builds[]` and `builtBy[]` arrays
- Mark accessible units (reachable from commanders)

**Hardcoded corrections**: PA data has inconsistencies (wrong tiers, missing types). See `database.go:applyCorrections()` for list with reasoning.

### 3. Tool Detection (`pkg/parser/unit.go`)

Tools (weapons, build arms) are detected by both:
- Name patterns (`*_tool_weapon.json`, `*_build_arm.json`)
- `tool_type` field value

**Gotcha**: Some tools match by name only, some by field only. Always check both.

### 4. Data Export (`pkg/exporter`)

Generates faction folder with three-tier structure:
1. **Metadata** (`metadata.json`) - Faction info, mods used
2. **Index** (`units.json`) - Lightweight unit listings with file paths
3. **Unit folders** (`units/{id}/`) - Full unit data + assets

**Key optimization**: Web app loads tier 1 on startup, tier 2 on faction view, tier 3 on unit view. Minimizes initial load time.

## Command Usage

### Profile-Based (Recommended)

Profiles define faction identity (name, unit type, mods) in reusable JSON files. Built-in profiles are embedded in the binary.

```bash
# List available profiles
pa-pedia describe-faction --list-profiles

# Base game (MLA)
pa-pedia describe-faction --profile mla --pa-root "C:/PA/media"

# Modded faction (Legion)
pa-pedia describe-faction --profile legion \
  --pa-root "C:/PA/media" \
  --data-root "%LOCALAPPDATA%/Uber Entertainment/Planetary Annihilation"
```

### Manual Mode (Fallback)

For custom configurations without creating a profile file.

```bash
pa-pedia describe-faction --name "My Faction" \
  --faction-unit-type Custom99 \
  --mod com.example.mod \
  --pa-root "C:/PA/media" \
  --data-root "%LOCALAPPDATA%/Uber Entertainment/Planetary Annihilation"
```

## Flags

### Profile-Based Flags (Recommended)

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--profile` | Yes* | - | Profile ID to use (e.g., `mla`, `legion`) |
| `--profile-dir` | No | `./profiles` | Directory for custom faction profiles |
| `--list-profiles` | No | `false` | List available profiles and exit |

### Manual Mode Flags (Fallback)

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--name` | Yes* | - | Faction display name |
| `--faction-unit-type` | Yes | - | Faction unit type identifier (e.g., `Custom58`, `Custom1`) |
| `--mod` | No | - | Mod ID(s) to merge (repeatable, first = highest priority) |

*Either `--profile` or `--name` is required (mutually exclusive).

### Common Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--pa-root` | Yes | - | PA media directory path |
| `--data-root` | For mods | - | PA data directory (for mod discovery) |
| `--output` | No | `./factions` | Output directory |
| `--allow-empty` | No | `false` | Allow exporting factions with 0 units |
| `-v, --verbose` | No | `false` | Enable verbose logging |

## Faction Profiles

### Built-in Profiles

| Profile | Faction | Unit Type | Mods Required |
|---------|---------|-----------|---------------|
| `mla` | MLA | Custom58 | None (base game) |
| `legion` | Legion | Custom1 | com.pa.legion-expansion-server, com.pa.legion-expansion-client |

### Custom Profiles

Add JSON files to `./profiles/` directory.

**Profile Discovery Rules**:
- Profile ID is derived from filename (e.g., `queller.json` → ID `queller`)
- Profile IDs are case-insensitive (`MLA` and `mla` are the same)
- Local profiles override built-in profiles with the same ID
- Only `.json` files are loaded; directories are ignored

**Metadata Auto-Detection**:
For modded factions, metadata is automatically extracted from the primary mod's `modinfo.json`:
- `version` - Mod version (e.g., "1.2.3")
- `author` - Mod author
- `description` - Mod description
- `dateCreated` - From mod's `date` field
- `build` - Target PA build number

Profile values override auto-detected values when specified. Base game factions (no mods) must specify metadata in the profile.

**Profile schema** (`profiles/queller.json`):
```json
{
  "displayName": "Queller AI",
  "factionUnitType": "Custom3",
  "mods": ["com.pa.queller.server", "com.pa.queller.client"],
  "backgroundImage": "ui/mods/queller/img/splash.png"
}
```

Optional override fields (auto-detected from primary mod if not specified):
- `author`, `description`, `version`, `dateCreated`, `build`

**Required fields**: `displayName`, `factionUnitType`

**Validation**: `factionUnitType` must be alphanumeric (e.g., `Custom1`, `Custom58`)

## Faction Unit Type Filtering

**Purpose**: Separate faction-specific units from base game units that get included in mod unit lists.

**How it works**:
- Each unit has `unit_types` array with identifiers like `UNITTYPE_Custom58`, `UNITTYPE_Custom1`
- Filter matches units containing the specified faction identifier (case-insensitive)
- **NO fallback**: If 0 units match, exports 0 units (with warning) - never exports all units

**Common faction identifiers**:
- `Custom58` - MLA (base game)
- `Custom1` - Legion
- Other mods may use different custom identifiers

## Schema Synchronization

**Flow**: Go Structs → JSON Schema → TypeScript Types

1. Modify Go structs in `pkg/models/`
2. Run schema generator:
   ```bash
   cd tools/generate-schema
   ./build-and-run.bat  # Windows
   ./build-and-run.sh   # Unix/Mac
   ```
3. Schemas output to `../../schema/`
4. Web team runs `npm run generate-types` to update TypeScript

**Critical**: Schemas in `schema/` are generated. Never edit them directly.

## Common Gotchas

### 1. Windows Path Handling
- Use `filepath.Join()` for local paths (handles backslashes)
- Use path strings with `/` for resource paths (PA convention)
- Never mix the two

### 2. Zip File Cleanup
- **Must** call `loader.Close()` to release zip file handles
- Use `defer l.Close()` immediately after creating loader
- Even on error paths (loader handles partial cleanup)

### 3. JSON Unmarshaling
- PA uses `float64` for all numbers (even integers)
- Use helper functions: `loader.GetInt()`, `loader.GetFloat()`, etc.
- Missing fields are common - use `omitempty` tags + zero defaults

### 4. Expansion Shadowing
- Files in `pa_ex1/` override files in `pa/` with same relative path
- Example: `/pa/units/land/tank/tank.json` shadowed by `/pa_ex1/units/land/tank/tank.json`
- Loader handles this automatically via source priority

### 5. Build Tree Dependencies
- Build tree must be constructed **after** all units are parsed
- Corrections must be applied **after** build tree construction
- Order matters: Parse → Build Tree → Corrections → Export

### 6. Unit Type Filtering
- Filtering happens **during parsing** (not after)
- 0 units is valid (exports empty faction with warning)
- Never filter by checking if identifier starts with faction prefix - use `unit_types` array
- Base game units may appear in mod unit lists (this is why filtering is needed)

## Building

```bash
# Build binary
go build -o pa-pedia.exe

# Run tests
go test ./...

# Build with race detection (development)
go build -race -o pa-pedia.exe
```

## Development Workflow

1. Make changes to Go structs/parsing logic
2. Build: `go build -o pa-pedia.exe`
3. Test with real PA data: `./pa-pedia.exe describe-faction ...`
4. Regenerate schemas if models changed: `cd tools/generate-schema && ./build-and-run.bat`
5. Update tests if behavior changed: `go test ./...`
6. Notify web team if schemas changed (they need to regenerate TypeScript)

## File Paths (Windows)

**PA Installation**:
- Media: `C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media`
- Data Root: `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation`

**Mod Locations** (within data root):
1. `server_mods/{mod-id}/` - Highest priority
2. `client_mods/{mod-id}/` - Medium priority
3. `download/{mod-id}.zip` - Lowest priority

## Resources

- [Cobra Documentation](https://github.com/spf13/cobra)
- [PA Mod Forum](https://forums.planetaryannihilation.com/forums/mods.93/)
- [Main CLAUDE.md](../CLAUDE.md) - Full project context
