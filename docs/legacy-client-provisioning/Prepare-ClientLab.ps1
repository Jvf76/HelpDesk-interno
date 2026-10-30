param(
 [Parameter(Mandatory=$true)][string]$MeshExe,
 [Parameter(Mandatory=$true)][string]$MeshSettings,
 [string]$Source = "$PSScriptRoot\app"
)
$ErrorActionPreference='Stop'
# Run as the Windows user who will receive support; setup is performed by TI.
if (Get-Process 'UaiSuporte.Client' -ErrorAction SilentlyContinue) { throw 'Feche o Cliente antes de preparar.' }
if (!(Test-Path (Join-Path $Source 'UaiSuporte.Client.exe'))) { throw 'Aplicativo Cliente ausente.' }
$signature=Get-AuthenticodeSignature -LiteralPath $MeshExe
if ($signature.Status -ne 'Valid') { throw "MeshAgent bloqueado: assinatura $($signature.Status). A TI deve obter/corrigir a assinatura; nao desative protecoes." }
$msh=Get-Content -LiteralPath $MeshSettings -Raw
if ($msh -notmatch '(?m)^MeshServer=wss://mesh\.internal(?::443)?/agent\.ashx\s*$' -or $msh -notmatch '(?m)^ServerID=[0-9a-fA-F]{96}\s*$') { throw 'Configuracao Mesh inesperada: confirme origem TLS e identidade do servidor.' }
$storage=Join-Path $env:LOCALAPPDATA 'UaiTelecom\Cliente'
$destination=Join-Path $storage 'app'
if (Test-Path $destination) { throw 'Destino existente. Preserve identidade/dados e solicite procedimento de atualizacao.' }
$code=Read-Host 'TI: codigo de vinculo de uso unico (10 minutos)' -AsSecureString
$plain=[Net.NetworkCredential]::new('',$code).Password
New-Item -ItemType Directory -Force $destination,(Join-Path $destination 'mesh') | Out-Null
Copy-Item "$Source\*" $destination -Recurse
$native=Join-Path $destination 'mesh\meshagent.exe'
Copy-Item -LiteralPath $MeshExe -Destination $native
Copy-Item -LiteralPath $MeshSettings -Destination (Join-Path $destination 'mesh\meshagent.msh')
Add-Type -AssemblyName System.Security
$setup=@{server='https://suporte.internal';meshExe=$native;meshSha256=(Get-FileHash $native -Algorithm SHA256).Hash;enrollmentCode=$plain}|ConvertTo-Json -Compress
$protected=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($setup),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
[IO.File]::WriteAllBytes((Join-Path $storage 'setup.bin'),$protected)
$plain=$null;$setup=$null;$code.Dispose()
$startup=[Environment]::GetFolderPath('Startup')
$shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $startup 'Uai Suporte Cliente.lnk'))
$shortcut.TargetPath=Join-Path $destination 'UaiSuporte.Client.exe';$shortcut.WorkingDirectory=$destination;$shortcut.Description='Suporte assistido visivel - Uai Telecom';$shortcut.Save()
Write-Output 'Preparado para este usuario. Inicializacao visivel no proximo login Windows. Nenhum processo foi iniciado agora.'
Write-Output 'Antes de iniciar: confirme dispositivo/grupo corretos com a TI. O Node ID ainda deve ser associado pelo administrador no aplicativo Tecnico.'
