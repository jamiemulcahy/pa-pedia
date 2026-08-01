# CLAUDE.md

AI assistant context for the PA-Pedia project.

> **For project overview, setup, and FAQs**: See [README.md](README.md)
> **For architecture, roadmap, and current phase status**: See [PROJECT_PLAN.md](PROJECT_PLAN.md)

## Quick Context

PA-Pedia extracts Planetary Annihilation faction data (base game + mods) into portable faction folders. Two-component architecture:
1. **CLI (Go)**: Data extraction tool (Phase 1 & 1.5 - Complete) - See [cli/CLAUDE.md](cli/CLAUDE.md)
2. **Web (React)**: Browsing interface (Phase 2 - Complete) - See Web App Development section

**Current Phase**: 3 - Advanced Features (Planned)

## Justfile Commands

This project uses [just](https://github.com/casey/just) as a command runner. Run `just` from the repo root to see all available commands.

**Common commands:**
```bash
just                  # List all available commands
just dev              # Run web dev server
just web-build        # Build web app for production
just web-test-run     # Run web tests once
just web-lint         # Run ESLint on web app
just cli-build        # Build CLI binary
just cli-test         # Run CLI tests
just schema-sync      # Full schema sync (Go → JSON Schema → TypeScript)
just test             # Run all tests (CLI + Web)
just build            # Build everything (CLI + Web)
just install          # Install all dependencies
```

**Prefer justfile commands** over raw commands (e.g., use `just dev` instead of `cd web && npm run dev`).

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
2. Run `just schema-sync` to regenerate schemas and TypeScript types

**Individual commands** (if needed):
- `just generate-schema` - Generate JSON schemas from Go structs only
- `just generate-types` - Generate TypeScript types from JSON schemas only

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
│   ├── factionLoader.ts        # Unified interface (dev/prod aware)
│   ├── manifestLoader.ts       # GitHub Releases manifest loading
│   ├── staticFactionCache.ts   # IndexedDB cache for static factions
│   ├── assetUrlManager.ts      # Blob URL management with ref counting
│   ├── zipHandler.ts           # Zip extraction and parsing
│   └── localFactionStorage.ts  # User-uploaded faction storage
└── types/           # TypeScript types
    └── faction.ts   # Data models
```

### Data Loading Strategy

**Development vs Production Mode**:
- **Development** (`just dev`): Loads faction data directly from `/factions/` folder at repo root via Vite plugin. No zips, no manifest, no caching. Uses standard file URLs.
- **Production** (deployed build): Fetches manifest from GitHub Releases, downloads faction zips on-demand, caches in IndexedDB. Uses Blob URLs.

**Two-Tier Lazy Loading**:
1. **App Load** (immediate): All faction metadata from `metadata.json`
2. **Faction View** (on-demand): Complete unit data from `units.json` when viewing faction

**Production Data Flow**:
1. App loads manifest from GitHub Releases (`manifest.json`)
2. User selects faction → downloads faction zip if not cached
3. Extracts zip, stores in IndexedDB with version tracking
4. Subsequent loads serve from IndexedDB cache
5. Version changes invalidate cache and trigger re-download

**Key Services**:
- `manifestLoader.ts`: Loads faction manifest from GitHub Releases with offline fallback
- `staticFactionCache.ts`: IndexedDB caching for faction data with version-aware invalidation
- `assetUrlManager.ts`: Blob URL management with reference counting
- `factionLoader.ts`: Unified interface for loading factions (dev/prod aware)
- `zipHandler.ts`: Zip extraction and parsing

**Key Functions** (`factionLoader.ts`):
- `discoverFactions()`: Returns list of available faction IDs (manifest in prod, hardcoded in dev)
- `loadFactionMetadata(id)`: Loads faction metadata (cached or fresh)
- `loadFactionIndex(id)`: Loads unit index with embedded unit data
- `getUnitIconPath(factionId, unitId, filename)`: Returns icon URL (file URL in dev, Blob URL in prod)

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

**Fonts** are self-hosted via Fontsource, imported at the top of `web/src/index.css`.
Do **not** re-add a `fonts.googleapis.com` link. Hotlinking transmits every visitor's IP
to Google before they interact with the page, with no legal basis under GDPR (LG München I,
3 O 17493/20), and it is also slower: two extra TLS handshakes plus a serial round trip
(stylesheet must load before the font URLs are even discovered). Browser HTTP caches have
been partitioned per top-level site since 2020, so the old "already cached from another
site" argument no longer applies.

Fontsource's variable packages register the family as `"Orbitron Variable"` and
`"JetBrains Mono Variable"` — the `@theme` stack must use those exact names or it silently
falls back. Rajdhani has no variable build and keeps its plain family name.

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

### Privacy (no cookie banner by design)

The site sets **no cookies** and needs no consent banner. That is a property worth
preserving, not an accident:

- **Client-side storage is consent-exempt** — `localStorage` holds only preferences the
  visitor chose, and the IndexedDB stores are caches of data the visitor asked to see.
  Nothing is a cross-site identifier.
- **Cloudflare Web Analytics is cookieless** and Sentry Session Replay is deliberately off
  (see `web/src/lib/monitoring.ts`). Enabling Replay would make the site consent-requiring.
- **No third-party requests during browsing.** Anything that adds one — an embed, a
  hotlinked asset, a CDN script — changes the "no banner" answer and should be raised
  before merging.
- **`web/src/pages/Privacy.tsx`** (`/privacy`, linked from `Footer.tsx`) is the Art. 13
  notice. Its scope is deliberately narrow: what visitor data is processed and who
  receives it, **not** how the site works. Individual storage keys and service
  configuration stay out, so a new cache key needs no change here. The exception is
  recipients — Art. 13(1)(e) requires them, so Cloudflare and Sentry are named and
  `Privacy.test.tsx` asserts it. **Adding a processor means adding it to that page.**

### Monitoring (Sentry + Cloudflare Web Analytics)

Both are free-tier and **inert unless configured** — no DSN means Sentry never initialises,
no beacon token means the analytics script isn't injected. Dev, tests and CI send nothing.

**Files**:
- `web/src/lib/monitoring.ts` - Sentry init, event filtering, `reportError()` helper
- `web/vite.config.ts` - `cloudflareWebAnalytics()` beacon injection + `sentryVitePlugin` sourcemap upload
- `web/src/instrument.ts` - calls `initMonitoring()`; imported first by `main.tsx`
  **before `./App.tsx`**, because App wraps the router at module scope and ESM
  evaluates it first — init any later and the wrapper silently no-ops
- `web/src/main.tsx` - imports `./instrument`, then React 19 root error hooks
- `web/src/App.tsx` - `Sentry.wrapReactRouterRouting(Routes)` for parameterised route names
- `web/src/components/ErrorBoundary.tsx` - reports caught errors with component stack
- `reportError(err, { perVisitor: true })` marks outage-shaped failures, which `filterEvent`
  samples at 10% — use it whenever a failure hits every visitor at once rather than one user
- `web/.env.example` - all variables documented

**Instrumented catch sites**: most failures here are caught and degraded gracefully, so they
never reach a global handler and Sentry cannot see them unless the catch block reports.
`reportError()` is called at the sites where the visitor's experience is actually broken:
- `factionLoader.ts` - manifest load failure (site shows no factions) and local-faction
  load failure (IndexedDB unavailable, reported at `warning` level)
- `modelLoader.ts` - `getFactionModelsIndex` when the manifest promised a bundle that could
  not be read; `UnitModelSection` discards this error by design, so Sentry is the only place
  it surfaces

Deliberately *not* reported: `zipHandler.ts` parse failures (user-uploaded files, already
shown in the UI), the dev-only runtime discovery probe, and offline manifest fetches that
fall back to cache successfully.

**Setup steps and free-tier rationale**: see the Monitoring section in [README.md](README.md).

**Gotchas when touching this code**:
- Use the non-deprecated `reactRouterBrowserTracingIntegration` / `wrapReactRouterRouting`
  (Sentry v10 deprecated the `*V7*`-suffixed names).
- Don't register `onCaughtError` on the React root — `ErrorBoundary` already reports those,
  and both would double-count against the 5k/month quota.
- Keep chunk-load sampling in `filterEvent()`. Without it, one stale-deploy incident
  (see `web/public/_headers`) floods the quota.
- Keep the IndexedDB teardown drop in `filterEvent()`. When the browser force-closes
  the origin's storage, `idb`'s read shortcuts (`db.get`, `db.getAllKeys`) leave their
  `tx.done` rejection unobserved, so it lands as a stackless `AbortError: AbortError`.
  Unactionable, and a duplicate of what `factionLoader`'s catch sites already report.
  It is gated on `isUnhandled()` for exactly that reason: a force-close rejects the
  deliberate `reportError()` path with the same message, and dropping that too would
  leave real storage failures invisible. Don't match on the message alone.
  Our own transactions call `claimTransactionDone()` (`web/src/services/idbTransaction.ts`)
  instead — call it on every new transaction, before the first `await`.
- Sentry's beforeSend logic is pure and unit-tested in `web/src/lib/__tests__/monitoring.test.ts` —
  extend those tests when changing filters.
- Adding new tracked routes? They're derived from the `<Route>` tree automatically; no manual
  pageview calls needed.

### Faction Data Deployment

**GitHub Actions Workflow** (`.github/workflows/faction-data.yml`):

Triggers on:
- Push to `main` branch with changes to `/factions/**` (excluding zips and dist folder)
- Manual workflow dispatch

**Workflow Steps**:
1. Zip each faction folder in `/factions/` (output to `/factions/dist/`)
2. Upload zips to GitHub Releases (tag: `faction-data`, replaces existing assets)
3. Generate `manifest.json` from release assets
4. Upload manifest to same release

**Manifest Structure**:
```json
{
  "generated": "2025-01-04T12:00:00Z",
  "releaseTag": "faction-data",
  "factions": [
    {
      "id": "mla",
      "displayName": "MLA",
      "isAddon": false,
      "latest": {
        "version": "1.0.0",
        "filename": "mla-1.0.0-pedia20250104120000.zip",
        "downloadUrl": "/factions/mla-1.0.0-pedia20250104120000.zip",
        "size": 1234567,
        "timestamp": 20250104120000,
        "build": "124610"
      },
      "versions": [
        {
          "version": "1.0.0",
          "filename": "mla-1.0.0-pedia20250104120000.zip",
          "downloadUrl": "/factions/mla-1.0.0-pedia20250104120000.zip",
          "size": 1234567,
          "timestamp": 20250104120000,
          "build": "124610"
        },
        {
          "version": "0.9.0",
          "filename": "mla-0.9.0-pedia20241215100000.zip",
          "downloadUrl": "/factions/mla-0.9.0-pedia20241215100000.zip",
          "size": 1200000,
          "timestamp": 20241215100000,
          "build": "124500"
        }
      ]
    }
  ]
}
```

**Version History**:
- `latest`: Points to the **most recently extracted** version (newest build timestamp), NOT the highest version number. Upstream mod versions are not guaranteed monotonic (e.g. Exiles went 0.7.10 → 0.7.20 → 0.7.3 → 0.7.4.3), so version-number ordering would crown an old, numerically-largest build. The newest extraction always reflects current upstream. See `scripts/manifest-ordering.ts`.
- `versions`: Array of all available versions, ordered by extraction timestamp (newest first); the UI treats `versions[0]` as latest
- Historical versions are preserved when a faction's version number changes
- Same-version rebuilds (different timestamp, same version) replace older timestamps (dedup keeps the newest timestamp per faction+version); version number is only a tie-breaker for identical timestamps

**Version Tracking**:
- `version`: Extracted from faction `metadata.json` (CLI-generated)
- `timestamp`: Build timestamp in format YYYYMMDDHHmmss
- `build`: PA build number the faction was extracted against
- Web app compares cached version/timestamp to manifest and re-downloads if different

**Cache Invalidation**:
- Version or timestamp mismatch → delete cached faction → download fresh zip
- Factions removed from manifest → pruned from IndexedDB cache
- Manifest cached in IndexedDB for offline mode

### Automated Faction Updates

**GitHub Actions Workflow** (`.github/workflows/update-factions.yml`):

Automatically detects upstream mod changes and creates PRs with updated faction data.

**Triggers**:
- Daily cron at 6am UTC
- Manual `workflow_dispatch` (with optional profile filter)

**How it works**:
1. Downloads encrypted PA base game data from `pa-base-data` GitHub Release
2. Decrypts using `PA_BASE_DATA_KEY` secret
3. Builds CLI from source
4. Runs MLA golden test (compares generated MLA data against committed version)
5. Regenerates all faction data using embedded profiles
6. Creates a PR if any faction data changed

**MLA Golden Test**: Before processing mod factions, the workflow regenerates MLA (base game only) and compares against the committed version. If they differ, the base data cache is stale and the workflow fails with instructions to update.

**Required GitHub Secrets**:
- `PA_BASE_DATA_KEY`: Symmetric encryption key for the base data archive

**Updating the base data cache** (when PA Titans patches or golden test fails):
```bash
# 1. Set encryption key (same as the GitHub secret)
export PA_BASE_DATA_KEY="your-key-here"

# 2. Extract and encrypt base data from local PA install
just extract-base-data

# 3. Upload to GitHub Release
just upload-base-data
```

The base data is stored as an encrypted release asset on the `pa-base-data` tag. Only the CI pipeline can decrypt it.

**Note**: The base data archive includes unit `.papa` model/texture files (under `units/`) so the Faction Models workflow can generate 3D models in CI. This makes the archive larger (~180 MB) — re-run `just extract-base-data` + `just upload-base-data` after any change to the extractor's include rules.

### 3D Model Generation

**GitHub Actions Workflow** (`.github/workflows/faction-models.yml`):

Runs **automatically** after `Faction Data Release` (via `workflow_run`), regenerating only the factions whose data changed in that commit. Also dispatchable manually (`workflow_dispatch`, optional profile filter; empty = all).

**Why chained rather than a second `push` trigger**: both workflows finish by regenerating and uploading `manifest.json`. Running them concurrently on the same push risks the data release overwriting the manifest that records the bundle this run just published. Chaining makes model generation run last.

**Cost** (measured): ~1 second per unit, plus ~1.5 minutes of fixed setup. A single faction is ~3 minutes; all six is ~12. Actions minutes are free and unmetered on this public repo, so the scoping is about wall-clock and release-asset churn, not billing.

**How it works**:
1. `plan` job resolves which profiles to regenerate — faction folders touched by the release commit, mapped to profile IDs via each folder's `metadata.json` `identifier`. No faction change ⇒ empty list ⇒ the heavy job is skipped.
2. Downloads + decrypts the `pa-base-data` archive (must include unit `.papa` — see note above)
3. Installs pinned headless Blender (`BLENDER_VERSION`, 5.1.x validated), restored from `actions/cache` when available
4. Builds the CLI, runs `extract-models` per profile → `models/{Faction}/`
5. `build-model-bundles` zips them → `models/dist/{id}-{version}-pedia{ts}-models.zip`, plus a small `-models.index.json` sidecar
6. Uploads bundles + sidecars to the **`faction-models`** release (separate from `faction-data`)
7. Regenerates the manifest so version entries gain their `models` field
8. Completing triggers **Deploy to Cloudflare Pages**, which is what actually makes the button appear → see below

**Why a deploy is required**: the deploy bakes `manifest.json` into `web/dist/factions/` and the site reads that static copy, *not* the release. Model generation finishes after the data-release deploy has already baked the older manifest, so `deploy.yml` lists **both** `Faction Data Release` and `Faction Models` in its `workflow_run` trigger. Drop the second one and bundles will exist on the release but stay invisible until an unrelated push redeploys.

**Bundle ↔ version correlation** (`scripts/model-bundles.ts`):

A version entry gets a `models` bundle only when one was built from **that exact version**, and the manifest never approximates — serving a neighbouring version's bundle would misrepresent what a unit currently looks like.

Automatic regeneration is what makes that strictness affordable: every faction update rebuilds that faction's bundle, so a new version arrives with its own models within a few minutes rather than waiting for someone to dispatch the workflow. It also closes a subtler hole — upstream mods sometimes ship changed data *without* bumping their version (see `update-factions.yml`), and matching on version alone would have handed the new data an older bundle with no signal. Always rebuilding means a bundle can never be inherited by data it wasn't built from.

Drift is now bounded by how quickly the workflow runs, not by how often someone remembers to. A version can still legitimately show no models: if its generation run failed, that version has no bundle until the next update or a manual dispatch.

Older versions are unaffected: each entry is matched independently, so Exiles 0.7.4.6 keeps its bundle and its working viewer however far latest has moved on. This is also why `upload-model-bundles` never deletes old bundles.

**Local generation** (needs a PA install + Blender 5.1.x on PATH):
```bash
just generate-models        # extract-models for all profiles → ./models
just build-model-bundles    # zip → ./models/dist
# then publish: npm --prefix scripts run upload:model-bundles && npm --prefix scripts run generate:manifest
```

The feature is invisible until model bundles exist on the `faction-models` release — merging the web/CLI code alone does not show 3D buttons.

## Common Development Tasks

### Add New Unit Field
1. Update Go struct in `cli/pkg/models/` with JSON tags
2. Update parser in `cli/pkg/parser/unit.go`
3. Run `just schema-sync` to regenerate schemas and TypeScript types
4. Update TypeScript types in `web/src/types/faction.ts` manually (if needed)

### Add New Static Faction
Static factions are served from GitHub Releases and available to all users. To add a new faction:

1. **Export faction data** using the CLI:
   ```bash
   pa-pedia describe-faction --name "Faction Name" \
     --pa-root "C:/PA/media" \
     --mod com.pa.example-mod \
     --output "./factions"
   ```
   This creates `factions/{FactionName}/` with `metadata.json`, `units.json`, and `assets/`.

2. **Commit and push** to the `main` branch:
   ```bash
   git add factions/{FactionName}
   git commit -m "Add Faction Name faction"
   git push
   ```

3. **Automated workflow** runs on push:
   - Zips each faction folder in `/factions/`
   - Uploads zips to GitHub Releases (tag: `faction-data`)
   - Generates `manifest.json` with faction metadata and download URLs
   - Web app discovers factions from manifest automatically

**Development Mode**: During local development, factions are loaded directly from `/factions/` folder without zipping or manifest. Add factions to `/factions/` and they appear immediately in dev server.

**Production Mode**: Deployed app fetches manifest from GitHub Releases, downloads faction zips on-demand, and caches in IndexedDB.

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
1. Update `go.mod` with required package (or `cd cli && go get <pkg>`)
2. Document why needed in code or comments
3. Consider binary size impact
4. Verify cross-platform compatibility

**Web (npm)**:
1. Add to `package.json` (`cd web && npm install <pkg>`)
2. Document why needed
3. Check bundle size impact (`just web-build` and check `web/dist/`)
4. Verify browser compatibility

## Resources

**Internal**:
- [justfile](justfile) - Command runner with all common commands
- [PROJECT_PLAN.md](PROJECT_PLAN.md) - Architecture and roadmap
- [README.md](README.md) - User-facing docs
- [cli/CLAUDE.md](cli/CLAUDE.md) - CLI-specific development guide

**External**:
- Just (command runner): https://github.com/casey/just
- JSON Schema: https://json-schema.org/
- Go jsonschema: https://github.com/invopop/jsonschema
- Cobra CLI: https://github.com/spf13/cobra
- React: https://react.dev/
- React Router: https://reactrouter.com/
- Tailwind CSS: https://tailwindcss.com/
- Vite: https://vitejs.dev/
- PA Mod Forum: https://forums.planetaryannihilation.com/forums/mods.93/
