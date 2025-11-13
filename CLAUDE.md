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

## Project Status: Phase 1 Complete ✅

**Last Updated**: 2025-11-13

### What Exists ✅
- **Project Plan**: Complete architecture and roadmap in `C:\Users\jamie\Dev\PA\pa-pedia\PROJECT_PLAN.md`
- **Working CLI**: Fully functional Go CLI that extracts PA faction data to portable folders
- **JSON Schemas**: Auto-generated schemas for all data structures
- **Test Data**: Successfully extracted base game (199 units from PA Titans)
- **Clean Architecture**: Migrated and improved logic from old codebase

### Phase 1 Achievements (CLI Foundation)
- ✅ Complete CLI with Cobra framework (extract, validate, generate-schema commands)
- ✅ Modern data models with organized spec categories (Combat, Economy, Mobility, etc.)
- ✅ JSON Schema generation from Go structs (5 schema files)
- ✅ Complete loader system with mod overlay support
- ✅ Full parser implementation (units, weapons, build arms, ammo)
- ✅ Build tree analysis with restriction grammar parser
- ✅ Accessibility marking from commanders
- ✅ Faction folder exporter (metadata.json + units.json + assets/)
- ✅ Working base game extraction (tested with real PA installation)
- ✅ Working mod extraction (with mod discovery and overlay)
- ✅ Hardcoded corrections for PA data inconsistencies

### What Does NOT Exist Yet
- Web application (Phase 2)
- Asset extraction for unit icons (deferred)
- Faction validation implementation (stub exists)
- Mod zip file handling (currently works with extracted directories)
- Build pipelines and CI/CD

### Migration Accomplishments
Successfully rewrote old codebase with improvements:
- ✅ New output format (faction folders instead of single JSON)
- ✅ Type-safe schema generation (Go → JSON Schema → TypeScript ready)
- ⏳ Enhanced mod support (directory overlay working, zip handling deferred)
- ✅ Better data organization (specs grouped by category)
- ✅ Better separation of concerns (CLI and web as distinct applications)

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
# Base game extraction
pa-pedia extract base --pa-root "C:/PA/media" --output "./factions"

# Mod extraction
pa-pedia extract mod --mod-id "com.pa.legion-expansion" \
  --mods-folder "C:/Users/.../server_mods" \
  --output "./factions"
```

**Output**: Faction folders with standardized structure:
```
faction-name/
├── metadata.json          # Faction info (name, version, author)
├── units.json             # Complete unit database
└── assets/               # Unit images
    ├── commander.png
    ├── tank.png
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
│   │   ├── extract.go        # Extract command (base/mod)
│   │   ├── validate.go       # Validate faction folders
│   │   └── generate-schema/  # Schema generation tool
│   ├── pkg/
│   │   ├── models/           # Go structs with JSON tags
│   │   ├── parser/           # Unit parsing logic
│   │   ├── exporter/         # Faction folder generation
│   │   ├── assets/           # Asset extraction
│   │   └── validator/        # Faction validation
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
│   ├── units.schema.json
│   └── unit.schema.json
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

### Unit Database (`units.json`)
```json
{
  "units": [
    {
      "id": "tank",
      "resourceName": "/pa/units/land/tank/tank.json",
      "displayName": "Ant",
      "description": "Light Assault Tank",
      "image": "./assets/tank.png",
      "tier": 1,
      "unitTypes": ["Mobile", "Tank", "Basic", "Land"],
      "accessible": true,
      "specs": {
        "combat": { "health": 200, "dps": 20, "weapons": [...] },
        "economy": { "buildCost": 90, "production": {...} },
        "mobility": { "moveSpeed": 15, "turnSpeed": 720 },
        "recon": { "visionRadius": 100 }
      },
      "buildRelationships": {
        "builds": [],
        "builtBy": ["vehicle_factory"]
      }
    }
  ]
}
```

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

### Schema Generation Workflow (To Be Implemented)

**Step 1**: Add `//go:generate` directive in Go code
```go
//go:generate go run ./cmd/generate-schema
```

**Step 2**: Run schema generation
```bash
cd cli
go generate ./...
```

**Step 3**: Generate TypeScript types
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

## Important Patterns and Conventions

### 1. Resource Names
PA uses resource names as unique identifiers:
- Format: `/pa/units/land/tank/tank.json`
- Always forward slashes, starts with `/pa/` or `/pa_ex1/`
- Used as primary keys throughout system

### 2. Safe Names
Short identifiers derived from resource names:
- Example: `/pa/units/land/tank/tank.json` → `"tank"`
- Priority: filename > directory name > directory + numeric suffix
- Used for human-readable references and relationships

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

### 7. Mod Overlay System
**File Priority** (highest to lowest):
1. Active mods (in order specified)
2. Expansion directory (`/pa_ex1/`)
3. Base game (`/pa/`)

**Process**: When loading `/pa/units/land/tank/tank.json`:
1. Check each mod's `pa/units/land/tank/tank.json`
2. Check `pa_root/pa_ex1/units/land/tank/tank.json`
3. Check `pa_root/pa/units/land/tank/tank.json`
4. Use first one found

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

1. **Phase 1**: Set up new CLI structure with Cobra commands
2. **Phase 2**: Migrate models with JSON Schema tags
3. **Phase 3**: Migrate parser logic (unit, tools, restrictions)
4. **Phase 4**: Migrate loader with zip extraction
5. **Phase 5**: Implement new exporter for faction folders
6. **Phase 6**: Add schema generation
7. **Phase 7**: Add asset extraction (new feature)
8. **Phase 8**: Add validation command

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
cd cli
go generate ./...
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
- **Server Mods**: `C:\Users\<username>\AppData\Local\Uber Entertainment\Planetary Annihilation\server_mods`
- **Unit List**: `{media}/pa/units/unit_list.json`
- **Expansion**: `{media}/pa_ex1/units/...`

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
