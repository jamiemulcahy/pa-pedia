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

### 3.1 Factory Weapon Ammo Handling

Factory-sourced weapons (like nuke/missile launchers) can fire multiple ammo types that are built separately. These weapons have `ammo_source: "factory"` and the unit defines available ammo in `buildable_projectiles`.

**How it works**:
- Parser extracts `buildable_projectiles` array from unit data
- For weapons with `ammo_source: "factory"`, all buildable projectiles are parsed
- Individual ammo specs stored in `weapon.BuildableAmmo[]` array
- First ammo also set as `weapon.Ammo` for backwards compatibility

**Aggregation strategy (MAX values)**:
- Weapon-level stats (damage, DPS, splash radius, etc.) use MAX values across all ammo types
- Rationale: Factory weapons fire one ammo type at a time, not all simultaneously
- MAX represents the weapon's "best case" potential, which is how players evaluate weapons
- Individual ammo details remain available in `BuildableAmmo` for granular display

**Example** (Exiles missile_facility):
```
buildable_projectiles:
- large_DOT_ammo (spawns damage-over-time unit)
- large_stun_ammo (splash=100, radius=150)
- precision_strike_ammo (damage=10000, splash=10000)

Aggregated weapon stats:
- damage: 10000 (from precision_strike)
- splashRadius: 150 (from large_stun)
- muzzleVelocity: 200 (from large_DOT)
```

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
# List available profiles (from repo root)
just cli-list-profiles

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

### GitHub Repository Sources

Use GitHub repositories directly as mod sources without downloading them manually. The `--mod` flag accepts both local mod IDs and GitHub URLs.

```bash
# Use a GitHub repo as mod source (downloads automatically)
pa-pedia describe-faction --profile mla \
  --mod "github.com/NiklasKroworsch/Exiles" \
  --pa-root "C:/PA/media"

# Specify a branch or tag
pa-pedia describe-faction --profile mla \
  --mod "github.com/user/repo/tree/v2.0" \
  --pa-root "C:/PA/media"

# Mix local and GitHub mods (first listed has highest priority)
pa-pedia describe-faction --name "Custom" \
  --faction-unit-type Custom99 \
  --mod "github.com/user/remote-mod" \
  --mod com.pa.local-mod \
  --pa-root "C:/PA/media" \
  --data-root "%LOCALAPPDATA%/Uber Entertainment/Planetary Annihilation"
```

GitHub URLs can also be used in profile `mods` arrays:
```json
{
  "displayName": "Exiles",
  "factionUnitType": "Custom6",
  "mods": ["github.com/NiklasKroworsch/Exiles"]
}
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
| `--mod` | No | - | Mod source(s) - local mod ID or GitHub URL (repeatable, first = highest priority) |

*Either `--profile` or `--name` is required (mutually exclusive).

### Common Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--pa-root` | Yes | - | PA media directory path |
| `--data-root` | For local mods | - | PA data directory (for local mod discovery, not needed for GitHub-only mods) |
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

**Preferred** (from repo root):
```bash
just schema-sync  # Generates schemas and TypeScript types
```

**Individual steps** (if needed):
1. Modify Go structs in `pkg/models/`
2. `just generate-schema` - Generates JSON schemas to `schema/`
3. `just generate-types` - Generates TypeScript types from schemas

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

**Preferred** (from repo root):
```bash
just cli-build       # Build binary
just cli-test        # Run tests
just cli-build-race  # Build with race detection
```

**From cli directory**:
```bash
go build -o pa-pedia.exe      # Build binary
go test ./...                  # Run tests
go build -race -o pa-pedia.exe # Build with race detection
```

## Development Workflow

1. Make changes to Go structs/parsing logic
2. Build: `just cli-build`
3. Test with real PA data: `./cli/pa-pedia.exe describe-faction ...`
4. Regenerate schemas if models changed: `just schema-sync`
5. Update tests if behavior changed: `just cli-test`

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
