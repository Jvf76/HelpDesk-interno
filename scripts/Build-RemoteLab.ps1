$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
 $deps=Join-Path $root '.tools\setup-deps'
 $ca=Join-Path $root '.tools\lab\exports\uai-lab-ca.cer'
 $candidate=(Get-Content infra\mesh\agent-provenance.json -Raw|ConvertFrom-Json).labCandidate
 if(!$candidate.approvedForInstallation -or !$candidate.approvalScope.StartsWith('LAB_0.5_')){throw 'Candidato não aprovado para esta prova LAB'}
 $mesh=Join-Path $root '.tools\mesh-audit\MeshService64-Uai-LAB.exe'
 $runtime=Join-Path $deps 'webview2-fixed\Microsoft.WebView2.FixedVersionRuntime.156.0.4314.50.x64'
 $proof=Get-Content desktop\webview2-fixed-provenance.json -Raw|ConvertFrom-Json
 if((Get-FileHash "$deps\webview2-fixed-x64.cab" -Algorithm SHA256).Hash -ne $proof.cabSha256){throw 'CAB Microsoft incorreto'}
 if((Get-FileHash "$runtime\msedgewebview2.exe" -Algorithm SHA256).Hash -ne $proof.executableSha256){throw 'Runtime incorreto'}
 if((Get-FileHash $ca -Algorithm SHA256).Hash -ne 'A1FFB98EB2364BB6EF0B30F5FD5AE61F1689FFFBA1CA6F1510641EAD624D7138'){throw 'CA incorreta'}
 if((Get-FileHash $mesh -Algorithm SHA256).Hash -ne '4CB9AAB0E6F9D90249F29BF15E46E66C702A282BC9F991BBB9B6EF0B78478019'){throw 'MeshAgent incorreto'}
 foreach($file in @($mesh,"$runtime\msedgewebview2.exe")){if((Get-AuthenticodeSignature $file).Status -ne 'Valid'){throw 'Assinatura recusada'}}
 Push-Location frontend
 try {npm ci;if($LASTEXITCODE -ne 0){throw 'npm ci falhou'};npm run build;if($LASTEXITCODE -ne 0){throw 'React falhou'}}finally{Pop-Location}
 $stage=Join-Path $root ('dist\integrated-'+[Guid]::NewGuid().ToString('N'))
 New-Item -ItemType Directory "$stage\payload" -Force|Out-Null
 dotnet publish desktop\UaiSuporte.App -c Release -r win-x64 --self-contained true -o "$stage\app"
 if($LASTEXITCODE -ne 0){throw 'Aplicativo falhou'}
 Copy-Item $runtime "$stage\app\Runtime" -Recurse
 $files=@{}
 Get-ChildItem $runtime -Recurse -File|ForEach-Object {$files[$_.FullName.Substring($runtime.Length+1).Replace('\','/')]=(Get-FileHash $_.FullName -Algorithm SHA256).Hash}
 $expectedFiles=Get-Content desktop\webview2-fixed-files.json -Raw|ConvertFrom-Json
 if($files.Count -ne $expectedFiles.PSObject.Properties.Count){throw 'Conjunto de arquivos Runtime incorreto'}
 foreach($entry in $expectedFiles.PSObject.Properties){if($files[$entry.Name] -ne $entry.Value){throw 'Integridade Runtime recusada'}}
 $files|ConvertTo-Json|Set-Content -Encoding utf8 "$stage\app\runtime-files.json"
 Copy-Item docs\17-cadastro-integrado-lab.md "$stage\app\INSTALACAO.md"
 New-Item -ItemType Directory "$stage\app\licenses" -Force|Out-Null
 Copy-Item agent\licenses\*,infra\mesh\UPSTREAM-LICENSE.txt "$stage\app\licenses\"
 $sdk=Join-Path $env:USERPROFILE '.nuget\packages\microsoft.web.webview2\1.0.4314.35'
 Copy-Item "$sdk\LICENSE.txt" "$stage\app\licenses\WebView2-LICENSE.txt"
 Copy-Item "$sdk\NOTICE.txt" "$stage\app\licenses\WebView2-NOTICE.txt"
 Copy-Item "$deps\webview2-license.txt" "$stage\app\licenses\WebView2-Runtime-LICENSE.txt"
 Copy-Item desktop\UaiSuporte.App\Viewer\vendor\NOTICE.md "$stage\app\licenses\Viewer-NOTICE.md"
 foreach($p in @('react','react-dom','scheduler','lucide-react')){Copy-Item "frontend\node_modules\$p\LICENSE" "$stage\app\licenses\$p-LICENSE.txt"}
 Compress-Archive -Path "$stage\app\*" -DestinationPath "$stage\payload\app.zip"
 Copy-Item $mesh "$stage\payload\meshagent.exe"
 Copy-Item $ca "$stage\payload\lab-ca.cer"
 Copy-Item "$deps\webview2-license.txt" "$stage\payload\webview2-license.txt"
 @{webview2Fixed=$proof;version='0.5.3';receivingValidated=$false;meshAgentIncluded=$true;meshAgentSha256=(Get-FileHash $mesh -Algorithm SHA256).Hash}|ConvertTo-Json -Depth 4|Set-Content -Encoding utf8 "$stage\payload\dependencies.json"
 dotnet publish desktop\UaiSuporte.Setup -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true "-p:PayloadDirectory=$stage\payload" -o "$stage\setup"
 if($LASTEXITCODE -ne 0){throw 'Instalador falhou'}
 Copy-Item "$stage\setup\UaiSuporte.Setup.exe" dist\UaiSuporte-Setup-0.5.3-Lab.exe
 Get-FileHash dist\UaiSuporte-Setup-0.5.3-Lab.exe -Algorithm SHA256
} finally {Pop-Location}
