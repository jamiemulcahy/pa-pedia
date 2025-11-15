# PA-Pedia

A modern CLI tool and web application for exploring, comparing, and analyzing Planetary Annihilation faction units.

## Overview

PA-Pedia extracts unit data from Planetary Annihilation: Titans installations (including mods) and generates portable faction folders that can be viewed in a web interface.

### Components

1. **CLI Tool (Go)**: Extract faction data from PA installations
2. **Web App (React)**: Browse and compare factions (planned)

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
- `metadata.json` - Faction information
- `units.json` - Lightweight unit index with file listings
- `units/` - Individual unit folders with all discovered files

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

**Current Phase**: Phase 1.5 - CLI Refactoring (In Progress)

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

### Web Development (planned)
```bash
cd web
npm install
npm run dev
```

## PA Installation Paths

**Windows**:
- Game Files: `C:\Program Files (x86)\Steam\steamapps\common\Planetary Annihilation Titans\media`
- Mods: `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation\`
  - `server_mods/` - Server-side mods (extracted)
  - `client_mods/` - Client-side mods (extracted)
  - `download/` - Downloaded mods (zip files)

## License

[Your License Here]

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
