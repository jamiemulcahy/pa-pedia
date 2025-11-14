#!/bin/bash
# Build and run schema generator for Unix systems
set -e

echo "Building schema generator..."
cd "$(dirname "$0")"
go build -o generate-schema .

echo "Running schema generator..."
./generate-schema --output ../../schema "$@"
