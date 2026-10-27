#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$PWD"
export DOTNET_ROOT="${DOTNET_ROOT:-$repo/.tools/dotnet}"
dotnet_bin="$DOTNET_ROOT/dotnet"
(cd frontend && npm ci && npm run build)
mkdir -p dist
stage="$(mktemp -d "$repo/dist/technician-build-XXXXXX")"
"$dotnet_bin" publish desktop/UaiSuporte.Technician -c Release -r win-x64 --self-contained true -p:RestoreLockedMode=true -o "$stage"
cp docs/09-tecnico-desktop.md "$stage/LEIA-ME.md"
mkdir -p "$stage/licenses"
sdk="${NUGET_PACKAGES:-$HOME/.nuget/packages}/microsoft.web.webview2/1.0.4314.35"
cp "$sdk/LICENSE.txt" "$stage/licenses/WebView2-LICENSE.txt"
cp "$sdk/NOTICE.txt" "$stage/licenses/WebView2-NOTICE.txt"
for package in react react-dom scheduler lucide-react; do
 cp "frontend/node_modules/$package/LICENSE" "$stage/licenses/$package-LICENSE.txt"
done
python3 - "$stage" <<'PY'
import pathlib,sys,zipfile
stage=pathlib.Path(sys.argv[1])
with zipfile.ZipFile('dist/uai-suporte-tecnico-0.2.0-win-x64.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(stage.rglob('*')):
  if p.is_file(): z.write(p,p.relative_to(stage))
PY
sha256sum dist/uai-suporte-tecnico-0.2.0-win-x64.zip
printf '%s\n' 'Laboratorio SEM assinatura Authenticode; .NET incluido; WebView2 Runtime necessario.'
