# PA-Pedia

[![Deploy to GitHub Pages](https://github.com/jamiemulcahy/pa-pedia/actions/workflows/deploy.yml/badge.svg)](https://github.com/jamiemulcahy/pa-pedia/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern unit database and comparison tool for **Planetary Annihilation: Titans**. Inspired by [planetary-annihilation-db](https://github.com/speth/planetary-annihilation-db) ([palobby.com](https://palobby.com/)).

**[View Live Site →](https://jamiemulcahy.github.io/pa-pedia)**

PA-Pedia consists of:
- A **static web app** for browsing and comparing faction units
- A **CLI tool** for extracting faction data from PA installations

## Why PA-Pedia?

**100% Static** — The web app is completely static, hosted on GitHub Pages with faction data served from GitHub Releases. If maintenance stops, anyone can fork and host it themselves.

**Separation of Concerns** — Data extraction (CLI) and display (web) are separate, reducing complexity and making the codebase more approachable for contributors.

**Isolated Faction Data** — Unlike PALobby which requires all factions installed locally, PA-Pedia handles factions independently. Faction data is downloaded on-demand and cached locally.

**Local Import** — Upload exported faction data directly to the site for local viewing. Perfect for mod developers comparing their faction against others during development.

## Architecture

**Faction Data Delivery**:
- **Production**: Faction data served from GitHub Releases
  - Manifest-driven discovery of available factions
  - On-demand zip downloads with browser caching (IndexedDB)
  - Version-aware cache invalidation for automatic updates
  - Offline support for previously loaded factions
- **Development**: Faction data loaded directly from `/factions/` folder
  - No zipping or manifest required
  - Instant updates when faction data changes
  - Served via Vite dev server

**Automated Deployment**:
When faction data is added or updated in `/factions/` and pushed to `main`:
1. GitHub Actions zips each faction folder
2. Uploads zips to GitHub Releases (tag: `faction-data`)
3. Generates manifest.json with faction metadata and download URLs
4. Web app automatically discovers new/updated factions via manifest

See [CLAUDE.md](CLAUDE.md) for detailed technical documentation.

## Quick Start

### CLI Usage

```bash
# Extract base game faction (MLA)
pa-pedia describe-faction --profile mla \
  --pa-root "C:/PA/media" \
  --output "./factions"

# Extract custom faction with local mods
pa-pedia describe-faction --name "Legion Enhanced" \
  --pa-root "C:/PA/media" \
  --mod com.pa.legion-expansion \
  --mod com.pa.legion-client \
  --data-root "%LOCALAPPDATA%/Uber Entertainment/Planetary Annihilation" \
  --output "./factions"
```

#### Using GitHub Repositories

The `--mod` flag accepts both local mod IDs and GitHub URLs:

```bash
# Use a GitHub repo directly as mod source
pa-pedia describe-faction --profile mla \
  --mod "github.com/NiklasKroworsch/Exiles" \
  --pa-root "C:/PA/media"

# Specify a specific branch or tag
pa-pedia describe-faction --profile mla \
  --mod "github.com/user/repo/tree/v2.0" \
  --pa-root "C:/PA/media"
```

### Output Structure

Each faction folder contains:
- `metadata.json` — Faction information (name, version, author, mods)
- `units.json` — Complete unit index with fully resolved unit data
- `assets/` — Unit icons and other assets (mirrored PA file structure)

### Web App Usage

The web app provides a modern interface for browsing faction data.

**Production Deployment**: The live site at [jamiemulcahy.github.io/pa-pedia](https://jamiemulcahy.github.io/pa-pedia) loads faction data from GitHub Releases. Factions are downloaded on-demand and cached in your browser for offline use.

**Local Development**:
```bash
# Navigate to web directory
cd web

# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

In development mode, faction data loads directly from the `/factions/` folder at the repository root.

**Available Factions**: MLA, Legion, and Bugs

**Features**:
- Browse all units in each faction
- Search units by name
- Filter units by type (Tank, Factory, etc.)
- View detailed unit specifications (combat, economy, mobility)
- Navigate build relationships between units
- Responsive design for mobile and desktop
- Offline support (cached factions available without internet)

#### Production Build

```bash
# Build optimized production bundle
cd web
npm run build

# Preview production build
npm run preview
```

Production build is highly optimized:
- Bundle size: ~241 KB (~76 KB gzipped)
- CSS size: ~10 KB (~3 KB gzipped)
- Three-tier lazy loading for fast initial load
- On-demand faction downloads from GitHub Releases
- IndexedDB caching with version-aware invalidation
- Offline support for previously viewed factions

## Installation

### From Binary

Download the latest release for your platform from the releases page.

### From Source

```bash
cd cli
go build -o pa-pedia.exe
```

## Schema Generation

The project uses JSON schemas to keep Go and TypeScript types synchronized:

```bash
# Generate schemas from Go structs
cd cli/tools/generate-schema
./build-and-run.bat  # Windows
./build-and-run.sh   # Unix/Mac

# Generate TypeScript types (web app)
cd web
npm run generate-types
```

## Project Status

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for detailed roadmap and current phase status.

**Completed Phases**:
- Phase 1: CLI Foundation (100% Complete)
- Phase 1.5: CLI Refactoring (100% Complete)
- Phase 2: Web App Foundation (100% Complete)

**Current Phase**: Phase 3 - Advanced Features (Planned)

## FAQ

### Why separate CLI and web?
Clear separation of concerns. CLI extracts data, web displays it. Power users can script the CLI, casual users use the web interface.

### Why Go for the CLI?
Single binary with no runtime dependencies. Easy for non-developers. Fast, cross-platform, strong stdlib.

### Why faction folders instead of single JSON?
Easier to update incrementally, better separation of concerns, can be versioned and zipped for sharing.

### Does this work with PA Classic?
No, Titans only. PA Classic is legacy and not widely used.

### Can users share faction folders?
Yes! Zip the folder and share it. Recipients can upload to the web app.

## Development

See [CLAUDE.md](CLAUDE.md) for AI assistant context and [PROJECT_PLAN.md](PROJECT_PLAN.md) for detailed architecture.

### CLI Development
```bash
cd cli
go run main.go describe-faction --name test --pa-root "C:/PA/media" --output "./output"
go test ./...
```

### Web Development
```bash
cd web
npm install
npm run dev  # Starts dev server at http://localhost:5173
npm run build  # Production build
npm run preview  # Preview production build
npm run lint  # Run ESLint
```

## Monitoring

The deployed site reports errors to [Sentry](https://sentry.io) and traffic to
[Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/). Both run on free
tiers, and both are **off unless configured** — local dev, CI builds and forks send
nothing.

Configuration is entirely through environment variables (see [`web/.env.example`](web/.env.example));
production values live in GitHub Actions secrets and are injected by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### One-time setup

**Cloudflare Web Analytics** (page views, referrers, countries, devices):

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site** → `pa-pedia.com`.
2. Copy the 32-character site token from **Manage site**.
3. Add it as the repository secret `CF_BEACON_TOKEN`.

The beacon is injected into `index.html` at build time with `spa: true`, so React Router
navigations are counted, not just the first page load. It is cookieless and stores no
personal data.

> Cloudflare Pages also offers a one-click Web Analytics toggle in the dashboard. Don't
> enable both — you'll double-count every view. The build-time injection is used here
> because it pins the SPA setting and survives a move off Pages.

**Sentry** (JavaScript errors with stack traces):

1. Create a Sentry project of type **React**, then copy its DSN.
2. Add the repository secrets:
   - `SENTRY_DSN` — the project DSN, from **Settings → Projects → [project] → Client Keys (DSN)**
   - `SENTRY_ORG` — your org slug (visible in the dashboard URL)
   - `SENTRY_PROJECT` — the project slug (also in the dashboard URL)
   - `SENTRY_AUTH_TOKEN` — an **organization** auth token with `project:releases` scope,
     from **Settings → Auth Tokens**. Used for sourcemap upload.

All three of `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` are required for
sourcemap upload — the Vite plugin checks for the org itself, so it is needed even though
an organization auth token already embeds it. Setting some but not all makes the build warn
and skip the upload rather than fail.

**EU-region orgs**: if your DSN contains `.de.` (e.g. `o123.ingest.de.sentry.io`), also add
`SENTRY_URL=https://de.sentry.io`. The bundler plugin hardcodes the US endpoint when this is
unset, so every upload fails against an EU org.

`SENTRY_DSN` and `CF_BEACON_TOKEN` are public values that ship in the client bundle; they
are stored as secrets only so forks don't report into this project. `SENTRY_AUTH_TOKEN` is
a real secret and is used at build time only.

### Free-tier guardrails

The Sentry free tier allows 5,000 errors/month, so the setup in
[`web/src/lib/monitoring.ts`](web/src/lib/monitoring.ts) deliberately limits what is sent:

- **Chunk-load errors are sampled at 5%** and collapsed into a single issue. A deploy that
  strands users on a deleted bundle (see the comments in `web/public/_headers`) can throw
  thousands of these — enough to burn the monthly quota in an afternoon. Sampling keeps the
  signal without the flood.
- **Browser-extension and `ResizeObserver` noise is dropped** — never actionable.
- **Tracing is sampled at 10%** (`VITE_SENTRY_TRACES_SAMPLE_RATE`), since spans share the
  free-tier quota with errors.
- **Session Replay is not enabled.** The free tier includes 50 replays/month and the
  integration roughly doubles the SDK's bundle cost. Add `Sentry.replayIntegration()` in
  `monitoring.ts` if that trade changes.
- **`sendDefaultPii` is off**, so visitor IPs and headers are never attached.

Sourcemaps are generated only when `SENTRY_AUTH_TOKEN` is set, uploaded to Sentry, then
deleted from `dist/` so they are never served publicly. If the upload fails the build still
succeeds — that release just gets minified stack traces — and the deploy workflow strips any
maps left behind.

## PA Installation Paths

**Windows**:
- Game Files: `C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media`
- Mods: `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation\`
  - `server_mods/` - Server-side mods (extracted)
  - `client_mods/` - Client-side mods (extracted)
  - `download/` - Downloaded mods (zip files)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Quick ways to help:
- Open issues for bugs or feature requests
- Submit pull requests with improvements
- Add new static faction data:
  1. Export faction data using CLI: `pa-pedia describe-faction --output "./factions"`
  2. Commit and push to `main` branch
  3. GitHub Actions workflow automatically zips, uploads to Releases, and generates manifest
  4. Web app discovers new faction automatically from manifest

## Acknowledgments

- [planetary-annihilation-db](https://github.com/speth/planetary-annihilation-db) — The original PA unit database that inspired this project
- [PALobby](https://palobby.com/) — The community resource this builds upon
- The Planetary Annihilation modding community
