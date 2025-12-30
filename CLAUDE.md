# CLAUDE.md

AI assistant context for the PA-Pedia project.

> **For project overview, setup, and FAQs**: See [README.md](README.md)
> **For architecture, roadmap, and current phase status**: See [PROJECT_PLAN.md](PROJECT_PLAN.md)

## Quick Context

PA-Pedia extracts Planetary Annihilation faction data (base game + mods) into portable faction folders. Two-component architecture:
1. **CLI (Go)**: Data extraction tool (Phase 1 & 1.5 - Complete) - See [cli/CLAUDE.md](cli/CLAUDE.md)
2. **Web (React)**: Browsing interface (Phase 2 - Complete) - See Web App Development section

**Current Phase**: 3 - Advanced Features (Planned)

## Data Models & Output

### Faction Folder Structure
```
faction-name/
├── metadata.json          # Faction info
├── units.json             # Complete unit index with embedded resolved data
└── assets/                # Mirrored PA file structure
    └── pa/
        ├── units/
        │   └── land/
        │       └── tank/
        │           ├── tank.json              # Unit spec
        │           ├── tank_icon_buildbar.png # Unit icon
        │           ├── tank_tool_weapon.json  # Weapon spec
        │           └── tank_ammo.json         # Ammo spec
        ├── ammo/          # Shared ammo files
        └── tools/         # Shared tool files
```

This structure mirrors PA paths, allowing shared resources to be written once and providing a familiar layout for modders.

### Key Data Structures
- **FactionProfile**: Faction identity for CLI extraction (name, unit type, mods)
- **FactionMetadata**: Faction info (name, version, author, mods used)
- **FactionIndex** (`units.json`): Unit index with embedded resolved Unit data
- **UnitIndexEntry**: identifier, displayName, unitTypes, source, files[], unit (embedded)
- **Unit**: Complete parsed specs with all calculations done
- **Weapon**, **Ammo**, **BuildArm**: Tool specifications

See `cli/pkg/models/` for Go structs and `schema/` for JSON schemas.

## Critical Patterns

### 1. Mod Overlay System
A faction may span multiple sources (base game + multiple mods). The CLI uses a **first-wins** priority system where earlier sources override later ones.

**File Priority**: User mods → Expansion (`pa_ex1/`) → Base game (`pa/`)

**Important**: First wins, not last! CLI tracks ALL discovered files with provenance.

For detailed mod discovery locations and CLI-specific implementation, see [cli/CLAUDE.md](cli/CLAUDE.md).

### 2. Unit Identifiers
- Derived from filename: `/pa/units/land/tank/tank.json` → `"tank"`
- Used for folder names in `units/{identifier}/`
- Priority: filename > directory name > directory + suffix

### 3. Icon Naming
- Pattern: `{unit_identifier}_icon_buildbar.png`
- Icon may be in different mod than unit JSON
- Search all sources, keep original filename

### 4. Embedded Resolved Data (Phase 1.5+)
- Resolved unit data is embedded directly in `units.json`
- Each `UnitIndexEntry` contains a complete `Unit` object with:
  - All base_spec inheritance merged
  - DPS calculations complete
  - Net economy rates calculated
  - Build relationships established
  - Accessibility flag set
  - Display names delocalized
- Web app loads all unit data when loading faction index

### 5. Base Spec Inheritance
Units can inherit from templates: `"base_spec": "/pa/units/land/base_vehicle/base_vehicle.json"`

The CLI recursively loads and merges base specs. Web app uses pre-resolved data embedded in the unit index.

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
PA data has inconsistencies (wrong tiers, missing types, inaccessible units) that require manual fixes in the CLI.

See `cli/pkg/parser/database.go:applyCorrections()` for the complete list with reasoning.

### 9. Addon Mod Support
Addon mods extend existing factions by adding new units (e.g., Second Wave adds units to MLA, Legion, and Bugs). They use exclusion-based filtering to identify only NEW units.

**Profile Configuration**:
```json
{
  "displayName": "Second Wave",
  "isAddon": true,
  "mods": ["pa.mla.unit.addon", "pa.mla.unit.addon.companion"],
  "description": "Addon units for MLA, Legion, and Bugs"
}
```

**Note**: The `factionUnitType` field is optional for addon profiles. If specified, it's used only for display/categorization, not for filtering (since addon extraction uses exclusion-based filtering instead).

**How Addon Extraction Works**:
1. Load ALL units from the addon mod sources (no faction type filtering)
2. Load MLA base game units for comparison (hardcoded to Custom58)
3. Filter OUT any addon units whose identifiers exist in the base game
4. Only NEW units remain in the export

This solves a PA modding quirk where addon mods must "shadow" all base game units, which would otherwise cause the export to include hundreds of duplicate units.

**Why MLA is the comparison base**: All PA addon mods shadow MLA units (the base game faction) regardless of which factions they extend. Even addons for Legion or Bugs must shadow MLA units. This is a PA modding constraint, not a limitation of PA-Pedia. If a future addon mod uses a different base, this comparison logic would need updating.

**Auto-Detection**:
- `baseFactions`: Auto-populated from detected unit faction types in the remaining units

**Web UI Display**:
- Addon mods show an "ADDON" badge on faction cards
- "Extends: MLA, Legion, Bugs" displays below the faction name

**Breaking Change (v1.x)**: The `isBalanceMod` field was renamed to `isAddon` in both profiles and metadata. Update any custom profiles or tooling that references the old field name.

## Schema Synchronization

**Process**: Go Structs → JSON Schema → TypeScript Types

**Workflow**:
1. Modify Go structs in `cli/pkg/models/`
2. Generate schemas: `cd cli/tools/generate-schema && ./build-and-run.bat`
3. Generate TypeScript types: `cd web && npm run generate-types`

**Important**: Never edit schemas in `schema/` directory directly - they are generated from Go structs.

For detailed CLI schema generation process, see [cli/CLAUDE.md](cli/CLAUDE.md).

## Web App Development

### Project Structure
```
web/src/
├── components/       # React components
│   └── ErrorBoundary.tsx  # Error boundary wrapper
├── pages/           # Page components
│   ├── Home.tsx          # Faction selection
│   ├── FactionDetail.tsx # Unit browser
│   └── UnitDetail.tsx    # Unit specifications
├── contexts/        # React Context
│   └── FactionContext.tsx  # Global state
├── hooks/           # Custom hooks
│   ├── useFactions.ts  # All factions
│   ├── useFaction.ts   # Single faction
│   └── useUnit.ts      # Single unit
├── services/        # Data loading
│   └── factionLoader.ts  # Fetch functions
└── types/           # TypeScript types
    └── faction.ts   # Data models
```

### Data Loading Strategy

**Two-Tier Lazy Loading**:
1. **App Load** (immediate): All faction metadata from `metadata.json`
2. **Faction View** (on-demand): Complete unit data from `units.json` when viewing faction

All data cached in FactionContext to avoid redundant fetches.

**Key Functions** (`factionLoader.ts`):
- `discoverFactions()`: Returns list of available faction IDs
- `loadFactionMetadata(id)`: Loads faction metadata
- `loadFactionIndex(id)`: Loads unit index with embedded unit data
- `getUnitIconPath(factionId, unitId, filename)`: Returns icon URL

### Custom Hooks Usage

```typescript
// In a component - access all factions
const { factions, loading, error } = useFactions();

// Access specific faction (auto-loads index with embedded unit data)
const { faction, units, loading, error } = useFaction('MLA');

// Access specific unit (data already loaded with faction index)
const { unit, loading, error } = useUnit('MLA', 'tank');
```

### Routing

```
/ → Home (faction selection)
/faction/:factionId → FactionDetail (unit browser)
/faction/:factionId/unit/:unitId → UnitDetail (specifications)
```

### Styling

Tailwind CSS v3 with custom theme:
- **MLA colors**: `mla-blue`, `mla-cyan` (blue/cyan palette)
- **Legion colors**: `legion-orange`, `legion-red` (orange/red palette)
- **Dark mode**: CSS variables configured (`:root` and `.dark` selectors)
- **Responsive**: Mobile-first breakpoints (sm, md, lg, xl)

### Type Safety

TypeScript types in `web/src/types/faction.ts` manually defined from schemas:
- `FactionMetadata`, `FactionIndex`, `UnitIndexEntry`
- `Unit`, `Weapon`, `BuildArm`, `BuildRelationships`
- `CombatSpecs`, `EconomySpecs`, `MobilitySpecs`

**Important**: Schemas in `schema/` are the source of truth. When schemas change, update TypeScript types manually (auto-generation not yet implemented).

### Security Considerations

**XSS Prevention**:
- **Current Risk**: Low - React escapes all rendered strings by default
- **Local Storage Only**: User-uploaded faction data is stored in the browser's IndexedDB and only affects that user's session
- **Why No Sanitization Library**:
  - React's JSX automatically escapes strings, preventing script injection
  - We don't use `dangerouslySetInnerHTML` anywhere
  - Local-only storage means users can only "attack" themselves
- **Future Requirement**: If server-side faction sharing is implemented, add DOMPurify sanitization before storing/displaying shared content
- **Best Practice**: Continue avoiding `dangerouslySetInnerHTML` for user-provided content

## Common Development Tasks

### Add New Unit Field
1. Update Go struct in `cli/pkg/models/` with JSON tags
2. Update parser in `cli/pkg/parser/unit.go`
3. Regenerate schema: `cd cli/tools/generate-schema && ./build-and-run.bat`
4. Update TypeScript types in `web/src/types/faction.ts` manually

### Add New Static Faction
Static factions are shipped with the web app and available to all users. They require two steps to add:

1. **Export faction data** using the CLI:
   ```bash
   pa-pedia describe-faction --name "Faction Name" \
     --pa-root "C:/PA/media" \
     --mod com.pa.example-mod \
     --output "./web/public/factions"
   ```
   This creates `web/public/factions/{FactionName}/` with `metadata.json`, `units.json`, and `assets/`.

2. **Register the faction** in `web/src/services/factionLoader.ts`:
   - Add the faction ID to the static array in `discoverFactions()` function
   - Example: `['MLA', 'Legion', 'Bugs']` → `['MLA', 'Legion', 'Bugs', 'NewFaction']`

**Important**: Adding the folder alone is not enough - the web app discovers static factions from the hardcoded array, not by scanning directories. User-uploaded factions are stored in IndexedDB and discovered dynamically.

For CLI-specific development tasks (debugging parsing, build issues, gotchas), see [cli/CLAUDE.md](cli/CLAUDE.md).

## File Paths (Windows)

**PA Installation**:
- Media: `C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media`
- Data Root: `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation`

For detailed mod locations and CLI-specific paths, see [cli/CLAUDE.md](cli/CLAUDE.md).

**Development**:
- This Project: `C:\Users\jamie\Dev\PA\pa-pedia`

## AI Assistant Guidelines

### Use Specialized Agents
This project has specialized agents configured. Use them proactively:

- **go-expert-developer**: Go implementation, refactoring, debugging, concurrency
- **docs-maintainer**: Update README.md, CLAUDE.md, or PROJECT_PLAN.md after code changes
- **project-planner**: Create/update project plan, break down complex features, track progress
- **git-source-control**: All git operations (commits, branches, PRs)
- **react-ui-developer**: React/TypeScript work
- **cli-design-architect**: CLI UX design decisions
- **ux-design-consultant**: UI/UX design guidance
- **team-lead-architect**: Multi-component features requiring coordination

Use agents when their expertise matches the task. For complex Go work, defer to go-expert-developer. For documentation updates after features, use docs-maintainer. For git operations, use git-source-control.

### When Starting Features
1. Check PROJECT_PLAN.md for current phase and tasks
2. Review relevant patterns in this file
3. Consider schema sync impact
4. Plan for both CLI and web if applicable
5. Use project-planner agent for complex multi-step features

### When Debugging
1. Check which component (CLI or web)
2. Review patterns section above
3. Add verbose logging at problem points
4. Validate against schemas if data-related
5. Use go-expert-developer agent for complex Go debugging

### Code Style
- **Go**: Standard conventions (gofmt, staticcheck clean)
- **TypeScript**: Strict mode, explicit types
- **React**: Functional components with hooks
- **Naming**: kebab-case files, PascalCase components
- **Comments**: Explain "why", not "what"
- **Imports**: Use `@/` alias for absolute imports in web app

### When Adding Dependencies

**CLI (Go)**:
1. Update `go.mod` with required package
2. Document why needed in code or comments
3. Consider binary size impact
4. Verify cross-platform compatibility

**Web (npm)**:
1. Add to `package.json` (use `npm install <pkg>`)
2. Document why needed
3. Check bundle size impact (`npm run build` and check dist/)
4. Verify browser compatibility

## Resources

**Internal**:
- [PROJECT_PLAN.md](PROJECT_PLAN.md) - Architecture and roadmap
- [README.md](README.md) - User-facing docs
- [cli/CLAUDE.md](cli/CLAUDE.md) - CLI-specific development guide

**External**:
- JSON Schema: https://json-schema.org/
- Go jsonschema: https://github.com/invopop/jsonschema
- Cobra CLI: https://github.com/spf13/cobra
- React: https://react.dev/
- React Router: https://reactrouter.com/
- Tailwind CSS: https://tailwindcss.com/
- Vite: https://vitejs.dev/
- PA Mod Forum: https://forums.planetaryannihilation.com/forums/mods.93/
