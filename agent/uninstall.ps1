$ErrorActionPreference = 'Stop'
if (Get-Process 'UaiSuporte.Agent' -ErrorAction SilentlyContinue) { throw 'Encerre o atendimento no MeshAgent e feche o Uai Suporte antes de desinstalar.' }
$destination = Join-Path $env:LOCALAPPDATA 'UaiTelecom\Suporte'
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Uai Suporte.lnk'
if (Test-Path $menu) { Remove-Item $menu }
if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
Write-Output 'Uai Suporte removido e credencial local apagada. Revogue também o dispositivo no painel. MeshAgent é um componente separado: desinstale pelo instalador oficial.'
