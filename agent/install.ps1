param([string]$Source = "$PSScriptRoot\publish")
$ErrorActionPreference = 'Stop'
$destination = Join-Path $env:LOCALAPPDATA 'UaiTelecom\Suporte\app'
if (!(Test-Path (Join-Path $Source 'UaiSuporte.Agent.exe'))) { throw 'Publique o agente na pasta publish antes de instalar.' }
if (Get-Process 'UaiSuporte.Agent' -ErrorAction SilentlyContinue) { throw 'Feche o Uai Suporte antes de instalar ou atualizar.' }
New-Item -ItemType Directory -Force $destination | Out-Null
Copy-Item "$Source\*" $destination -Recurse -Force
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Uai Suporte.lnk'
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($menu)
$shortcut.TargetPath = Join-Path $destination 'UaiSuporte.Agent.exe'
$shortcut.WorkingDirectory = $destination
$shortcut.Description = 'Uai Telecom - agente visível de suporte assistido'
$shortcut.Save()
Write-Output 'Instalado para o usuário atual. Abra Uai Suporte no menu Iniciar. Não é serviço e não inicia oculto.'
