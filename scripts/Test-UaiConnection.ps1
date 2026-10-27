param([string]$PanelHost = 'suporte.internal', [string]$MeshHost = 'mesh.internal')
$ErrorActionPreference = 'Stop'
$failed = $false
foreach ($target in @(
    @{ Name = 'Painel'; HostName = $PanelHost; Port = 443; Url = "https://$PanelHost/" },
    @{ Name = 'Motor'; HostName = $MeshHost; Port = 4433; Url = "https://${MeshHost}:4433/" }
)) {
    $tcp = Test-NetConnection -ComputerName $target.HostName -Port $target.Port -WarningAction SilentlyContinue
    if (!$tcp.TcpTestSucceeded) {
        Write-Output "$($target.Name): FALHA TCP/DNS na porta $($target.Port)"
        $failed = $true
        continue
    }
    try {
        $response = Invoke-WebRequest -Uri $target.Url -UseBasicParsing -TimeoutSec 15
        Write-Output "$($target.Name): TCP OK; HTTPS confiavel; HTTP $($response.StatusCode)"
    } catch {
        Write-Output "$($target.Name): FALHA HTTPS ($($_.Exception.GetType().Name)); confira CA, nome e horario."
        $failed = $true
    }
}
if ($failed) { throw 'Pre-teste reprovado. Nao ignore o certificado; corrija a causa antes de instalar agentes.' }
Write-Output 'Pre-teste OK. Envie o resultado antes de seguir para o cadastro e atendimento.'
