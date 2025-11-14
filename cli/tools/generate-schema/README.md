# Schema Generator

This tool generates JSON Schema files from Go models for the PA-Pedia project.

## Purpose

The generated schemas are used to:
- Document the faction folder data format
- Generate TypeScript types for the web application
- Validate faction folder data (future)

## Usage

### Quick Run (Recommended)

**Windows:**
```bash
.\build-and-run.bat
```

**Unix/Mac:**
```bash
chmod +x build-and-run.sh
./build-and-run.sh
```

### Manual Build and Run

```bash
# Build
go build -o generate-schema .

# Run (Windows)
.\generate-schema.exe --output ../../schema

# Run (Unix/Mac)
./generate-schema --output ../../schema
```

### Options

- `--output <dir>` - Output directory for schema files (default: `./schema`)
- `--verbose` - Enable verbose logging

## Output

Generates the following schema files:
- `faction-metadata.schema.json` - Faction metadata structure
- `faction-database.schema.json` - Complete faction database
- `unit.schema.json` - Individual unit structure
- `weapon.schema.json` - Weapon/tool structure
- `build-arm.schema.json` - Build arm structure

## Integration with Build Process

This tool is intended for development/build processes, not for end users. It should be run:
- During development when models change
- Before releases to ensure schemas are up-to-date
- In CI/CD pipelines to validate schema synchronization
