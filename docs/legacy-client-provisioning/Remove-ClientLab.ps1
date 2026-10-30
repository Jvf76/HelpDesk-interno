$ErrorActionPreference='Stop'
if(Get-Process 'UaiSuporte.Client' -ErrorAction SilentlyContinue){throw 'Encerre localmente a sessao e feche o Cliente primeiro.'}
$shortcut=Join-Path ([Environment]::GetFolderPath('Startup')) 'Uai Suporte Cliente.lnk'
if(Test-Path $shortcut){Remove-Item -LiteralPath $shortcut}
$path=Join-Path $env:LOCALAPPDATA 'UaiTelecom\Cliente'
if(Test-Path $path){Remove-Item -LiteralPath $path -Recurse}
Write-Output 'Cliente de laboratorio removido deste usuario. Revogue o dispositivo na API e remova o node do grupo dedicado MeshCentral. Outros agentes nao foram alterados.'
