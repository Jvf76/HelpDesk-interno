$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    dotnet publish .\agent\UaiSuporte.Agent -c Release -r win-x64 --self-contained true -o .\agent\publish
    if ($LASTEXITCODE -ne 0) { throw 'Falha no publish.' }
    $stage = Join-Path $root 'dist\windows-lab'
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory -Force "$stage\agent", "$stage\scripts", "$stage\docs" | Out-Null
    Copy-Item .\agent\publish "$stage\agent" -Recurse -Force
    Copy-Item .\agent\install.ps1, .\agent\uninstall.ps1 "$stage\agent"
    Copy-Item .\scripts\Test-UaiConnection.ps1 "$stage\scripts"
    Copy-Item .\docs\03-prova-windows.md, .\docs\06-integracao-e-seguranca-remota.md, .\docs\04-resultados.md "$stage\docs"
    Compress-Archive -Path "$stage\*" -DestinationPath .\dist\uai-windows-lab.zip -Force
    Get-FileHash .\dist\uai-windows-lab.zip -Algorithm SHA256
    Write-Output 'Pacote de laboratorio, sem assinatura Authenticode. MeshAgent deve vir do servidor/grupo correto.'
} finally { Pop-Location }
