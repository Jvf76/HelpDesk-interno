#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$PWD"
dotnet_bin="${DOTNET_ROOT:-$repo/.tools/dotnet}/dotnet"
mkdir -p dist
if [[ -e dist/UaiSuporte-Setup-0.6.1-Lab.exe ]]; then echo "Artifact exists; use a new version or an explicit review before rebuilding." >&2; exit 1; fi
stage="$(mktemp -d "$repo/dist/setup-061-XXXXXX")"
(cd frontend && npm ci && npm run build)
"$dotnet_bin" publish desktop/UaiSuporte.App -c Release -r win-x64 --self-contained true -o "$stage/app"
python3 - "$stage" <<'PY'
import pathlib, sys, zipfile, shutil, hashlib, json, os
stage=pathlib.Path(sys.argv[1]); (stage/'payload').mkdir()
deps=pathlib.Path('.tools/setup-deps')
mesh=pathlib.Path('.tools/mesh-audit/MeshService64-Uai-LAB.exe')
provenance=json.loads(pathlib.Path('infra/mesh/agent-provenance.json').read_text())['labCandidate']
assert provenance['windowsTrustValidation']=='EXPLORER_SIGNATURE_AND_CHAIN_VALID_USER_REPORTED'
assert provenance['approvedForInstallation'] is True and provenance['approvalScope'].startswith('LAB_0.5_')
assert hashlib.sha256(mesh.read_bytes()).hexdigest()==provenance['sha256']=='4cb9aab0e6f9d90249f29bf15e46e66c702a282bc9f991bbb9b6ef0b78478019'
shutil.copy(mesh,stage/'payload/meshagent.exe')
runtime=deps/'webview2-fixed/Microsoft.WebView2.FixedVersionRuntime.156.0.4314.50.x64'
runtime_proof=json.loads(pathlib.Path('desktop/webview2-fixed-provenance.json').read_text())
assert hashlib.sha256((deps/'webview2-fixed-x64.cab').read_bytes()).hexdigest()==runtime_proof['cabSha256']
assert hashlib.sha256((runtime/'msedgewebview2.exe').read_bytes()).hexdigest()==runtime_proof['executableSha256']
ca=pathlib.Path('.tools/lab/exports/uai-lab-ca.cer')
assert hashlib.sha256(ca.read_bytes()).hexdigest()=='a1ffb98eb2364bb6ef0b30f5fd5ae61f1689fffba1ca6f1510641ead624d7138'
shutil.copy(ca,stage/'payload/lab-ca.cer')
shutil.copy(deps/'webview2-license.txt',stage/'payload/webview2-license.txt')
(stage/'payload/dependencies.json').write_text(json.dumps(dict(webview2Fixed=runtime_proof,receivingValidated=False,meshAgentIncluded=True,meshAgentSha256=provenance['sha256'],meshAgentPublisher=provenance['publisher'],version='0.6.1')))
for profile in ['app']:
    root=stage/profile
    shutil.copytree(runtime,root/'Runtime',copy_function=os.link)
    entries={str(file.relative_to(runtime)).replace('\\','/'):hashlib.sha256(file.read_bytes()).hexdigest() for file in runtime.rglob('*') if file.is_file()}
    assert entries==json.loads(pathlib.Path('desktop/webview2-fixed-files.json').read_text()), 'Runtime files differ from verified CAB extraction'
    (root/'runtime-files.json').write_text(json.dumps(entries,indent=2))
    shutil.copy('docs/17-cadastro-integrado-lab.md',root/'INSTALACAO.md')
    shutil.copy('docs/18-assistente-windows.md',root/'ASSISTENTE-LAB.md')
    shutil.copy('docs/21-ativacao-dispositivo.md',root/'ATIVACAO-0.6.1.md')
    shutil.copy('docs/24-inventario-monitoramento.md',root/'MONITORAMENTO.md')
    shutil.copy('docs/23-componente-remoto-integrado.md',root/'COMPONENTE-INTERNO.md')
    shutil.copy('docs/10-acesso-remoto-03.md',root/'LEIA-ME.md')
    licenses=root/'licenses'; licenses.mkdir(exist_ok=True)
    for notice in pathlib.Path('agent/licenses').glob('*.txt'):
        shutil.copy(notice, licenses/notice.name)
    shutil.copy('infra/mesh/UPSTREAM-LICENSE.txt',licenses/'MeshCentral-Apache-2.0.txt')
    if profile=='app':
        for package in ['react','react-dom','scheduler','lucide-react']:
            shutil.copy(f'frontend/node_modules/{package}/LICENSE',licenses/f'{package}-LICENSE.txt')
        sdk=pathlib.Path.home()/'.nuget/packages/microsoft.web.webview2/1.0.4314.35'
        for file in ['LICENSE.txt','NOTICE.txt']:
            shutil.copy(sdk/file,licenses/f'WebView2-{file}')
        shutil.copy('desktop/UaiSuporte.App/Viewer/vendor/NOTICE.md',licenses/'Viewer-NOTICE.md')
        shutil.copy(deps/'webview2-license.txt',licenses/'WebView2-Runtime-LICENSE.txt')
    with zipfile.ZipFile(stage/'payload'/f'{profile}.zip','w',zipfile.ZIP_DEFLATED) as z:
        for file in sorted(root.rglob('*')):
            if file.is_file(): z.write(file,file.relative_to(root))
PY
if [[ "${UAI_PAYLOAD_ONLY:-0}" == "1" ]]; then
  echo "VERIFIED_PAYLOAD=$stage/payload"
  exit 0
fi
"$dotnet_bin" run --project desktop/Setup.Tests -- .tools/lab/exports/uai-lab-ca.cer
"$dotnet_bin" publish desktop/UaiSuporte.Setup -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true \
  -p:PayloadDirectory="$stage/payload" -o "$stage/setup"
cp "$stage/setup/UaiSuporte.Setup.exe" dist/UaiSuporte-Setup-0.6.1-Lab.exe
sha256sum dist/UaiSuporte-Setup-0.6.1-Lab.exe > dist/setup-0.6.1-SHA256SUMS.txt
cat dist/setup-0.6.1-SHA256SUMS.txt
