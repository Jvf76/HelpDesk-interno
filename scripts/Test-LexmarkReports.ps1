#requires -Version 5.1
<#
Diagnostico de identificacao Lexmark, somente leitura. Nao coleta o contador solicitado. Nao instala agente, tarefa ou servico.
Os arquivos nativos sao preservados; nenhum contador e inferido ou alterado.
#>
[CmdletBinding()]
param(
    [string]$PrinterIp = '192.168.30.200',
    [string]$ExpectedSerial = '701533HH09191',
    [string]$OutputDirectory = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Uai-Relatorios-Impressora')
)
$ErrorActionPreference = 'Stop'
$parsedIp = $null
if (-not [Net.IPAddress]::TryParse($PrinterIp, [ref]$parsedIp) -or
    $parsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'Informe um endereco IPv4 valido.'
}
$PrinterIp = $parsedIp.ToString()
Add-Type -AssemblyName System.Net.Http
$started = [DateTimeOffset]::Now
$folder = Join-Path $OutputDirectory ($started.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$handler = New-Object Net.Http.HttpClientHandler
$handler.AllowAutoRedirect = $false
$handler.UseProxy = $false
$handler.UseDefaultCredentials = $false
$client = New-Object Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(30)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('UaiSuporte-LexmarkLab/1.0')
$records = @()
$failure = $null
try {
    # Apenas paginas conhecidas para localizar identidade e navegacao.
    # Nao adivinhar a URL do Relatorio de ativo nem usar deviceinfo como contador.
    foreach ($name in @('panel','deviceinfo')) {
        $url = if ($name -eq 'panel') { "http://$PrinterIp/" } else { "http://$PrinterIp/cgi-bin/dynamic/printer/config/reports/deviceinfo.html" }
        Write-Host "Coletando $name de $PrinterIp..."
        $response = $null
        $stream = $null
        $memory = $null
        $timeout = New-Object Threading.CancellationTokenSource
        $timeout.CancelAfter(30000)
        try {
            $response = $client.GetAsync($url, [Net.Http.HttpCompletionOption]::ResponseHeadersRead, $timeout.Token).GetAwaiter().GetResult()
            if ([int]$response.StatusCode -ne 200) {
                throw "HTTP $([int]$response.StatusCode). Coleta interrompida; autenticacao e redirecionamentos nao sao contornados."
            }
            $media = $response.Content.Headers.ContentType
            if ($null -eq $media -or $media.MediaType -notin @('text/html','application/xhtml+xml')) {
                throw 'A impressora nao retornou um documento HTML.'
            }
            $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $memory = New-Object IO.MemoryStream
            $buffer = New-Object byte[] 8192
            while (($count = $stream.ReadAsync($buffer, 0, $buffer.Length, $timeout.Token).GetAwaiter().GetResult()) -gt 0) {
                if ($memory.Length + $count -gt 5MB) { throw 'Relatorio excede o limite de 5 MB.' }
                $memory.Write($buffer, 0, $count)
            }
            if ($memory.Length -eq 0) { throw 'Relatorio vazio.' }
            $file = Join-Path $folder "$name.html"
            [IO.File]::WriteAllBytes($file, $memory.ToArray())
            $records += [ordered]@{
                report = $name; source = $url; file = "$name.html"
                receivedAt = [DateTimeOffset]::Now.ToString('o')
                contentType = $media.ToString(); bytes = $memory.Length
                sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
                validation = 'RAW_HTML_NOT_YET_VALIDATED'
            }
        } finally {
            if ($null -ne $memory) { $memory.Dispose() }
            if ($null -ne $stream) { $stream.Dispose() }
            if ($null -ne $response) { $response.Dispose() }
            $timeout.Dispose()
        }
    }
} catch {
    $failure = 'Nao foi possivel concluir os dois downloads. Verifique acesso ao painel, autenticacao e disponibilidade da impressora.'
    Write-Warning $failure
} finally {
    $client.Dispose()
    $handler.Dispose()
}
$metadata = [ordered]@{
    schemaVersion = 2
    purpose = 'LAB - identificar equipamento e localizar Relatorio de ativo; nao e leitura de contador'
    expectedBrand = 'Lexmark'
    requestedReport = 'Relatorio de ativo'
    requestedField = 'Contags de imp. mono'
    counterValue = $null
    counterStatus = 'PENDING_NATIVE_ASSET_REPORT_VALIDATION'
    printerIp = $PrinterIp
    expectedModel = 'Lexmark MX511de'
    expectedSerial = $ExpectedSerial
    identityVerified = $false
    collectionStartedAt = $started.ToString('o')
    collectionFinishedAt = [DateTimeOffset]::Now.ToString('o')
    timeZone = [TimeZoneInfo]::Local.Id
    clockSource = 'Windows do computador coletor; confirme sincronizacao do relogio'
    printerClockWarning = 'Relogio da impressora informado como incorreto (2019); nao usar como data real da coleta.'
    downloadComplete = ($records.Count -eq 2 -and $null -eq $failure)
    reports = @($records)
    error = $failure
}
$metadata | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $folder 'coleta.json') -Encoding UTF8
@'
COLETA DE LABORATORIO - UAI SUPORTE
Arquivos HTML recebidos da impressora, sem executar scripts ou carregar recursos externos.
Download nao comprova que o conteudo e o relatorio esperado: pode ser uma pagina de login.
O Relatorio de ativo ainda nao foi localizado. Nenhum contador foi coletado.
Marca, modelo e serie ainda precisam de validacao. ExpectedSerial e um valor informado,
nao uma identidade extraida. A data registrada vem do Windows, nao da impressora.
Nenhuma configuracao ou contador foi alterado. Nenhum e-mail foi enviado.
Nao ha tarefa agendada ou instalacao de servico neste teste.
O pacote pode conter identificacao e detalhes internos do equipamento; compartilhe apenas
com a equipe responsavel. Arquivos nativos nao devem ser inseridos no Git.
'@ | Set-Content -LiteralPath (Join-Path $folder 'LEIA-ME.txt') -Encoding UTF8
if ($null -ne $failure) {
    Write-Host "Diagnostico parcial em: $folder"
    exit 1
}
$zip = "$folder.zip"
Compress-Archive -Path (Join-Path $folder '*') -DestinationPath $zip
Write-Host ''
Write-Host 'Paginas de diagnostico recebidas. Identidade ainda nao validada; contador pendente.'
Write-Host "Pacote para validacao: $zip"
Write-Host 'Proximo passo: validar identidade e localizar o Relatorio de ativo no painel.'
