$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    Push-Location frontend
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) { throw 'Falha no npm ci.' }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Falha no build React.' }
    } finally { Pop-Location }
    $stage = Join-Path $root ('dist\technician-build-' + [Guid]::NewGuid().ToString('N'))
    dotnet publish .\desktop\UaiSuporte.Technician -c Release -r win-x64 --self-contained true -p:RestoreLockedMode=true -o $stage
    if ($LASTEXITCODE -ne 0) { throw 'Falha no publish Windows.' }
    Copy-Item .\docs\09-tecnico-desktop.md (Join-Path $stage 'LEIA-ME.md')
    $licenses = Join-Path $stage 'licenses'
    New-Item -ItemType Directory -Force $licenses | Out-Null
    $sdk = Join-Path $env:USERPROFILE '.nuget\packages\microsoft.web.webview2\1.0.4314.35'
    Copy-Item (Join-Path $sdk 'LICENSE.txt') (Join-Path $licenses 'WebView2-LICENSE.txt')
    Copy-Item (Join-Path $sdk 'NOTICE.txt') (Join-Path $licenses 'WebView2-NOTICE.txt')
    foreach ($package in @('react','react-dom','scheduler','lucide-react')) {
        Copy-Item "frontend/node_modules/$package/LICENSE" (Join-Path $licenses "$package-LICENSE.txt")
    }
    $zip = Join-Path $root 'dist\uai-suporte-tecnico-0.2.0-win-x64.zip'
    Compress-Archive -Path "$stage\*" -DestinationPath $zip -Force
    Get-FileHash $zip -Algorithm SHA256
    Write-Output 'Publicação de laboratório SEM assinatura Authenticode. Não contornar políticas Windows. WebView2 Runtime necessário.'
} finally { Pop-Location }
