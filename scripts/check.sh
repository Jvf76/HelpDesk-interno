#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mvn -f backend/pom.xml test
npm --prefix frontend ci
npm --prefix frontend run build
dotnet build desktop/UaiSuporte.App -c Release
dotnet run --project desktop/Transport.Tests
dotnet run --project desktop/Setup.Tests

dotnet run --project desktop/Monitoring.Tests
npm --prefix frontend run test:e2e
npm --prefix infra/mesh test
