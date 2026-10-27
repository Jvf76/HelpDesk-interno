#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mvn -f backend/pom.xml test
npm --prefix frontend ci
npm --prefix frontend run build
dotnet build agent/UaiSuporte.Agent -c Release
