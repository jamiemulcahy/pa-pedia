# PA-Pedia Project Plan

## Overview

PA-Pedia is a complete rewrite and modernization of the Planetary Annihilation unit database project. It consists of two main components:

1. **CLI Application (Go)**: Extract and generate faction data from PA installations and mods
2. **Web Application (React/TypeScript)**: Modern web interface to browse, compare, and analyze faction units

## Problems with Old Approach

- Single JSON file output made iterative updates difficult
- Explicit titans/non-titans handling (now redundant)
- Outdated tech stack
- Mixed responsibilities in single codebase
- Required local mod installation (clunky UX)

## New Architecture

### 1. CLI Application (Go)

**Purpose**: Generate portable faction folders that can be consumed by anyone

**Why Go?**
- Single binary distribution (no runtime needed)
- Cross-platform support
- Fast execution
- Easy for non-developers to use

#### Operation Modes (UPDATED - Phase 1.5)

##### Describe Faction Command
```bash
# Base game faction (MLA - Machine Liquid Army)
pa-pedia describe-faction --name mla \
  --pa-root "C:/PA/media" \
  --output "./factions"

# Custom faction with multiple mods
pa-pedia describe-faction --name "Legion Enhanced" \
  --pa-root "C:/PA/media" \
  --mod com.pa.legion-expansion \
  --mod com.pa.legion-client \
  --output "./factions"
```

**Behavior**:
- Discovers mods from server_mods, client_mods, download folders
- Reads zip files directly (no temp extraction)
- Merges unit lists from all sources (mods + pa_ex1 + pa)
- Applies first-in-list priority for file conflicts
- Tracks provenance for all discovered files
- Output: `./factions/{faction-name}/` with lightweight index + units/ folders

**Mod Discovery Priority**:
1. server_mods/ (user-installed server mods)
2. client_mods/ (user-installed client mods)
3. download/ (PA-managed zip files)

**File Priority** (when same file exists in multiple sources):
1. First mod in --mod list
2. Second mod in --mod list
3. ...
4. pa_ex1/ (Titans expansion)
5. pa/ (base game)

#### Faction Folder Structure (UPDATED - Phase 1.5)

Each faction folder contains:

```
faction-name/
├── metadata.json          # Faction metadata (name, version, author, mods used)
├── units.json             # Lightweight index (identifier, displayName, unitTypes, source, files[])
└── units/                 # All discovered unit files organized by unit identifier
    ├── tank/
    │   ├── tank.json                    # Primary unit definition
    │   ├── tank_tool_weapon.json        # Weapon specifications
    │   ├── tank_ammo.json               # Ammo specifications
    │   ├── tank_icon_buildbar.png       # Build bar icon (original filename)
    │   └── ... (all discovered files for this unit)
    ├── commander/
    │   └── ...
    └── ...
```

##### metadata.json
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

##### units.json (UPDATED - Phase 1.5)

**Purpose**: Lightweight index for quick unit browsing without loading all unit data.

```json
{
  "units": [
    {
      "identifier": "tank",
      "displayName": "Ant",
      "unitTypes": ["Mobile", "Tank", "Basic", "Land"],
      "source": "pa",
      "files": [
        {
          "path": "tank.json",
          "source": "pa"
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
      "files": [
        {
          "path": "advanced_tank.json",
          "source": "com.pa.legion-expansion"
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

**Changes from Phase 1.0**:
- Reduced from ~1.2MB (full data) to ~50KB (index only)
- Added `source` field showing which mod/base defined the unit
- Added `files[]` array listing all discovered files with their sources
- Removed full specs (now in individual unit files)
- Web app can load index quickly, then lazy-load full unit data as needed

#### CLI Commands Structure (UPDATED - Phase 1.5)

```
pa-pedia
├── describe-faction  # Describe a faction (base game or custom with mods)
│   Flags:
│     --name string     (required) Faction display name
│     --pa-root string  (required) Path to PA media directory
│     --output string   (required) Output directory for faction folder
│     --mod strings     (repeatable, optional) Mod identifiers to include
└── help              # Help about any command
```

**Notes**:
- The old `extract base` and `extract mod` commands are replaced by the unified `describe-faction` command
- Schema generation moved to build tool: `cli/tools/generate-schema/`
- Validation functionality (if needed) will be integrated into `describe-faction`

### 2. Web Application (React/TypeScript)

**Purpose**: Modern, dark-mode web interface for viewing and comparing faction units

#### Tech Stack

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (dark mode)
- **State Management**: Zustand or React Context
- **File Handling**: JSZip (for faction upload)
- **Storage**: LocalStorage / IndexedDB (for user-uploaded factions)
- **Routing**: React Router

#### Core Features

##### 1. Faction Loading
- Load factions from local filesystem (served with app)
- Allow users to upload custom faction zip files
- Persist uploaded factions in browser storage
- Support for multiple factions simultaneously

##### 2. Faction Browser
- List all available factions
- Filter by faction type (base game vs. mod)
- Search within factions
- View faction metadata

##### 3. Unit Viewer
- Display all units in a faction
- Filter by tier, type, accessibility
- Search by name/role
- Show unit cards with key stats
- Detail view with full specifications

##### 4. Unit Comparison
- Select two factions for side-by-side comparison
- Compare equivalent units between factions
- Highlight differences in stats
- Visual indicators for better/worse stats
- Support comparing base game vs. mod units

##### 5. Faction Upload
- Drag-and-drop zip file upload
- Validate faction structure
- Extract and parse metadata and units
- Store in browser storage
- Allow deletion of uploaded factions

#### Page Structure

```
/                           # Home - faction selection
/factions                   # List all factions
/faction/:id                # View single faction units
/faction/:id/unit/:unitId   # Unit detail view
/compare                    # Compare two factions
/upload                     # Upload custom faction
/about                      # About page
```

#### UI Design Principles

- Dark mode by default (with light mode toggle optional)
- Modern, clean aesthetics
- Responsive design (mobile-friendly)
- Fast loading with lazy loading for images
- Accessible (WCAG 2.1 AA compliant)
- Smooth animations and transitions

### 3. Schema Synchronization Strategy

**Problem**: Keep Go structs and TypeScript interfaces in sync

**Solution**: JSON Schema as the source of truth

#### Workflow

```
Go Structs → JSON Schema → TypeScript Types
```

#### Implementation

**Step 1**: Add JSON Schema generation to Go CLI

Use `github.com/invopop/jsonschema` library:

```go
import "github.com/invopop/jsonschema"

// Generate schema from Go types
reflector := jsonschema.Reflector{}
schema := reflector.Reflect(&FactionData{})

// Write to file
schemaJSON, _ := json.MarshalIndent(schema, "", "  ")
os.WriteFile("schema/faction.schema.json", schemaJSON, 0644)
```

**Step 2**: Generate TypeScript types from JSON Schema

Use `json-schema-to-typescript` npm package:

```bash
npx json-schema-to-typescript schema/faction.schema.json > src/types/faction.ts
```

**Step 3**: Automate in build process

**Go side** (run build tool before releases):
```bash
cd cli/tools/generate-schema
./build-and-run.bat  # or ./build-and-run.sh on Unix
```

**TypeScript side** (package.json):
```json
{
  "scripts": {
    "generate-types": "json-schema-to-typescript ../schema/*.schema.json -o src/types/generated",
    "prebuild": "npm run generate-types"
  }
}
```

#### Schema Files to Generate

1. **faction-metadata.schema.json** - Faction metadata structure
2. **units.schema.json** - Unit database structure
3. **unit.schema.json** - Individual unit structure

#### Benefits

- Single source of truth (JSON Schema)
- Automatic TypeScript type generation
- Build-time validation
- No manual synchronization needed
- Easy to version control schemas

### 4. Project Structure

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
│   └── main.go
├── web/                       # React web application
│   ├── public/
│   │   └── factions/         # Pre-loaded faction folders
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── types/
│   │   │   └── generated/    # Auto-generated TS types
│   │   ├── hooks/
│   │   ├── services/
│   │   │   ├── faction-loader.ts
│   │   │   └── storage.ts
│   │   ├── utils/
│   │   └── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
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
│       ├── cli-build.yml     # Build Go binaries
│       ├── web-build.yml     # Build web app
│       └── schema-sync.yml   # Validate schema sync
├── README.md
└── PROJECT_PLAN.md           # This file
```

## Implementation Phases

### Phase 1: CLI Foundation ✅ **COMPLETE**

**Status**: ✅ **100% Complete** (as of 2025-11-13)

**Completed Tasks**:
- [x] Restructure output to faction folder format
- [x] Add JSON Schema generation
- [x] Implement mod mode with directory handling
- [x] Refactor CLI commands (extract base, extract mod, validate, generate-schema)
- [x] Update data models for new JSON structure with organized specs
- [x] Implement build tree analysis and accessibility marking
- [x] Add restriction grammar parser
- [x] Implement loader system with mod overlay
- [x] Create faction exporter
- [x] Test with real PA Titans installation

**Delivered**:
- ✅ CLI that generates faction folders (base game + mods)
- ✅ JSON Schema files for all data structures (5 schemas)
- ✅ Working extraction: 207 units parsed, 199 units exported, 123 accessible
- ✅ Faction folder structure with metadata.json and units.json

**Deferred to Later** (not blocking):
- Asset extraction (unit icons/images) - directory structure created
- Faction folder validation command - stub implemented
- Mod zip file handling - currently works with extracted mod directories

### Phase 1.5: CLI Refactoring ✅ **COMPLETE**

**Status**: ✅ **100% Complete** (completed 2025-11-15)

**Reason**: After Phase 1 completion and testing with real mods, new requirements emerged that necessitate architectural changes.

#### Key Insights from Real-World Testing

1. **Factions vs Mods**: We're extracting *factions* (e.g., "Legion"), not individual *mods*
   - A faction may span multiple mods (e.g., legion-server + legion-client)
   - A faction may include modified base game units
   - Users think in terms of "play Legion" not "install these 3 mods"

2. **Multi-Source Unit Definitions**: A single unit can have files in multiple locations
   - Base definition in pa/ (vanilla MLA)
   - Modified in pa_ex1/ (Titans expansion)
   - Further modified in mod1/ (faction mod)
   - Icon in mod2/ (client assets mod)

3. **Unit List Merging**: Each source may have its own `unit_list.json`
   - Mods can add new units
   - Mods can hide existing units
   - Must merge lists while maintaining provenance

4. **File Provenance is Critical**: Users need to know which mod provided which file
   - For debugging mod conflicts
   - For understanding faction composition
   - For verifying mod installation

5. **Multiple Mod Locations**: PA installs mods in different folders
   - server_mods/ (server-side, extracted)
   - client_mods/ (client-side, extracted)
   - download/ (zip files managed by PA)
   - Need to search all with priority

#### Architectural Changes

**Before (Phase 1.0)**:
- Two separate commands: `extract base` and `extract mod`
- Single mod at a time
- Only searched server_mods directory
- Required mods to be extracted
- Output: metadata.json + units.json (full unit data) + empty assets/

**After (Phase 1.5)**:
- Single command: `describe-faction`
- Multiple mods support (`--mod` flag repeatable)
- Searches server_mods, client_mods, download with priority
- Reads zip files directly (no extraction needed)
- Output: metadata.json + units.json (lightweight index) + units/{id}/ (all files)

#### New Command Structure

```bash
# Base game faction (MLA)
pa-pedia describe-faction --name mla \
  --pa-root "C:/PA/media" \
  --output "./factions"

# Custom faction with multiple mods
pa-pedia describe-faction --name "Legion Enhanced" \
  --pa-root "C:/PA/media" \
  --mod com.pa.legion-expansion \
  --mod com.pa.legion-client \
  --output "./factions"
```

#### New Output Structure

```
faction-name/
├── metadata.json          # Faction metadata
├── units.json             # Lightweight index with provenance
└── units/
    ├── tank/
    │   ├── tank.json                    # Primary unit file
    │   ├── tank_tool_weapon.json        # Weapon specs
    │   ├── tank_ammo.json               # Ammo specs
    │   ├── tank_icon_buildbar.png       # Icon (original filename)
    │   └── ... (all discovered files)
    └── ...
```

#### New units.json Format

**Old (Phase 1.0)**: Full unit data in single file (~1.2MB for 199 units)
```json
{
  "units": [
    { "id": "tank", "displayName": "Ant", ...ALL SPECS... }
  ]
}
```

**New (Phase 1.5)**: Lightweight index with file listings (~50KB for 199 units)
```json
{
  "units": [
    {
      "identifier": "tank",
      "displayName": "Ant",
      "unitTypes": ["Mobile", "Tank", "Basic", "Land"],
      "source": "pa",
      "files": [
        { "path": "tank.json", "source": "pa" },
        { "path": "tank_tool_weapon.json", "source": "pa" },
        { "path": "tank_icon_buildbar.png", "source": "pa_ex1" }
      ]
    }
  ]
}
```

#### Implementation Tasks

**Documentation**:
- [x] Update CLAUDE.md with new requirements and patterns
- [x] Update PROJECT_PLAN.md with Phase 1.5 details
- [x] Update README with new command examples

**Loader Enhancements**:
- [x] Add `FindAllMods(paRoot)` - searches server_mods, client_mods, download
- [x] Implement zip file reading (archive/zip, no temp extraction)
- [x] Add `LoadMergedUnitList()` - merges unit lists from all sources
- [x] Add `GetAllFilesForUnit(unitID)` - discovers all files with provenance
- [x] Track `ModSource` (which folder provided each mod)

**Data Models**:
- [x] Create `UnitIndexEntry` model (identifier, displayName, unitTypes, source, files[])
- [x] Create `UnitFile` model (path, source)
- [x] Update `FactionMetadata` to track mods used

**Commands**:
- [x] Create `describe-faction` command (replace extract base/mod)
- [x] Implement `--name` flag (faction name, "mla" for base game)
- [x] Implement repeatable `--mod` flag
- [x] Validate: --mod cannot be used with --name=mla

**Exporter Refactoring**:
- [x] Rewrite exporter for units/ folder structure
- [x] Implement file discovery and copying per unit
- [x] Generate lightweight units.json index
- [x] Implement icon extraction with original filenames
- [x] Apply first-wins priority for file selection
- [x] Track provenance for all files

**Parser Updates**:
- [x] Add source tracking to parser
- [x] Handle merged unit lists
- [x] Track which source defined each unit

**Schema Generation**:
- [x] Generate schemas for new models (UnitIndexEntry, UnitFile)
- [x] Update existing schemas as needed

**Validation**:
- [x] Implement validation command for new structure
- [x] Verify units/ folders match index
- [x] Check file references and provenance

**Testing**:
- [x] Add tests for multi-location mod discovery
- [x] Add tests for zip file reading
- [x] Add tests for unit list merging
- [x] Add tests for file discovery and provenance
- [x] Integration test: base game only
- [x] Integration test: multiple mods with zips
- [x] Integration test: faction with modified base units

#### Priority Decisions (from user requirements)

1. **Zip Handling**: Read directly from zip (no temp extraction)
   - Use Go's archive/zip package
   - Read files on demand
   - No cleanup needed

2. **Mod Priority**: First-in-list wins
   - `--mod A --mod B` means A > B
   - Matches user mental model (primary mod first)
   - Clear, predictable behavior

3. **Icon Extraction**: Implement now with original filenames
   - Extract `{unit-id}_icon_buildbar.png` from all sources
   - Keep original filename (don't rename to "icon.png")
   - Search all sources (may be in different mod than unit JSON)

4. **Provenance Tracking**: Track source for ALL files
   - units.json includes files[] array
   - Each file tagged with source (pa, pa_ex1, or mod identifier)
   - Critical for debugging and transparency

#### Benefits of Refactoring

1. **Better User Experience**:
   - Single command for all scenarios
   - No need to track which mods to install
   - Clearer "faction" concept

2. **Better Performance**:
   - Lightweight index for quick browsing
   - Load full unit data only when needed
   - Smaller initial payload for web app

3. **Better Transparency**:
   - See which mod provided each file
   - Understand faction composition
   - Debug mod conflicts easily

4. **Better Maintainability**:
   - Clearer separation (index vs full data)
   - Easier to update individual units
   - More granular file organization

#### Success Criteria

- ✅ Single `describe-faction` command works for base + mods
- ✅ Discovers mods from server_mods, client_mods, download
- ✅ Reads zip files directly without extraction
- ✅ First-in-list priority working correctly
- ✅ units.json contains lightweight index with provenance
- ✅ units/ folders contain all discovered files
- ✅ Icons extracted with original filenames
- ✅ Validation command verifies output structure
- ✅ Tests passing for all new functionality
- ✅ Documentation updated

**Actual Timeline**: 2 days (2025-11-14 to 2025-11-15)

**Delivered**:
- ✅ Unified `describe-faction` command operational
- ✅ Multi-source mod discovery working (server_mods, client_mods, download)
- ✅ Zip file reading implemented (no temp extraction)
- ✅ File priority system working correctly
- ✅ Lightweight units.json with provenance tracking
- ✅ Resolved unit files with full calculations
- ✅ Icon extraction with original filenames
- ✅ 5 JSON schemas generated
- ✅ MLA and Legion factions successfully exported

### Phase 2: Web App Foundation ✅ **COMPLETE**

**Status**: ✅ **100% Complete** (completed 2025-11-15)

**Tasks**:
- [x] Initialize React + Vite + TypeScript project
- [x] Set up Tailwind CSS with dark mode (CSS variables configured)
- [x] Generate TypeScript types from JSON Schema
- [x] Create faction loading service
- [x] Implement local faction file reading
- [x] Design and implement basic UI layout
- [x] Create faction list page
- [x] Create unit browser page
- [x] Create unit detail page

**Deliverables**:
- ✅ React 19 + TypeScript + Vite project initialized
- ✅ Tailwind CSS v3 with custom PA theme colors (MLA blue/cyan, Legion orange/red)
- ✅ React Router v6 with complete routing
- ✅ Vitest + React Testing Library configured (tests not written yet)
- ✅ Complete TypeScript type definitions for faction data
- ✅ FactionContext with React Context for state management
- ✅ Three-tier lazy loading (metadata → index → units)
- ✅ FactionLoader service with caching
- ✅ Custom hooks: useFactions, useFaction, useUnit
- ✅ ErrorBoundary component
- ✅ Home page (faction selection)
- ✅ FactionDetail page (unit browser with search/filter)
- ✅ UnitDetail page (full unit specifications)
- ✅ Responsive design with mobile support
- ✅ Production build tested (~241 KB bundle, ~76 KB gzipped)

**Implementation Highlights**:
- **Three-tier lazy loading**: Metadata preloaded → indexes on-demand → units on-demand
- **Efficient caching**: All data cached in React Context to avoid redundant fetches
- **Search and filtering**: Real-time search + type-based filtering on FactionDetail page
- **Build relationships**: Clickable links between related units
- **Fallback handling**: Icons fallback gracefully if missing
- **Dark mode ready**: CSS variables configured (toggle UI not yet added)

**Data Source**:
- Faction data loaded from `/public/factions/MLA/` and `/public/factions/Legion/`
- Uses resolved unit files for complete specifications
- Icons displayed from unit folders

**Deferred to Future Phases**:
- Dark mode toggle UI (CSS variables exist, no toggle button)
- Shadcn/ui components (using native HTML + Tailwind instead)
- Tabbed unit detail view (all specs in single scroll view)
- Comprehensive test suite (setup done, tests not written)
- Persistent navigation layout component
- Advanced filtering (tier, cost range)
- Virtualization for large lists
- Faction upload feature
- Unit comparison feature

**Actual Timeline**: 1 day (2025-11-15)

### Phase 3: Advanced Features

**Tasks**:
- [ ] Implement faction upload (zip handling)
- [ ] Add browser storage for uploaded factions
- [ ] Create unit comparison view
- [ ] Implement advanced filtering and search
- [ ] Add unit detail view with full specs
- [ ] Create comparison visualization tools
- [ ] Add export functionality (for comparisons)

**Deliverables**:
- Full-featured web application
- Upload and comparison capabilities
- Rich visualization

### Phase 4: Polish & Distribution

**Tasks**:
- [ ] Add unit tests for CLI
- [ ] Add unit tests for web app
- [ ] Write comprehensive documentation
- [ ] Set up CI/CD pipelines
- [ ] Create release builds for multiple platforms
- [ ] Create demo deployment
- [ ] Performance optimization
- [ ] Accessibility audit

**Deliverables**:
- Production-ready application
- Cross-platform CLI binaries
- Deployed web demo
- Complete documentation

## Technology Decisions

### CLI (Go)

**Dependencies**:
- `github.com/spf13/cobra` - CLI framework
- `github.com/invopop/jsonschema` - Schema generation
- `archive/zip` (stdlib) - Zip file handling
- `encoding/json` (stdlib) - JSON processing
- `image` (stdlib) - Image processing for assets

### Web (TypeScript/React)

**Dependencies**:
- `react` + `react-dom` - UI framework
- `react-router-dom` - Routing
- `zustand` - State management (lightweight)
- `jszip` - Zip file handling in browser
- `tailwindcss` - Styling
- `json-schema-to-typescript` - Type generation (dev)
- `zod` - Runtime validation (optional)

## Future Enhancements (Post-MVP)

- Version tracking and comparison
- Historical unit data across PA updates
- Build order suggestions
- Counter-unit recommendations
- Mod compatibility checking
- Unit stat graphing and trends
- Community ratings and comments
- Server-side faction hosting
- API for programmatic access
- Mobile app (React Native)

## Asset Extraction Plan (Deferred from Phase 1)

### Current State
- Units have `image` field: `"./assets/{unitId}.png"`
- Assets folder created with README.md explaining strategy
- Web UI can use fallback placeholder images

### Implementation Plan

#### Option A: Extract from PA Icon Atlas (Recommended)
PA stores unit icons in icon atlas files that map unit IDs to texture coordinates.

**Steps**:
1. Parse `ui/mods/*/icon_atlas.json` files from PA installation
2. Map unit resource names to icon atlas IDs
3. Extract texture sheets (`.papa` format)
4. Convert PAPA textures to PNG using existing tools/libraries
5. Crop individual unit icons from atlas using coordinates
6. Save as `{unitId}.png` in faction assets folder

**Required**:
- PAPA texture format decoder (several open source options exist)
- Image manipulation library (Go's `image` stdlib + third-party decoders)
- Icon atlas JSON parsing

**Challenges**:
- PAPA format is proprietary but well-documented by PA community
- Some units may not have icons in atlas (use fallback)
- Need to handle multiple icon sizes (strategic icons vs unit icons)

#### Option B: Manual Icon Collection
For initial web app development:
1. Use placeholder images
2. Gradually add real icons manually
3. Community can contribute icon packs

#### Option C: External Icon Database
Use existing PA community databases as fallback:
- Link to external CDN with PA unit icons
- Reference community-maintained icon repositories
- Simpler but requires internet connection

### Recommended Approach

**Phase 2 (Web App)**:
- Use placeholder images initially
- Implement fallback chain: local → placeholder → external
- Web app remains fully functional without icons

**Post-Phase 2**:
- Add CLI command: `pa-pedia extract-assets`
- Implement PAPA texture extraction
- Generate complete icon sets for all factions

### CLI Command Design

```bash
# Extract assets for existing faction folder
pa-pedia extract-assets \
  --faction "./factions/MLA" \
  --pa-root "C:/PA/media" \
  --icon-size 128

# Extract assets during initial extraction
pa-pedia extract base \
  --pa-root "C:/PA/media" \
  --output "./factions" \
  --extract-assets \
  --icon-size 128
```

### Technical Resources

- **PAPA Format**: Community tools exist (raevn's PAPA tools, etc.)
- **Icon Atlas**: `/ui/mods/com.pa.quitch.paperpanzer/ui/mods/com.pa.quitch.paperpanzer.client/icon_atlas.json`
- **Texture Sheets**: Located in PA installation under `/ui/main/atlas/`
- **Go Image Libraries**: Standard library + `golang.org/x/image` for extended formats

## Success Metrics

- CLI generates valid faction folders for all major mods
- Web app loads and displays factions in <1 second
- Schema changes automatically sync between Go and TypeScript
- Users can upload and view custom factions without issues
- Unit comparison provides clear, actionable insights
- Application works offline after initial load

## Questions & Decisions

### Resolved
- **Schema sync**: Use JSON Schema as intermediary format ✓
- **Asset storage**: Relative paths in faction folder ✓
- **Mod handling**: Extract from zip files in mods folder ✓

### Open Questions
1. Should we support PA Classic (non-Titans)? → Decision: No
2. Should we include 3D model previews? → Decision: Future enhancement
3. Should we support faction merging/combining? → TBD
4. Should assets be embedded in JSON or separate files? → Decision: Separate files

## Migration from Old Codebase

**Reusable Components**:
- Core parsing logic from `cli/` folder (already in Go)
- Unit relationship algorithms
- Restriction parsing system

**Not Migrating**:
- Python web interface (complete rewrite in React)
- Configuration file approach (CLI flags instead)
- Titans/non-Titans toggle (Titans only)
- Single JSON file output (faction folder instead)

## Development Timeline (Estimated)

- **Phase 1**: 2-3 weeks (CLI enhancement)
- **Phase 2**: 3-4 weeks (Web app foundation)
- **Phase 3**: 2-3 weeks (Advanced features)
- **Phase 4**: 1-2 weeks (Polish)

**Total**: 8-12 weeks for MVP

## Getting Started

### For CLI Development
```bash
cd cli
go mod tidy
go run main.go extract base --pa-root "C:/PA/media" --output "./output"
```

### For Web Development
```bash
cd web
npm install
npm run dev
```

### Schema Generation
```bash
# In cli folder
go generate ./...

# In web folder
npm run generate-types
```

## Resources

- **Existing CLI Code**: `C:\Users\jamie\Dev\PA\planetary-annihilation-db\cli`
- **PA Game Files**: Typically in `C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media`
- **Server Mods**: `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation\server_mods`
- **JSON Schema Spec**: https://json-schema.org/
- **Go jsonschema lib**: https://github.com/invopop/jsonschema
- **TypeScript generation**: https://www.npmjs.com/package/json-schema-to-typescript
