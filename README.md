# PA-Pedia

[![Deploy to GitHub Pages](https://github.com/jamiemulcahy/pa-pedia/actions/workflows/deploy.yml/badge.svg)](https://github.com/jamiemulcahy/pa-pedia/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern unit database and comparison tool for **Planetary Annihilation: Titans**. Inspired by [planetary-annihilation-db](https://github.com/speth/planetary-annihilation-db) ([palobby.com](https://palobby.com/)).

**[View Live Site →](https://jamiemulcahy.github.io/pa-pedia/faction/MLA)**

PA-Pedia consists of:
- A **static web app** for browsing and comparing faction units
- A **CLI tool** for extracting faction data from PA installations

## Why PA-Pedia?

**100% Static** — The web app is completely static, hosted on GitHub Pages with faction data served directly from this repository. If maintenance stops, anyone can fork and host it themselves.

**Separation of Concerns** — Data extraction (CLI) and display (web) are separate, reducing complexity and making the codebase more approachable for contributors.

**Isolated Faction Data** — Unlike PALobby which requires all factions installed locally, PA-Pedia handles factions independently. Add or update faction data by submitting a PR to `/web/public/factions`.

**Local Import** — Upload exported faction data directly to the site for local viewing. Perfect for mod developers comparing their faction against others during development.

## Quick Start

### CLI Usage

```bash
# Extract base game faction (MLA)
pa-pedia describe-faction --name mla \
  --pa-root "C:/PA/media" \
  --output "./factions"

# Extract custom faction with multiple mods
pa-pedia describe-faction --name "Legion Enhanced" \
  --pa-root "C:/PA/media" \
  --mod com.pa.legion-expansion \
  --mod com.pa.legion-client \
  --output "./factions"
```

### Output Structure

Each faction folder contains:
- `metadata.json` — Faction information (name, version, author, mods)
- `units.json` — Complete unit index with fully resolved unit data
- `assets/` — Unit icons and other assets (mirrored PA file structure)

### Web App Usage

The web app provides a modern interface for browsing faction data.

```bash
# Navigate to web directory
cd web

# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

**Available Factions**: MLA and Legion

**Features**:
- Browse all units in each faction
- Search units by name
- Filter units by type (Tank, Factory, etc.)
- View detailed unit specifications (combat, economy, mobility)
- Navigate build relationships between units
- Responsive design for mobile and desktop

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
- Cached data to avoid redundant requests

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
- Add new faction data to `/web/public/factions`

## Acknowledgments

- [planetary-annihilation-db](https://github.com/speth/planetary-annihilation-db) — The original PA unit database that inspired this project
- [PALobby](https://palobby.com/) — The community resource this builds upon
- The Planetary Annihilation modding community
