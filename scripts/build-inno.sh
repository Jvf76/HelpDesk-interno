#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$PWD"
: "${UAI_INNO_PAYLOAD:?Set UAI_INNO_PAYLOAD to the verified integrated payload directory}"
: "${UAI_INNO_ISCC:?Set UAI_INNO_ISCC to the official ISCC.exe path}"
: "${UAI_INNO_WINEPREFIX:?Set UAI_INNO_WINEPREFIX to the isolated compiler prefix}"
output="$repo/dist/inno-061"
[[ ! -e "$output/UaiSuporte-Setup-0.6.1-Lab.exe" ]] || { echo "Output exists; refusing overwrite" >&2; exit 1; }
mkdir -p "$output"
"$repo/.tools/dotnet/dotnet" run --project desktop/Setup.Tests -- .tools/lab/exports/uai-lab-ca.cer
"$repo/.tools/dotnet/dotnet" publish desktop/UaiSuporte.Setup -c Release -r win-x64 --self-contained true \
 -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true \
 -p:PayloadDirectory="$UAI_INNO_PAYLOAD" -o "$repo/dist/inno-061-engine"
engine="$repo/dist/inno-061-engine/UaiSuporte.Setup.exe"
engine_hash="$(sha256sum "$engine" | cut -d ' ' -f1)"
export WINEPREFIX="$UAI_INNO_WINEPREFIX" WINEDEBUG=-all
engine_win="$(winepath -w "$engine")"
output_win="$(winepath -w "$output")"
script_win="$(winepath -w "$repo/desktop/installer-inno/UaiSuporte.iss")"
wine "$UAI_INNO_ISCC" "/DEnginePath=$engine_win" "/DEngineHash=$engine_hash" "/DOutputPath=$output_win" "$script_win"
sha256sum "$output/UaiSuporte-Setup-0.6.1-Lab.exe" > "$output/SHA256SUMS.txt"
cat "$output/SHA256SUMS.txt"
