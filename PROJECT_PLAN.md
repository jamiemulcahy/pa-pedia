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

#### Operation Modes

##### Base Game Mode
```bash
pa-pedia extract base --pa-root "C:/PA/media" --output "./factions"
```

**Behavior**:
- Generates faction folder for base game (Titans expansion assumed)
- Output: `./factions/base-game/`

##### Mod Mode
```bash
pa-pedia extract mod --mod-id "com.pa.legion-expansion" \
  --mods-folder "C:/Users/.../server_mods" \
  --output "./factions"
```

**Behavior**:
- Locates mod in `download/` subfolder by matching identifier
- Extracts mod zip file
- Reads `modinfo.json` for metadata
- Processes mod files with base game override logic
- Output: `./factions/legion-expansion/`

#### Faction Folder Structure

Each faction folder contains:

```
faction-name/
├── metadata.json          # Faction metadata (name, version, author, etc.)
├── units.json             # Complete unit database with specs
└── assets/               # Unit images
    ├── commander.png
    ├── dox.png
    ├── tank.png
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

##### units.json
```json
{
  "units": [
    {
      "id": "tank",
      "resourceName": "/pa/units/land/tank/tank.json",
      "displayName": "Ant",
      "description": "Light Assault Tank - Fast unit that counters most other land units",
      "image": "./assets/tank.png",  // relative path
      "tier": 1,
      "unitTypes": ["Mobile", "Tank", "Basic", "Land"],
      "accessible": true,
      "specs": {
        "combat": {
          "health": 200,
          "dps": 20,
          "weapons": [...]
        },
        "economy": {
          "buildCost": 90,
          "production": {...},
          "consumption": {...}
        },
        "mobility": {
          "moveSpeed": 15,
          "turnSpeed": 720
        },
        "recon": {
          "visionRadius": 100
        }
      },
      "buildRelationships": {
        "builds": [],
        "builtBy": ["vehicle_factory"]
      }
    }
  ]
}
```

#### CLI Commands Structure

```
pa-pedia
├── extract
│   ├── base    # Extract base game faction
│   └── mod     # Extract mod faction
├── validate    # Validate a faction folder
└── version     # Show version info
```

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

**Go side** (generate schema during build):
```go
//go:generate go run ./cmd/generate-schema
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
│   │   ├── root.go
│   │   ├── extract.go
│   │   ├── validate.go
│   │   └── generate-schema/  # Schema generator
│   ├── pkg/
│   │   ├── models/           # Go structs with JSON tags
│   │   ├── parser/           # Unit parsing logic
│   │   ├── exporter/         # Faction folder generation
│   │   ├── assets/           # Asset extraction
│   │   └── validator/        # Faction validation
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

### Phase 1: CLI Foundation (Current State → Enhanced)

**Status**: ~70% complete based on existing code

**Remaining Tasks**:
- [ ] Restructure output to faction folder format
- [ ] Add JSON Schema generation
- [ ] Implement asset extraction (unit icons/images)
- [ ] Add mod mode with zip file handling
- [ ] Refactor CLI commands (extract, validate, etc.)
- [ ] Add faction folder validation
- [ ] Update data models for new JSON structure

**Deliverables**:
- CLI that generates faction folders
- JSON Schema files for all data structures
- Documentation for CLI usage

### Phase 2: Web App Foundation

**Tasks**:
- [ ] Initialize React + Vite + TypeScript project
- [ ] Set up Tailwind CSS with dark mode
- [ ] Generate TypeScript types from JSON Schema
- [ ] Create faction loading service
- [ ] Implement local faction file reading
- [ ] Design and implement basic UI layout
- [ ] Create faction list page
- [ ] Create unit browser page

**Deliverables**:
- Basic web app that loads and displays factions
- Responsive dark mode UI
- Faction and unit browsing

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
