# PA-Pedia Justfile
# Run `just` to see available commands

# Use PowerShell on Windows
set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]

# Default recipe - list available commands
default:
    @just --list

# ============================================================================
# Web App Commands
# ============================================================================

# Run web dev server
[working-directory: 'web']
web-dev:
    npm run dev

# Build web app for production
[working-directory: 'web']
web-build:
    npm run build

# Preview production build locally
[working-directory: 'web']
web-preview:
    npm run preview

# Run ESLint on web app
[working-directory: 'web']
web-lint:
    npm run lint

# Run web tests in watch mode
[working-directory: 'web']
web-test:
    npm run test

# Run web tests once
[working-directory: 'web']
web-test-run:
    npm run test:run

# Run web tests with UI
[working-directory: 'web']
web-test-ui:
    npm run test:ui

# Run web tests with coverage
[working-directory: 'web']
web-test-coverage:
    npm run test:coverage

# Install web dependencies
[working-directory: 'web']
web-install:
    npm install

# ============================================================================
# CLI Commands
# ============================================================================

# Build CLI binary
[working-directory: 'cli']
cli-build:
    go build -o pa-pedia.exe .

# Build CLI with race detection (for development)
[working-directory: 'cli']
cli-build-race:
    go build -race -o pa-pedia.exe .

# Run CLI tests
[working-directory: 'cli']
cli-test:
    go test ./...

# Run CLI tests with verbose output
[working-directory: 'cli']
cli-test-verbose:
    go test -v ./...

# Run CLI tests with coverage
[working-directory: 'cli']
cli-test-coverage:
    go test -coverprofile=coverage.out ./...; go tool cover -html=coverage.out

# List available faction profiles
[working-directory: 'cli']
cli-list-profiles:
    go run . describe-faction --list-profiles

# ============================================================================
# Schema Generation
# ============================================================================

# Generate JSON schemas from Go structs
[working-directory: 'cli/tools/generate-schema']
generate-schema:
    go build -o generate-schema.exe .; ./generate-schema.exe --output ../../../schema

# Generate TypeScript types from JSON schemas
[working-directory: 'web']
generate-types:
    npm run generate-types

# Full schema sync: Go structs -> JSON Schema -> TypeScript types
schema-sync: generate-schema generate-types

# ============================================================================
# Development Workflow
# ============================================================================

# Install all dependencies (web + ensure CLI modules)
[working-directory: 'cli']
install: web-install
    go mod download

# Run all tests (CLI + Web)
test: cli-test web-test-run

# Run all linters
[working-directory: 'cli']
lint: web-lint
    go vet ./...

# Build everything (CLI + Web)
build: cli-build web-build

# Generate sitemap for web app
[working-directory: 'web']
generate-sitemap:
    npm run generate-sitemap

# ============================================================================
# Shortcuts / Aliases
# ============================================================================

# Alias: Run web dev server
dev: web-dev

# Alias: Build CLI
build-cli: cli-build
