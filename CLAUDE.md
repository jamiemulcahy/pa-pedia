# CLAUDE.md

This file provides comprehensive context and guidance for AI assistants working on the PA-Pedia project.

## Project Overview

**PA-Pedia** is a complete rewrite and modernization of the Planetary Annihilation unit database system. It transforms the old monolithic approach into a clean, modern architecture with separated concerns.

### Core Mission
Enable players and modders to explore, compare, and analyze Planetary Annihilation faction units through:
1. A portable CLI tool that extracts unit data into standardized faction folders
2. A modern web interface for browsing and comparing factions

### Why This Exists
Planetary Annihilation has a rich modding ecosystem with multiple faction mods (Legion, MLA, Queller AI, etc.). Players need a way to:
- Compare base game units with modded factions
- Understand unit specifications and relationships
- Make informed decisions about mod installations
- Analyze faction balance and differences

## Project Status: Phase 1 - Major Refactoring in Progress 🔄

**Last Updated**: 2025-11-14

### Phase 1.0 Complete ✅ (Initial Implementation)
- ✅ Complete CLI with Cobra framework (extract base/mod commands)
- ✅ Modern data models with organized spec categories
- ✅ JSON Schema generation from Go structs (6 schema files)
- ✅ Complete loader system with mod overlay support
- ✅ Full parser implementation (units, weapons, build arms, ammo)
- ✅ Build tree analysis with restriction grammar parser
- ✅ Accessibility marking from commanders
- ✅ Faction folder exporter (metadata.json + units.json + assets/)
- ✅ Working base game extraction (tested with real PA installation)
- ✅ Working mod extraction (with mod discovery and overlay)
- ✅ Hardcoded corrections for PA data inconsistencies

### Phase 1.5 - Major Refactoring (In Progress) 🔄
**Reason**: New requirements emerged after testing with real-world mod scenarios.

**Key Insights from Testing**:
1. We're extracting **factions**, not individual mods
2. A faction's files can span multiple folders (base game + multiple mods)
3. Mods can modify base game units or add completely new units
4. Multiple unit_list.json files must be merged
5. All unit files (not just the primary json) should be preserved with provenance tracking
6. Icons may be defined in different mods than the unit itself

**New Requirements**:
- ✅ Single `describe-faction` command (replacing separate extract base/mod)
- ✅ Multi-location mod discovery (server_mods → client_mods → download)
- ✅ Direct zip file reading (no temp extraction)
- ✅ Multi-mod priority system (first-in-list wins)
- ✅ Provenance tracking (which source provided each file)
- ✅ New output structure with units/ folders containing all discovered files
- ✅ Lightweight units.json index with file listings
- ✅ Icon extraction with original filenames
- ✅ Resolved unit specifications ({unit}_resolved.json with base_spec merged)

### What Does NOT Exist Yet
- Web application (Phase 2)
- Build pipelines and CI/CD

## Architecture

### Two-Component System

#### 1. CLI Application (Go)
**Location**: `C:\Users\jamie\Dev\PA\pa-pedia\cli\`

**Purpose**: Generate portable faction folders that can be consumed by anyone.

**Key Features**:
- Extract base game faction data from PA Titans installation
- Extract mod faction data from server mods (with zip handling)
- Generate JSON schemas from Go structs
- Validate faction folder structure
- Cross-platform single binary (no runtime dependencies)

**Operation Modes**:
```bash
# Base game (MLA) faction extraction
pa-pedia describe-faction --name mla \
  --pa-root "C:/PA/media" \
  --output "./factions"

# Custom faction with multiple mods (first in list wins priority)
pa-pedia describe-faction --name "Legion Enhanced" \
  --pa-root "C:/PA/media" \
  --mod com.pa.legion-expansion \
  --mod com.pa.legion-client \
  --output "./factions"
```

**Output**: Faction folders with complete file provenance:
```
faction-name/
├── metadata.json          # Faction info (name, version, author, mods used)
├── units.json             # Lightweight index (identifier, displayName, unitTypes, source, files[], resolvedFile)
└── units/                 # All discovered unit files organized by unit
    ├── tank/
    │   ├── tank.json                    # Primary unit definition (raw PA data with base_spec)
    │   ├── tank_resolved.json           # Complete parsed specifications (base_spec merged, all calculations done)
    │   ├── tank_tool_weapon.json        # Weapon specs
    │   ├── tank_ammo.json               # Ammo specs
    │   ├── tank_icon_buildbar.png       # Build bar icon
    │   └── ... (all discovered files for this unit)
    ├── commander/
    │   └── ...
    └── ...
```

#### 2. Web Application (React/TypeScript)
**Location**: `C:\Users\jamie\Dev\PA\pa-pedia\web\`

**Purpose**: Modern, dark-mode interface for viewing and comparing faction units.

**Tech Stack**:
- React 18+ with TypeScript
- Vite (build tool)
- Tailwind CSS (styling with dark mode)
- Zustand (state management)
- JSZip (faction upload handling)
- React Router (navigation)

**Core Features**:
1. Load pre-bundled factions from `public/factions/`
2. Upload custom faction zip files
3. Browse units within factions
4. Compare two factions side-by-side
5. Filter and search units
6. Detailed unit specification views
7. Persist uploaded factions in browser storage

## Technology Stack

### CLI (Go)

**Language**: Go 1.21+

**Key Dependencies**:
- `github.com/spf13/cobra` - CLI framework and command structure
- `github.com/invopop/jsonschema` - Generate JSON schemas from Go structs
- `archive/zip` (stdlib) - Extract mod zip files
- `encoding/json` (stdlib) - JSON processing
- `image` (stdlib) - Image processing for assets

**Why Go**:
- Single binary distribution (easy for non-developers)
- Fast execution for large PA installations
- Cross-platform support (Windows/Mac/Linux)
- Strong stdlib for file handling
- Easy cross-compilation

### Web (TypeScript/React)

**Framework**: React 18+

**Build Tool**: Vite (fast dev server, optimized production builds)

**Styling**: Tailwind CSS with dark mode configuration

**Key Dependencies**:
- `react` + `react-dom` - UI framework
- `react-router-dom` - Client-side routing
- `zustand` - Lightweight state management
- `jszip` - Zip file handling in browser
- `json-schema-to-typescript` - Generate TypeScript types (dev dependency)
- `zod` (optional) - Runtime validation

**Why This Stack**:
- Modern, fast development experience
- TypeScript for type safety
- Dark mode by default (PA aesthetic)
- No backend required (fully client-side)
- Works offline after initial load

### Schema Synchronization

**Problem**: Keep Go structs and TypeScript interfaces synchronized.

**Solution**: JSON Schema as the single source of truth.

**Flow**:
```
Go Structs → JSON Schema → TypeScript Types
   (cli)       (schema)        (web)
```

**Process**:
1. Define data structures in Go with JSON tags
2. Generate JSON Schema using `github.com/invopop/jsonschema`
3. Auto-generate TypeScript types from schema using `json-schema-to-typescript`
4. Integrate into build process so types stay synchronized

## Project Structure

```
pa-pedia/
├── cli/                       # Go CLI application
│   ├── cmd/
│   │   ├── root.go           # Root command setup
│   │   └── describe_faction.go  # Main faction extraction command
│   ├── tools/
│   │   └── generate-schema/  # Build tool for JSON schema generation
│   ├── pkg/
│   │   ├── models/           # Go structs with JSON tags
│   │   ├── parser/           # Unit parsing logic
│   │   ├── exporter/         # Faction folder generation
│   │   └── loader/           # Multi-source file loading
│   ├── go.mod
│   ├── go.sum
│   └── main.go               # Entry point
├── web/                       # React web application
│   ├── public/
│   │   └── factions/         # Pre-loaded faction folders
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── FactionCard.tsx
│   │   │   ├── UnitCard.tsx
│   │   │   └── ComparisonView.tsx
│   │   ├── pages/            # Page components
│   │   │   ├── Home.tsx
│   │   │   ├── FactionList.tsx
│   │   │   ├── FactionView.tsx
│   │   │   ├── UnitDetail.tsx
│   │   │   ├── Compare.tsx
│   │   │   └── Upload.tsx
│   │   ├── types/
│   │   │   └── generated/    # Auto-generated from JSON Schema
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/
│   │   │   ├── faction-loader.ts
│   │   │   └── storage.ts
│   │   ├── utils/            # Utility functions
│   │   └── App.tsx           # Root component
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
├── schema/                    # JSON Schema files (generated from Go)
│   ├── faction-metadata.schema.json
│   ├── faction-index.schema.json
│   ├── faction-database.schema.json
│   ├── unit.schema.json
│   ├── weapon.schema.json
│   └── build-arm.schema.json
├── docs/                      # Documentation
│   ├── cli-usage.md
│   ├── faction-format.md
│   └── web-app-guide.md
├── .github/
│   └── workflows/
│       ├── cli-build.yml     # Build Go binaries for releases
│       ├── web-build.yml     # Build and deploy web app
│       └── schema-sync.yml   # Validate schema synchronization
├── .gitignore
├── README.md                  # User-facing documentation
├── CLAUDE.md                 # This file
└── PROJECT_PLAN.md           # Detailed architecture and roadmap
```

## Data Models

### Faction Metadata (`metadata.json`)
```json
{
  "identifier": "com.pa.legion-expansion",
  "displayName": "Legion Faction",
  "version": "1.2.0",
  "author": "Community",
  "description": "Adds Legion faction units",
  "dateCreated": "2024-01-15",
  "build": "123456",
  "type": "mod"  // or "base-game"
}
```

### Unit Index (`units.json`) - NEW FORMAT
```json
{
  "units": [
    {
      "identifier": "tank",
      "displayName": "Ant",
      "unitTypes": ["Mobile", "Tank", "Basic", "Land"],
      "source": "pa",
      "resolvedFile": "tank_resolved.json",
      "files": [
        {
          "path": "tank.json",
          "source": "pa"
        },
        {
          "path": "tank_resolved.json",
          "source": "resolved"
        },
        {
          "path": "tank_tool_weapon.json",
          "source": "pa"
        },
        {
          "path": "tank_ammo.json",
          "source": "pa"
        },
        {
          "path": "tank_icon_buildbar.png",
          "source": "pa_ex1"
        }
      ]
    },
    {
      "identifier": "advanced_tank",
      "displayName": "Vanguard",
      "unitTypes": ["Mobile", "Tank", "Advanced", "Land"],
      "source": "com.pa.legion-expansion",
      "resolvedFile": "advanced_tank_resolved.json",
      "files": [
        {
          "path": "advanced_tank.json",
          "source": "com.pa.legion-expansion"
        },
        {
          "path": "advanced_tank_resolved.json",
          "source": "resolved"
        },
        {
          "path": "advanced_tank_tool_weapon.json",
          "source": "com.pa.legion-expansion"
        },
        {
          "path": "advanced_tank_icon_buildbar.png",
          "source": "com.pa.legion-client"
        }
      ]
    }
  ]
}
```

**Purpose**: Lightweight index for quick unit browsing without loading all unit data. Includes provenance tracking to show which mod/base game provided each file. The `resolvedFile` field points to complete parsed specifications for instant access without re-parsing raw PA JSON or resolving base_spec inheritance.

### Go Models (from old codebase)
The old codebase has well-defined structs in `models/types.go`:
- `Unit` - Complete unit specification
- `Weapon` - Weapon/tool that deals damage
- `Ammo` - Projectile specifications
- `BuildArm` - Construction tool
- `Resources` - Metal/energy pair
- `Database` - Top-level container

**Migration Strategy**: These structs need to be adapted to the new faction folder format with proper JSON Schema tags.

## Development Workflow

### Initial Setup (Not Yet Done)

#### CLI Setup
```bash
cd C:\Users\jamie\Dev\PA\pa-pedia\cli
go mod init github.com/yourusername/pa-pedia-cli
go get github.com/spf13/cobra
go get github.com/invopop/jsonschema
```

#### Web Setup
```bash
cd C:\Users\jamie\Dev\PA\pa-pedia\web
npm create vite@latest . -- --template react-ts
npm install react-router-dom zustand jszip
npm install -D tailwindcss postcss autoprefixer
npm install -D json-schema-to-typescript
npx tailwindcss init -p
```

### Development Commands (Future)

#### CLI Development
```bash
# Run locally
cd cli
go run main.go extract base --pa-root "C:/Path/To/PA/media" --output "./output"

# Build
go build -o pa-pedia.exe

# Run tests
go test ./...

# Generate schemas
go generate ./...

# Cross-compile
GOOS=linux GOARCH=amd64 go build -o pa-pedia-linux
GOOS=darwin GOARCH=amd64 go build -o pa-pedia-mac
```

#### Web Development
```bash
# Start dev server
cd web
npm run dev

# Generate TypeScript types from schema
npm run generate-types

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Lint
npm run lint
```

### Schema Generation Workflow

**Step 1**: Run schema generation build tool
```bash
cd cli/tools/generate-schema

# Windows
.\build-and-run.bat

# Unix/Mac
./build-and-run.sh
```

**Step 2**: Generate TypeScript types
```bash
cd web
npm run generate-types
```

**Step 4**: Verify synchronization
```bash
# Check schema files exist
ls ../schema/*.schema.json

# Check generated types
ls src/types/generated/*.ts
```

## Key Design Decisions

### 1. Faction Folder Format
**Decision**: Output to folder structure instead of single JSON file.

**Rationale**:
- Easier to iterate and update (change metadata without regenerating all units)
- Natural separation of concerns (metadata, data, assets)
- Can be zipped for distribution
- Easier to validate individual components
- Assets stored separately for better caching

**Old Approach Problem**: Single massive JSON made updates slow and error-prone.

### 2. Mod Handling
**Decision**: CLI extracts mods from their native zip files in server_mods directory.

**Rationale**:
- No manual extraction needed
- Reads `modinfo.json` for metadata
- Handles mod priority and base game override logic
- Preserves original mod structure

**Old Approach Problem**: Required manual mod installation, clunky UX.

### 3. Titans-Only
**Decision**: Only support PA Titans expansion, not PA Classic.

**Rationale**:
- Titans is the current version everyone plays
- Simplifies code (no titan/non-titan toggle)
- Most mods target Titans
- Classic is legacy

**Old Approach Problem**: Had explicit titans/non-titans handling that's now redundant.

### 4. Schema Synchronization
**Decision**: JSON Schema as intermediary format.

**Rationale**:
- Single source of truth
- Automatic type generation prevents drift
- Build-time validation
- Industry standard format
- Easy to version control

**Alternative Rejected**: Manual TypeScript type maintenance (error-prone, tedious).

### 5. Client-Side Web App
**Decision**: No backend, fully browser-based with local storage.

**Rationale**:
- Works offline after initial load
- No hosting costs or maintenance
- Instant user-uploaded faction support
- Simple deployment (static files)
- Privacy-friendly (no data sent to server)

**Trade-off**: Cannot share faction databases between users easily (addressed by faction folder format enabling manual sharing).

### 6. Dark Mode Default
**Decision**: Dark mode as primary theme.

**Rationale**:
- Matches PA's aesthetic
- Better for gaming community
- Easier on eyes for long sessions
- Modern UI expectation

### 7. CLI as Separate Binary
**Decision**: Go CLI as standalone tool, not integrated into web app.

**Rationale**:
- Clear separation of concerns
- CLI useful for automation and CI/CD
- Web users don't need PA installed
- Power users can script faction generation
- Single binary easy to distribute

### 8. Faction-Centric vs Mod-Centric (UPDATED - Phase 1.5)
**Decision**: Extract factions (which may span multiple mods), not individual mods.

**Rationale**:
- A "faction" is the actual playable unit set (e.g., "Legion", "MLA")
- A faction may require multiple mods (e.g., legion-server + legion-client)
- A faction may extend base game units (MLA units with modifications)
- Users care about "Can I play Legion?" not "What's in legion-server mod?"
- Web app should show factions, not mods

**Implementation**: Single `describe-faction` command that accepts multiple `--mod` flags.

### 9. Multi-Location Mod Discovery (NEW - Phase 1.5)
**Decision**: Search server_mods, client_mods, and download folders with priority.

**Rationale**:
- PA installs mods to different locations based on type
- Server mods go to server_mods/ (highest priority - user installed)
- Client mods go to client_mods/ (medium priority - user installed)
- Downloaded mods go to download/ as zips (lowest priority - game managed)
- Users may have same mod in multiple locations (prefer user-installed)

**Priority Order**: server_mods → client_mods → download

### 10. Direct Zip Reading (NEW - Phase 1.5)
**Decision**: Read mod files directly from zip archives without extraction.

**Rationale**:
- No temp directory cleanup needed
- No disk space usage for temporary files
- Simpler cross-platform implementation
- Faster for small file reads
- Go's archive/zip package handles this well

**Trade-off**: Slightly more complex code vs cleaner execution.

### 11. First-Wins Priority (NEW - Phase 1.5)
**Decision**: When multiple mods specified, first in list takes precedence.

**Rationale**:
- User specifies `--mod A --mod B` meaning "A is my primary mod, B supplements it"
- Intuitive left-to-right priority (like CSS cascading or shell PATH)
- Matches user mental model: list most important mod first
- Clear, predictable behavior

**Example**: `--mod legion-server --mod legion-client` means legion-server files win over legion-client files.

### 12. Complete File Preservation with Provenance (NEW - Phase 1.5)
**Decision**: Track and save ALL discovered files for each unit with source attribution.

**Rationale**:
- Debugging: Users can see which mod provided each file
- Transparency: Clear visibility into faction composition
- Completeness: Don't lose any data from the discovery process
- Web app can show provenance information
- Helps identify mod conflicts and overrides

**Implementation**: `units.json` includes `files[]` array with source for each file.

### 13. Lightweight Index Format (NEW - Phase 1.5)
**Decision**: Split units.json into lightweight index + full unit files.

**Rationale**:
- Old format: Single 1.2MB file for 199 units (all data in one file)
- New format: Small index (~50KB) + individual unit folders
- Web app can load index quickly to show unit list
- Load full unit data only when needed (lazy loading)
- Better performance for browsing large factions
- Easier to update individual units

**Trade-off**: More files vs better performance and granularity.

## Important Patterns and Conventions

### 1. Resource Names
PA uses resource names as unique identifiers:
- Format: `/pa/units/land/tank/tank.json`
- Always forward slashes, starts with `/pa/` or `/pa_ex1/`
- Used as primary keys throughout system

### 2. Safe Names (Unit Identifiers)
Short identifiers derived from resource names or filenames:
- Example: `/pa/units/land/tank/tank.json` → `"tank"`
- Priority: filename > directory name > directory + numeric suffix
- Used for human-readable references and relationships
- **NEW**: Can also be inferred from `unit_list.json` entries or direct file paths
- The identifier is the filename without path and `.json` extension
- Example: `/path/to/units/artillery_long.json` → identifier is `"artillery_long"`

### 2a. Icon File Naming Convention (NEW)
Build bar icons follow a strict naming pattern:
- Pattern: `{unit_identifier}_icon_buildbar.png`
- Example: For unit "tank", icon is `tank_icon_buildbar.png`
- **Important**: Icon may be defined in a different mod than the unit's JSON
- Must search all sources (mods + pa_ex1 + pa) to find icons
- Keep original filename in output (don't rename to generic "icon.png")

### 2b. Resolved Unit Files (NEW)
Each unit folder contains a resolved specification file with complete parsed data:
- **Pattern**: `{unit_identifier}_resolved.json`
- **Example**: For unit "tank", resolved file is `tank_resolved.json`
- **Contains**: Complete parsed Unit struct from `models.Unit` with all computed fields
- **Includes**:
  - All base_spec inheritance fully merged (no base_spec references)
  - DPS calculations for all weapons
  - Net economy rates (production - consumption)
  - Build relationships (builtBy, builds arrays)
  - Accessibility flag (buildable from commander)
  - Tier information (1=Basic, 2=Advanced, 3=Titan)
  - Delocalized display names (no !LOC: prefix)
- **Purpose**: Web app can load this directly without re-parsing raw PA JSON or resolving base_spec chains
- **Generated**: By CLI exporter during faction extraction
- **Schema**: Matches the Unit schema in `schema/unit.schema.json`
- **Source tag**: Listed in files[] array with source "resolved" to indicate it's computed data

**Usage Pattern**:
1. Raw PA files (e.g., `tank.json`) contain base_spec references and raw game data
2. Resolved files (`tank_resolved.json`) contain fully processed, ready-to-use data
3. Web apps should prefer resolved files for display
4. Advanced users/modders can reference raw files for PA data format

### 3. Unit Types
PA units have type tags (with `UNITTYPE_` prefix removed):
- `Mobile`, `Tank`, `Air`, `Naval`, `Orbital`, `Structure`
- `Basic` (Tier 1), `Advanced` (Tier 2), `Titan` (Tier 3)
- `Commander`, `Factory`, `Construction`
- Used for filtering and build restrictions

### 4. Build Restrictions
Complex grammar for determining what units can build:
- `&` (AND): Must have both types
- `|` (OR): Can have either type
- `-` (MINUS): Has first type but not second
- `()`: Grouping

**Example**: `"(Mobile | Air) & Basic"` = Basic units that are Mobile or Air

**Precedence**: OR (lowest) → AND → MINUS (highest)

### 5. Base Spec Inheritance
Units can inherit from template files:
```json
{
  "base_spec": "/pa/units/land/base_vehicle/base_vehicle.json",
  "max_health": 500
}
```

**Pattern**: Recursively load base, copy fields, then overlay current file's fields.

### 6. Tool Detection
Weapons and build arms are in the `tools` array:
- Detected by name patterns (`weapon`, `build_arm`)
- Or by `tool_type: "TOOL_Weapon"` field
- Death weapons flagged with `death_weapon: true`

### 7. Mod Overlay System (UPDATED - Phase 1.5)

**New Understanding**: A faction may be defined across multiple sources (base game + multiple mods).

**Mod Discovery Priority** (where to look for mods):
1. `{pa_root}/../../server_mods/` - Installed server-side mods
2. `{pa_root}/../../client_mods/` - Installed client-side mods
3. `{pa_root}/../../download/` - Downloaded mod zip files

**File Priority** (first-in-list wins - when multiple sources provide the same file):
1. First mod specified (e.g., `--mod legion-server`)
2. Second mod specified (e.g., `--mod legion-client`)
3. ...additional mods in order...
4. Expansion directory (`/pa_ex1/`)
5. Base game (`/pa/`)

**Important**: First wins, not last! This means `--mod A --mod B` gives A higher priority than B.

**Process**: When loading `/pa/units/land/tank/tank.json`:
1. Check first mod's `pa/units/land/tank/tank.json` (or inside zip if zipped)
2. Check second mod's `pa/units/land/tank/tank.json`
3. Check `{pa_root}/pa_ex1/units/land/tank/tank.json`
4. Check `{pa_root}/pa/units/land/tank/tank.json`
5. Use first one found, but **track ALL found files** with provenance

**Unit List Merging**: Each source may have its own `unit_list.json`:
- Load from all sources (mods + pa_ex1 + pa)
- Merge into deduplicated list
- Maintain discovery order
- Track which source first defined each unit

**File Preservation**: For each unit, discover ALL related files:
- Primary unit JSON (e.g., `tank.json`)
- Weapon JSONs (e.g., `tank_tool_weapon.json`)
- Ammo JSONs (e.g., `tank_ammo.json`)
- Build bar icons (e.g., `tank_icon_buildbar.png`)
- Any other files in the unit's directory
- Copy all to output with source tracking

### 8. Accessibility
Units marked `accessible: true` if buildable from commander:
- Start with commanders (units with "Commander" type)
- Recursively mark everything in their build tree
- Used to filter tutorial/test units

### 9. DPS Calculation
Damage Per Second calculated as:
```
DPS = ROF × Damage × ProjectilesPerFire
```

**ROF**: Rate of Fire (shots per second)
**Damage**: Direct damage per projectile
**ProjectilesPerFire**: Multiple projectiles per shot (e.g., shotgun)

### 10. Economy Rates
Net resource rates account for all consumption:
```
MetalRate = Production - Consumption - ToolConsumption - WeaponConsumption
EnergyRate = Production - Consumption - ToolConsumption - WeaponConsumption
```

**Use Case**: Determine if a unit is a net producer or consumer.

### 11. Web App Data Loading Pattern (NEW)
For optimal performance, the web app should follow this loading strategy:

**Step 1: Load Faction Index**
```typescript
// Load lightweight units.json (165KB for 199 units)
const response = await fetch('/factions/MLA/units.json');
const index: FactionIndex = await response.json();
```

**Step 2: Display Unit List**
```typescript
// Show unit cards using index data only
index.units.forEach(unit => {
  displayUnitCard({
    identifier: unit.identifier,
    displayName: unit.displayName,
    unitTypes: unit.unitTypes,
    // No full specs needed yet - fast initial render
  });
});
```

**Step 3: Load Full Unit Details On Demand**
```typescript
// When user clicks a unit, load its resolved specs
async function showUnitDetails(unitId: string) {
  const unit = index.units.find(u => u.identifier === unitId);

  // Load pre-parsed resolved file
  const response = await fetch(`/factions/MLA/units/${unitId}/${unit.resolvedFile}`);
  const fullUnit: Unit = await response.json();

  // Display complete specs - no parsing needed!
  displayUnitDetails({
    health: fullUnit.specs.combat.health,
    dps: fullUnit.specs.combat.dps,
    buildCost: fullUnit.specs.economy.buildCost,
    moveSpeed: fullUnit.specs.mobility.moveSpeed,
    // All values pre-calculated and ready to use
  });
}
```

**Benefits of This Pattern**:
- ✅ **Fast initial page load** - Small index file (165KB vs 1.2MB full data)
- ✅ **Instant unit details** - Pre-parsed resolved files, no client-side processing
- ✅ **No base_spec resolution needed** - All inheritance already merged
- ✅ **No DPS calculations needed** - Already computed by CLI
- ✅ **Lazy loading** - Only load full specs when needed
- ✅ **Type safety** - Auto-generated TypeScript types from JSON schemas
- ✅ **Complete provenance** - Files array shows which mod provided each file

**Advanced Usage** (for modders/power users):
```typescript
// Access raw PA JSON if needed
const rawFile = unit.files.find(f => f.path === `${unitId}.json`);
const rawResponse = await fetch(`/factions/MLA/units/${unitId}/${rawFile.path}`);
const rawData = await rawResponse.json();
// rawData contains original PA format with base_spec references
```

## Migration from Old Codebase

### Location of Old Code
`C:\Users\jamie\Dev\PA\planetary-annihilation-db\cli\`

### What to Reuse

#### Core Parsing Logic
**Files**: `parser/unit.go`, `parser/tools.go`, `parser/restrictions.go`

**Functionality**:
- Unit JSON parsing (handles base_spec inheritance)
- Weapon/ammo parsing (DPS calculation, ammo consumption)
- Build restriction grammar parser
- Unit type extraction (removes `UNITTYPE_` prefix)

**Migration Notes**: These are well-tested and working. Can be adapted with minimal changes to fit new data models.

#### Loader System
**File**: `loader/loader.go`

**Functionality**:
- JSON file discovery and caching
- Mod overlay system (priority handling)
- Safe name generation
- Helper functions (GetFloat, GetString, GetBool)

**Migration Notes**: Core logic solid, needs enhancement for zip file extraction.

#### Data Models
**File**: `models/types.go`

**Functionality**:
- Well-defined structs for Unit, Weapon, Ammo, BuildArm, Resources

**Migration Notes**: Needs restructuring for faction folder format. Add JSON Schema generation tags.

#### Build Tree Algorithm
**File**: `parser/database.go`

**Functionality**:
- Establish build relationships using restrictions
- Mark accessible units from commanders
- Apply hardcoded corrections for PA data inconsistencies

**Migration Notes**: Algorithm is correct, needs adaptation to new output format.

#### Hardcoded Corrections
Units that need manual fixes due to PA JSON inconsistencies:
- `tutorial_titan_commander` - Mark as inaccessible
- `sea_mine` - Mark as inaccessible
- `titan_structure` - Fix tier to 3, add Titan type
- `teleporter` - Fix tier to 1
- `mining_platform` - Fix tier to 2
- `land_mine` - Fix tier to 1

**Migration Notes**: These corrections are still needed. Document why each exists.

### What NOT to Migrate

#### Configuration File System
**Old**: `config/config.go` for loading settings from file

**New**: CLI flags only (simpler, more transparent)

#### Single JSON Export
**Old**: `exporter/json.go` exports one massive file

**New**: Export faction folder structure with separate metadata, units, and assets

#### Titans Toggle
**Old**: Explicit titans/non-titans handling

**New**: Titans-only, no toggle needed

#### Direct CLI Flags
**Old**: Flags like `--expansion`, `--mods-root`, `--mods`

**New**: Subcommands `extract base` and `extract mod` with clearer semantics

### Migration Strategy

1. **Phase 1**: Set up new CLI structure with Cobra commands ✅
2. **Phase 2**: Migrate models with JSON Schema tags ✅
3. **Phase 3**: Migrate parser logic (unit, tools, restrictions) ✅
4. **Phase 4**: Migrate loader with zip extraction ✅
5. **Phase 5**: Implement new exporter for faction folders ✅
6. **Phase 6**: Add schema generation (moved to build tool) ✅
7. **Phase 7**: Add asset extraction (new feature) ✅

## Common Development Tasks

### Adding a New Unit Field

1. **Update Go model** (`cli/pkg/models/`):
```go
type UnitSpecs struct {
    // ... existing fields ...
    NewField float64 `json:"new_field,omitempty" jsonschema:"description=Description of field"`
}
```

2. **Update parser** (`cli/pkg/parser/unit.go`):
```go
unit.Specs.NewField = loader.GetFloat(data, "json_key_name", defaultValue)
```

3. **Regenerate schema**:
```bash
cd cli/tools/generate-schema
./build-and-run.bat  # or ./build-and-run.sh on Unix
```

4. **Regenerate TypeScript types**:
```bash
cd web
npm run generate-types
```

5. **Use in web app**:
```typescript
// Types are now automatically available
import { UnitSpecs } from '@/types/generated/unit';
```

### Adding a New CLI Command

1. **Create command file** (`cli/cmd/newcommand.go`):
```go
package cmd

import "github.com/spf13/cobra"

var newCmd = &cobra.Command{
    Use:   "new",
    Short: "Brief description",
    RunE:  runNew,
}

func init() {
    rootCmd.AddCommand(newCmd)
    newCmd.Flags().StringVar(&flagVar, "flag", "default", "Description")
}

func runNew(cmd *cobra.Command, args []string) error {
    // Implementation
    return nil
}
```

2. **Add to root command** (if not using `init()`):
```go
rootCmd.AddCommand(newCmd)
```

### Adding a New Web Page

1. **Create page component** (`web/src/pages/NewPage.tsx`):
```tsx
export function NewPage() {
    return (
        <div>
            <h1>New Page</h1>
        </div>
    );
}
```

2. **Add route** (`web/src/App.tsx`):
```tsx
<Route path="/new" element={<NewPage />} />
```

3. **Add navigation link** (in nav component):
```tsx
<Link to="/new">New Page</Link>
```

### Debugging Parse Issues

**Enable verbose logging** in parser:
```go
fmt.Printf("DEBUG: Parsing %s\n", unitPath)
fmt.Printf("DEBUG: Data = %+v\n", data)
```

**Check specific unit**:
```go
if strings.Contains(unitPath, "problematic_unit") {
    log.Printf("Full JSON: %s", string(jsonBytes))
}
```

**Common Issues**:
- Missing fields → Use `omitempty` tag and zero defaults
- Type mismatches → PA uses float64 for everything, cast as needed
- Nested inheritance → Ensure base_spec recursion depth limit
- Tool detection → Check both name patterns and `tool_type` field

## Testing Strategy

### CLI Testing
- Unit tests for parser functions
- Integration tests with sample PA data
- Validation tests for faction folder output
- Cross-platform binary tests

### Web Testing
- Component tests with React Testing Library
- Integration tests for faction loading
- E2E tests with Playwright
- Accessibility tests

### Schema Validation
- Validate Go structs generate valid JSON Schema
- Validate TypeScript types match schema
- Validate sample faction data against schema
- CI check for schema drift

## File Paths and Locations

### PA Installation Paths (Windows)
- **Game Files**: `C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media`
- **PA Data Root**: `C:\Users\<username>\AppData\Local\Uber Entertainment\Planetary Annihilation`
- **Server Mods** (Priority 1): `{PA Data Root}\server_mods\{mod-identifier}\` (extracted directories)
- **Client Mods** (Priority 2): `{PA Data Root}\client_mods\{mod-identifier}\` (extracted directories)
- **Downloaded Mods** (Priority 3): `{PA Data Root}\download\` (zip files like `{mod-identifier}.zip`)
- **Unit List**: `{media}/pa/units/unit_list.json` (and `{media}/pa_ex1/units/unit_list.json`)
- **Expansion**: `{media}/pa_ex1/units/...`
- **Base Game**: `{media}/pa/units/...`

**Note**: For given `--pa-root "C:/.../media"`, mod folders are at `../../server_mods`, `../../client_mods`, `../../download`

### Development Paths
- **New Project**: `C:\Users\jamie\Dev\PA\pa-pedia`
- **Old Project**: `C:\Users\jamie\Dev\PA\planetary-annihilation-db`
- **Old CLI**: `C:\Users\jamie\Dev\PA\planetary-annihilation-db\cli`

### Output Paths (Future)
- **Faction Output**: `./factions/{faction-name}/`
- **Schema Output**: `./schema/*.schema.json`
- **Web Build**: `./web/dist/`
- **CLI Binary**: `./cli/pa-pedia.exe` (or platform-specific)

## Important Context for AI Assistants

### When Starting New Features
1. Check PROJECT_PLAN.md for architecture decisions
2. Verify current phase (check phase status in PROJECT_PLAN.md)
3. Review related patterns in this file
4. Consider schema synchronization impact
5. Plan for both CLI and web components if applicable

### When Migrating from Old Code
1. Understand what the old code does (read old CLAUDE.md)
2. Identify what needs to change for new architecture
3. Don't copy blindly - adapt to new patterns
4. Add JSON Schema tags to data structures
5. Update for faction folder format

### When Debugging
1. Check which component (CLI or web)
2. Review relevant patterns section
3. Check old codebase for reference implementation
4. Add verbose logging at problem points
5. Validate against schemas if data-related

### When Adding Dependencies
1. Update relevant `go.mod` or `package.json`
2. Document why dependency is needed
3. Consider bundle size impact (web)
4. Consider cross-platform compatibility (CLI)
5. Update dependency list in this file

### Code Style Preferences
- **Go**: Follow standard Go conventions (gofmt, staticcheck clean)
- **TypeScript**: Strict mode enabled, explicit types
- **React**: Functional components with hooks
- **File naming**: kebab-case for files, PascalCase for components
- **Comments**: Explain "why", not "what"

## Success Criteria

### Phase 1 Complete (CLI Foundation) ✅ **DONE**
- [x] CLI generates valid faction folders ✅ **Working**
- [x] JSON schemas auto-generated from Go structs ✅ **5 schemas generated**
- [x] Mod extraction works ✅ **With directory overlay**
- [x] Cross-platform binaries build successfully ✅ **Windows tested, Mac/Linux ready**
- [ ] Mod extraction from zip files ⏳ **Deferred** (works with extracted mods)
- [ ] Asset extraction functional ⏳ **Deferred** (directory structure created)
- [ ] Validation command verifies faction folders ⏳ **Deferred** (stub implemented)

### Phase 2 Complete (Web Foundation)
- [ ] Web app loads and displays pre-bundled factions
- [ ] TypeScript types auto-generated from schemas
- [ ] Dark mode UI implemented
- [ ] Faction browsing functional
- [ ] Unit detail views working
- [ ] Responsive design on mobile

### Phase 3 Complete (Advanced Features)
- [ ] Faction upload via zip files working
- [ ] Browser storage persists uploaded factions
- [ ] Side-by-side faction comparison functional
- [ ] Advanced filtering and search working
- [ ] Unit stat visualization implemented

### Phase 4 Complete (Production Ready)
- [ ] Unit tests passing for CLI
- [ ] Unit tests passing for web
- [ ] CI/CD pipelines running
- [ ] Cross-platform releases automated
- [ ] Documentation complete
- [ ] Demo deployment live

## Resources

### Documentation
- **PROJECT_PLAN.md**: Detailed architecture and roadmap
- **Old CLI CLAUDE.md**: `C:\Users\jamie\Dev\PA\planetary-annihilation-db\cli\CLAUDE.md`
- **Old CLI README**: `C:\Users\jamie\Dev\PA\planetary-annihilation-db\cli\README.md`

### External Resources
- **JSON Schema Spec**: https://json-schema.org/
- **Go jsonschema lib**: https://github.com/invopop/jsonschema
- **TypeScript generation**: https://www.npmjs.com/package/json-schema-to-typescript
- **Cobra CLI**: https://github.com/spf13/cobra
- **Vite**: https://vitejs.dev/
- **React Router**: https://reactrouter.com/
- **Tailwind CSS**: https://tailwindcss.com/

### PA Modding Resources
- **PA Mod Forum**: https://forums.planetaryannihilation.com/forums/mods.93/
- **Legion Expansion**: https://forums.planetaryannihilation.com/threads/wip-legion-expansion-faction-old.47850/
- **PA Modding Guide**: Available on Steam Community

## Frequently Asked Questions

### Why separate CLI and web?
Clear separation of concerns. CLI is for data extraction, web is for viewing. Power users can script the CLI, casual users just use the web interface.

### Why Go for CLI?
Single binary with no runtime dependencies. Easy for non-developers to use. Fast, cross-platform, strong stdlib.

### Why not electron for desktop app?
Too heavy. Web app is client-side and works offline anyway. No need for desktop wrapper.

### Why faction folders instead of single JSON?
Easier to update incrementally. Better separation of concerns. Can be versioned. Assets separate for caching.

### Why JSON Schema?
Industry standard. Tools exist for generation. Prevents type drift between Go and TypeScript. Build-time validation.

### Can users share faction folders?
Yes! That's a key feature. Zip the folder, share it, recipient uploads to web app.

### Does this work with PA Classic?
No, Titans only. Classic is legacy and not worth supporting.

### What about serverless/hosting?
Not needed. Web app is fully client-side. Can deploy to static hosting (GitHub Pages, Netlify, etc.).

### Will this work on Mac/Linux?
Yes! Go CLI cross-compiles. Web app is browser-based and platform-agnostic.

### Can I automate faction generation?
Yes! CLI is scriptable. Use in CI/CD to auto-generate on mod updates.

## Version History

### v0.1.0 (Current - In Planning)
- Initial project setup
- Architecture defined in PROJECT_PLAN.md
- CLAUDE.md documentation created
- Repository initialized
- Migration strategy documented

## Next Steps

Based on PROJECT_PLAN.md Phase 1, the immediate next steps are:

1. Set up Go module and CLI structure with Cobra
2. Migrate data models from old codebase with JSON Schema tags
3. Implement schema generation command
4. Migrate parser logic for units, weapons, and restrictions
5. Enhance loader for mod zip file extraction
6. Implement faction folder exporter
7. Add asset extraction from PA files
8. Implement validation command

See PROJECT_PLAN.md for detailed task breakdown and timeline.
