# CLAUDE.md

AI assistant context for the PA-Pedia project.

> **For project overview, setup, and FAQs**: See [README.md](README.md)
> **For architecture, roadmap, and current phase status**: See [PROJECT_PLAN.md](PROJECT_PLAN.md)

## Quick Context

PA-Pedia extracts Planetary Annihilation faction data (base game + mods) into portable faction folders. Two-component architecture:
1. **CLI (Go)**: Data extraction tool (current focus)
2. **Web (React)**: Browsing interface (planned Phase 2)

**Current Phase**: 1.5 - Refactoring for multi-mod support and provenance tracking

## Data Models & Output

### Faction Folder Structure
```
faction-name/
├── metadata.json          # Faction info
├── units.json             # Lightweight index (~165KB for 199 units)
└── units/{id}/            # All files per unit
    ├── {id}.json          # Raw PA data
    ├── {id}_resolved.json # Parsed specs (base_spec merged, DPS calculated)
    ├── {id}_tool_weapon.json
    ├── {id}_ammo.json
    └── {id}_icon_buildbar.png
```

### Key Data Structures
- **FactionMetadata**: Faction info (name, version, author, mods used)
- **FactionIndex** (`units.json`): Lightweight array of unit entries with file listings
- **UnitIndexEntry**: identifier, displayName, unitTypes, source, files[], resolvedFile
- **Unit** (resolved files): Complete parsed specs with all calculations done
- **Weapon**, **Ammo**, **BuildArm**: Tool specifications

See `cli/pkg/models/` for Go structs and `schema/` for JSON schemas.

## Critical Patterns

### 1. Mod Overlay System (Phase 1.5)
A faction may span multiple sources (base game + multiple mods).

**Mod Discovery Locations** (search in order):
1. `{pa_root}/../../server_mods/` - User-installed server mods
2. `{pa_root}/../../client_mods/` - User-installed client mods
3. `{pa_root}/../../download/` - PA-managed zip files

**File Priority** (first-wins when same file in multiple sources):
1. First `--mod` specified
2. Second `--mod` specified
3. ...additional mods...
4. `/pa_ex1/` (Titans expansion)
5. `/pa/` (base game)

**Important**: First wins, not last! Track ALL discovered files with provenance.

### 2. Unit Identifiers
- Derived from filename: `/pa/units/land/tank/tank.json` → `"tank"`
- Used for folder names in `units/{identifier}/`
- Priority: filename > directory name > directory + suffix

### 3. Icon Naming
- Pattern: `{unit_identifier}_icon_buildbar.png`
- Icon may be in different mod than unit JSON
- Search all sources, keep original filename

### 4. Resolved Files (NEW in Phase 1.5)
- Pattern: `{unit_identifier}_resolved.json`
- Contains complete Unit struct with:
  - All base_spec inheritance merged
  - DPS calculations complete
  - Net economy rates calculated
  - Build relationships established
  - Accessibility flag set
  - Display names delocalized
- Web app should use resolved files, not raw PA JSON

### 5. Base Spec Inheritance
Units can inherit: `"base_spec": "/pa/units/land/base_vehicle/base_vehicle.json"`
Recursively load base, copy fields, overlay current fields.

### 6. Build Restrictions Grammar
- `&` (AND), `|` (OR), `-` (MINUS), `()` (grouping)
- Example: `"(Mobile | Air) & Basic"`
- Precedence: OR < AND < MINUS

### 7. Unit Types
PA uses prefixed types; we strip `UNITTYPE_`:
- Mobility: `Mobile`, `Structure`
- Domain: `Land`, `Air`, `Naval`, `Orbital`
- Tier: `Basic` (T1), `Advanced` (T2), `Titan` (T3)
- Role: `Tank`, `Factory`, `Commander`, etc.

### 8. Hardcoded Corrections
PA data has inconsistencies requiring manual fixes:
- `tutorial_titan_commander` - Mark inaccessible
- `sea_mine`, `land_mine` - Mark inaccessible
- `titan_structure` - Fix tier=3, add Titan type
- `teleporter` - Fix tier=1
- `mining_platform` - Fix tier=2

Document reasoning for each correction in code.

## Schema Synchronization

**Process**: Go Structs → JSON Schema → TypeScript Types

### Generate Schemas
```bash
cd cli/tools/generate-schema
./build-and-run.bat  # Windows
./build-and-run.sh   # Unix/Mac
```

### Generate TypeScript Types (Web, Phase 2)
```bash
cd web
npm run generate-types
```

**Schemas**: See `schema/` directory (5 files currently)

## Common Development Tasks

### Add New Unit Field
1. Update Go struct in `cli/pkg/models/` with JSON tags
2. Update parser in `cli/pkg/parser/unit.go`
3. Regenerate schema (run generate-schema tool)
4. Regenerate TS types (Phase 2: `npm run generate-types`)

### Debug Parsing Issues
```go
// Enable verbose logging
fmt.Printf("DEBUG: Parsing %s\n", unitPath)
fmt.Printf("DEBUG: Data = %+v\n", data)

// Target specific unit
if strings.Contains(unitPath, "problematic_unit") {
    log.Printf("Full JSON: %s", string(jsonBytes))
}
```

**Common issues**:
- Missing fields → use `omitempty` tag and zero defaults
- Type mismatches → PA uses float64, cast as needed
- Nested inheritance → check base_spec recursion depth
- Tool detection → check both name patterns AND `tool_type` field

## Migration from Old Codebase

**Location**: `C:\Users\jamie\Dev\PA\planetary-annihilation-db\cli\`

**Reusing**:
- ✅ Core parsing logic (unit, tools, restrictions, build tree)
- ✅ Loader system (enhanced for Phase 1.5)
- ✅ Data models (adapted with JSON Schema tags)
- ✅ Hardcoded corrections

**NOT Migrating**:
- ❌ Config file system (use CLI flags)
- ❌ Single JSON export (now faction folders)
- ❌ Titans toggle (Titans-only now)
- ❌ Old command structure (now `describe-faction`)

## File Paths (Windows)

**PA Installation**:
- Media: `C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media`
- Data Root: `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation`
- Server Mods: `{Data Root}\server_mods\{mod-id}\`
- Client Mods: `{Data Root}\client_mods\{mod-id}\`
- Downloads: `{Data Root}\download\{mod-id}.zip`

**Development**:
- This Project: `C:\Users\jamie\Dev\PA\pa-pedia`
- Old Project: `C:\Users\jamie\Dev\PA\planetary-annihilation-db`

## AI Assistant Guidelines

### When Starting Features
1. Check PROJECT_PLAN.md for current phase and tasks
2. Review relevant patterns in this file
3. Consider schema sync impact
4. Plan for both CLI and web if applicable

### When Debugging
1. Check which component (CLI or web)
2. Review patterns section above
3. Add verbose logging at problem points
4. Validate against schemas if data-related

### Code Style
- **Go**: Standard conventions (gofmt, staticcheck clean)
- **TypeScript**: Strict mode, explicit types
- **React**: Functional components with hooks
- **Naming**: kebab-case files, PascalCase components
- **Comments**: Explain "why", not "what"

### When Adding Dependencies
1. Update `go.mod` or `package.json`
2. Document why needed
3. Consider bundle size (web) or binary size (CLI)
4. Verify cross-platform compatibility

## Resources

**Internal**:
- [PROJECT_PLAN.md](PROJECT_PLAN.md) - Architecture and roadmap
- [README.md](README.md) - User-facing docs
- Old CLI: `C:\Users\jamie\Dev\PA\planetary-annihilation-db\cli\CLAUDE.md`

**External**:
- JSON Schema: https://json-schema.org/
- Go jsonschema: https://github.com/invopop/jsonschema
- Cobra CLI: https://github.com/spf13/cobra
- PA Mod Forum: https://forums.planetaryannihilation.com/forums/mods.93/
