# Uai Suporte Técnico 0.2.0 — prova Windows x64

Esta publicação é um aplicativo WinForms/.NET 10 com WebView2, não um atalho
ou PWA. Backend, banco, certificados, MeshCentral e painel web em execução
foram preservados. Nenhum agente ou aplicativo Cliente foi instalado.

## Interface e autenticação

O build de frontend/dist (HTML/JS/CSS) é incorporado como recursos em
UaiSuporte.Technician.dll. Não há download de código da interface. O executável
usa WebResourceRequested para responder somente com esses recursos, na origem
virtual HTTPS https://uai-technician.invalid/index.html. Esse nome não precisa
nem deve ser adicionado ao hosts. A estratégia é documentada pela Microsoft:
https://learn.microsoft.com/microsoft-edge/webview2/concepts/working-with-local-content

A barra nativa identifica a interface incorporada e a versão. CSP bloqueia
scripts externos, eval, frames, workers e conexões de rede do renderer. Nenhuma
página remota, incluindo a página de login, é carregada. Navegação, pop-ups,
downloads e permissões de dispositivos são bloqueados. Não há navegador externo.

A ponte WebMessage aceita somente mensagens da página local exata e rotas/
métodos da API previstos no código. Não aceita URL arbitrária, arquivos locais,
cabeçalhos arbitrários ou redirecionamentos. HttpClient chama exclusivamente
https://suporte.internal/api. Cookies ficam no CookieContainer nativo em memória,
nunca em JavaScript, disco, mensagens ou logs. O CSRF retornado pela API segue
em X-CSRF-Token nas mutações e continua validado no backend. O login inicial
sem sessão não produz o aviso incorreto de expiração. Erros TLS e de rede têm
mensagens distintas. Logout real revoga a sessão no servidor.

Não foi necessário mudar CORS ou SameSite, nem desativar CSRF. CORS permanece
com a política existente: o renderer não faz fetch cross-origin; a ponte nativa
controla a origem e o destino. TLS usa a confiança normal do Windows/.NET.
Não há callbacks que aceitam certificados inválidos. Fechar o aplicativo elimina
o cookie da memória; para revogação imediata no servidor, use Sair antes de fechar.
Sem logout, a sessão órfã expira pelo prazo normal do backend.

A aba Atendimento remoto é uma área interna reservada, sem viewer ativo nesta
prova. Solicitações e launch remoto estão bloqueados no perfil desktop tanto
na interface quanto na ponte. Isso evita criar atendimentos sem viewer.
Não há captura ou controle remoto comprovado nessa versão.

## Pacote e dependências

Pacote: dist/uai-suporte-tecnico-0.2.0-win-x64.zip, na VM do projeto.
Executável após extrair: UaiSuporte.Technician.exe. Preserve todos os arquivos.
.NET 10 e dependências estão incluídos; não é necessário instalar o SDK/runtime
.NET separadamente. Necessário Windows x64 compatível com .NET 10 e Microsoft
Edge WebView2 Runtime Evergreen atualizado. Use Windows 11 x64 no primeiro teste.
O pacote inclui o SDK/loader WebView2, mas não o Runtime completo do navegador.

Se o runtime estiver ausente, o aplicativo exibe orientação. Instale somente pelo
canal corporativo ou oficial: https://developer.microsoft.com/microsoft-edge/webview2/
A atualização do Runtime não substitui a interface React incorporada.

Este pacote de laboratório NÃO tem assinatura Authenticode própria. Não é
instalador definitivo. Não contorne SmartScreen, WDAC, AppLocker ou Defender.
Se houver bloqueio, registre a mensagem e aguarde o processo de assinatura/
aprovação da TI. Distribuição futura requer assinar os componentes e o pacote
com identidade corporativa. Não há atualizador de UI nem carregamento silencioso
de código remoto; uma nova UI exige recompilar e distribuir nova versão assinada.
O hash publicado verifica o pacote desta prova, não substitui Authenticode.

## Transferência, uma etapa por vez

A cópia publicada está no HTTPS do laboratório, restrito ao IP autorizado.
No PowerShell do Windows cujo certificado já foi validado:

    $zip = "$env:USERPROFILE\Downloads\uai-suporte-tecnico-0.2.0-win-x64.zip"
    Invoke-WebRequest -Uri "https://suporte.internal/lab/uai-suporte-tecnico-0.2.0-win-x64.zip" -OutFile $zip
    Get-FileHash $zip -Algorithm SHA256

Compare com o hash fornecido na conversa/arquivo SHA256SUMS da VM. Não continue
se diferir. Não use SkipCertificateCheck. Envie o resultado antes da execução.

Após conferir o hash, extraia para uma pasta nova (sem sobrescrever versão anterior):

    Expand-Archive -LiteralPath $zip -DestinationPath "$env:USERPROFILE\Downloads\UaiSuporteTecnico-0.2.0"
    Get-AuthenticodeSignature "$env:USERPROFILE\Downloads\UaiSuporteTecnico-0.2.0\UaiSuporte.Technician.exe" | Select-Object Status,StatusMessage

É esperado NotSigned nesta publicação. Qualquer bloqueio de política deve ser
resolvido pela TI, sem desativar proteções. Quando permitido no laboratório:

    & "$env:USERPROFILE\Downloads\UaiSuporteTecnico-0.2.0\UaiSuporte.Technician.exe"

Não execute de dentro do ZIP. Não precisa executar como administrador.
Nenhum serviço, agente, inicialização automática ou registro de instalação é criado.

## Roteiro de validação (aguardar resultado a cada etapa)

1. Abrir: janela própria, ícone, login e barra "Interface incorporada". Nenhum
   navegador externo deve aparecer. Primeiro acesso não mostra Sessão expirada.
2. Login: use conta autorizada do backend. Para o admin do laboratório, login
   admin-lab; obtenha a senha SOMENTE no editor local da VM, arquivo privado
   .tools/lab/secrets/admin-access.json, campo panel.password. Não enviar senha
   no chat/logs nem copiá-la para o ZIP. Verificar tela principal e perfil correto.
3. Logout: botão Sair deve voltar ao login; fechar/reabrir também não conserva
   credenciais. Conferir que não há aviso incorreto de expiração após logout.
4. Interface local/indisponibilidade: com o aplicativo fechado e apenas quando
   não interromper outro trabalho, desconecte a rede do Windows de teste. Abra
   novamente. A tela de login e os estilos devem aparecer; após o timeout da API,
   deve aparecer Servidor indisponível. Isso prova independência dos assets
   do servidor. Reconecte e tente o login. Não pare o Nginx compartilhado.
5. TLS: a VM testou rejeição sem CA; teste gráfico equivalente requer um usuário
   de laboratório separado que não confie nessa CA (nem por política da máquina).
   Nesse usuário deve aparecer erro TLS, não acesso autenticado. Não remover CAs
   corporativas e não ignorar avisos. Este cenário Windows ainda está pendente.
6. Área remota: aba interna informativa; nenhuma sessão será iniciada nesta prova.

Hosts e CA já configurados continuam necessários para API:

    131.0.112.23 suporte.internal mesh.internal

CA do laboratório SHA256 DER:
A1FFB98EB2364BB6EF0B30F5FD5AE61F1689FFFBA1CA6F1510641EAD624D7138.
Apenas a CA pública identificada; não importar chaves privadas.

Logs nativos: %LOCALAPPDATA%\UaiTelecom\Technician\technician.log.
Registram início, falha de runtime e códigos HTTP; não registram usuário, senha,
cookie, CSRF, URL de sessão ou corpos. O perfil WebView2 fica no subdiretório
WebView2. Para remover esta prova: fechar o app, apagar pasta extraída e, se
não precisar dos logs, esse diretório Technician. Não apagar o perfil do agente.

## Build e testes reproduzíveis

Linux nesta VM: bash scripts/build-technician.sh (usa .tools/dotnet por padrão).
Windows de desenvolvimento: scripts/Build-Technician.ps1, Node/npm e SDK.NET10.
Ambos recompilam React e publicam win-x64 autocontido. Não assinam o pacote.
Versão do SDK WebView2 fixada em1.0.4314.35; lockfile NuGet versionado.
Referência WPF desnecessária removida do build WinForms, sem suprimir warnings.

Testes do transporte:

    .tools/dotnet/dotnet run --project desktop/Transport.Tests

Teste real na VM, sem imprimir credenciais:

    SSL_CERT_FILE="$PWD/.tools/lab/tls/lab-ca.crt" .tools/dotnet/dotnet run --project desktop/Transport.Tests -- live .tools/lab/secrets/admin-access.json
    .tools/dotnet/dotnet run --project desktop/Transport.Tests -- untrusted

O teste live conecta o socket a loopback443 preservando suporte.internal para
TLS; a confiança é carregada da CA específica, não há bypass. Isto não simula
conectividade externa. Usa login/logout reais e consulta dados, sem criar
usuários/dispositivos/chamados. Os outros testes usam handlers explicitamente
simulados para erros e rejeição de origem/rotas. O renderer é testado por:

    cd frontend
    node tests/desktop.mjs

Esse teste usa Chromium headless e ponte simulada; não é uma execução WebView2.

## Resultado desta entrega

Implementado: app nativo, UI incorporada, ponte API restrita, login/logout,
CSRF, erros, bloqueios de navegação, área reservada e publicação x64.
Testado na VM: compilação/publish; recursos HTML/JS/CSS no assembly; 22 verificações
base do transporte; 8 adicionais contra API real; rejeição real de CA não confiada;
10 verificações React com ponte simulada. Casos comuns não são contados novamente
como testes distintos em cada execução. Nenhuma alteração dos serviços ativos.
Validado pelo operador no Windows em 27/10/2026: hash do ZIP, extração, abertura
da janela com tela de login, autenticação real e logout sem aviso incorreto de
expiração. O teste sem rede foi adiado para não interromper o trabalho.
Pendente em Windows real: interface offline, erros TLS na janela e bloqueios
visuais. Assinatura corporativa, viewer remoto e atendimento real permanecem
pendentes. Não há segundo computador disponível para a prova remota; nenhum
agente foi instalado nesta etapa.
