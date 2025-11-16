# CLAUDE.md

AI assistant context for the PA-Pedia project.

> **For project overview, setup, and FAQs**: See [README.md](README.md)
> **For architecture, roadmap, and current phase status**: See [PROJECT_PLAN.md](PROJECT_PLAN.md)

## Quick Context

PA-Pedia extracts Planetary Annihilation faction data (base game + mods) into portable faction folders. Two-component architecture:
1. **CLI (Go)**: Data extraction tool (Phase 1 & 1.5 - Complete)
2. **Web (React)**: Browsing interface (Phase 2 - Complete)

**Current Phase**: 3 - Advanced Features (Planned)

**Completed**:
- CLI faction extraction with multi-mod support
- Web app with faction/unit browsing
- Three-tier lazy loading system
- Search and filtering functionality

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

**Mod Discovery Locations** (searched in PA data directory):
The CLI auto-detects the PA data directory (or use `--data-root` flag to override):
- Windows: `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation`
- macOS: `~/Library/Application Support/Uber Entertainment/Planetary Annihilation`
- Linux: `~/.local/Uber Entertainment/Planetary Annihilation`

Within this directory, mods are discovered in priority order:
1. `server_mods/{mod-id}/` - User-installed server mods (highest priority)
2. `client_mods/{mod-id}/` - User-installed client mods (medium priority)
3. `download/{mod-id}.zip` - PA-managed zip files (lowest priority)

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

**Three-Tier Lazy Loading**:
1. **App Load** (immediate): All faction metadata from `metadata.json`
2. **Faction View** (on-demand): Unit index from `units.json` when viewing faction
3. **Unit View** (on-demand): Full unit data from `{unit}_resolved.json` when viewing unit

All data cached in FactionContext to avoid redundant fetches.

**Key Functions** (`factionLoader.ts`):
- `discoverFactions()`: Returns list of available faction IDs
- `loadFactionMetadata(id)`: Loads faction metadata
- `loadFactionIndex(id)`: Loads unit index
- `loadUnitResolved(factionId, unitId)`: Loads resolved unit data
- `getUnitIconPath(factionId, unitId, filename)`: Returns icon URL

### Custom Hooks Usage

```typescript
// In a component - access all factions
const { factions, loading, error } = useFactions();

// Access specific faction (auto-loads index)
const { faction, units, loading, error } = useFaction('MLA');

// Access specific unit (auto-loads resolved data)
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

**XSS Prevention (Phase 3 Requirement)**:
- **Current Risk**: Low - data comes from trusted local files only
- **Phase 3 Requirement**: If user-uploaded faction data is implemented, ALL faction data MUST be sanitized before rendering
- **Critical Fields to Sanitize**:
  - Unit names and descriptions
  - Faction metadata (name, description, author)
  - Any user-generated content displayed in UI
- **Implementation Notes**:
  - Use DOMPurify or similar library for HTML sanitization
  - Validate JSON schema compliance before accepting uploads
  - Implement Content Security Policy (CSP) headers
  - Never use `dangerouslySetInnerHTML` without sanitization
- **Location**: Document this requirement in Phase 3 implementation plan

## Common Development Tasks

### Add New Unit Field
1. Update Go struct in `cli/pkg/models/` with JSON tags
2. Update parser in `cli/pkg/parser/unit.go`
3. Regenerate schema (run generate-schema tool)
4. Update TypeScript types in `web/src/types/faction.ts` manually

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

### Debug Web App Issues

**Check browser console**: Most errors appear in browser dev tools console

**Common issues**:
- **404 errors**: Faction data not in `public/factions/` → Copy faction folders
- **Type errors**: TypeScript types out of sync with schemas → Update `types/faction.ts`
- **Infinite re-renders**: Dependency arrays in hooks → Check useEffect dependencies
- **Context not updating**: Missing provider → Ensure FactionProvider wraps app
- **Icons not loading**: Wrong path or missing files → Check console network tab

**Dev tools**:
```bash
# Run dev server with hot reload
npm run dev

# Check TypeScript errors
npm run build

# Lint code
npm run lint
```

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
- Old CLI: `C:\Users\jamie\Dev\PA\planetary-annihilation-db\cli\CLAUDE.md`

**External**:
- JSON Schema: https://json-schema.org/
- Go jsonschema: https://github.com/invopop/jsonschema
- Cobra CLI: https://github.com/spf13/cobra
- React: https://react.dev/
- React Router: https://reactrouter.com/
- Tailwind CSS: https://tailwindcss.com/
- Vite: https://vitejs.dev/
- PA Mod Forum: https://forums.planetaryannihilation.com/forums/mods.93/
