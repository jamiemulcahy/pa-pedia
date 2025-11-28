# Contributing to PA-Pedia

Thanks for your interest in contributing to PA-Pedia!

## Ways to Contribute

### Add Faction Data

The easiest way to contribute is to add new faction data:

1. Use the CLI to extract faction data from your PA installation
2. Submit a PR adding the faction folder to `/web/public/factions`

### Report Issues

Found a bug or have a feature request? [Open an issue](https://github.com/jamiemulcahy/pa-pedia/issues/new).

Please include:
- What you expected to happen
- What actually happened
- Steps to reproduce (if applicable)
- Screenshots (if applicable)

### Submit Code Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests to ensure nothing is broken
   - CLI: `cd cli && go test ./...`
   - Web: `cd web && npm run lint && npm run build`
5. Commit your changes with a descriptive message
6. Push to your fork and submit a pull request

## Development Setup

### CLI (Go)

```bash
cd cli
go build -o pa-pedia.exe
go test ./...
```

### Web App (React/TypeScript)

```bash
cd web
npm install
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Run linter
```

### Schema Generation

If you modify Go structs in `cli/pkg/models/`, regenerate the JSON schemas:

```bash
# Generate schemas from Go structs
cd cli/tools/generate-schema
./build-and-run.bat  # Windows
./build-and-run.sh   # Unix/Mac

# Update TypeScript types (manual step)
# Edit web/src/types/faction.ts to match schema changes
```

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what and why
- Ensure tests pass and linting is clean
- Update documentation if adding new features

## Code Style

- **Go**: Follow standard Go conventions (`gofmt`, `go vet`)
- **TypeScript**: ESLint rules are configured in the project
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) format
  - `feat:` new feature
  - `fix:` bug fix
  - `docs:` documentation changes
  - `chore:` maintenance tasks

## Questions?

Feel free to open an issue if you have questions about contributing.
