# Resultados — 27/10/2026

**MVP não concluído. Nenhum atendimento entre dois Windows foi validado.** Esta revisão implementa a ligação do painel aos estados/encerramento do motor, com testes automatizados. Não transforma fixtures de protocolo em prova de captura/controle Windows.

## Estado por entrega

| Entrega | Implementado | Testado automaticamente nesta revisão | Validado Windows real |
|---|---|---|---|
| Autenticação, permissões, isolamento de chamados e presença | Sim, preservado | PostgreSQL real; solicitante isolado, técnico sem controle negado, expiração e revogação | Não |
| Integração Spring → Mesh | Capacidades exigidas, consulta/renovação/parada, 60 s absolutos | MeshCentral 1.3.1 real por WSS/TLS, autenticação e consulta de capacidades/estado desconhecido | Não |
| Relay Uai | Consentimento/imagem/fim, lease 12 s, conexão única, filtro VIEW/CONTROL, perda de conexão | Testes de módulo e sockets WebSocket loopback com fixtures | Não |
| Painel | Estado observado, primeiro bloco e última confirmação; estado incerto explícito | TypeScript e build Vite | Não |
| C# | Consentimento/cadastro/parada e log rotativo sem tokens | Publish WinForms win-x64 self-contained | Não; não executado |
| Banco | Migração V2, timestamps de motor e término preservados entre polls | V1→V2 em PostgreSQL 16.15; V1/V2 em H2 na primeira rodada | Não aplicável |
| Distribuição/rede | Compose, scripts, ZIP C#, roteiro | Instalação npm limpa e patches; pacote gerado no Linux | Docker e PowerShell não executados; assinaturas pendentes |

## Evidências automatizadas

- **23 CriticalFlowsTest**, **4 MeshContractTest**, **2 MeshConnectionTest**: **29 passados, zero falhas/erros/pulados** na rodada PostgreSQL + Mesh. Os testes de fluxos usam motor substituído; os dois de conexão usam servidor real. O inventário do teste está vazio, sem agente Windows.
- Além dos 19 casos anteriores, cobre consentimento final versus primeiro bloco de imagem, recusa/parada/perda reportadas ao painel, indisponibilidade sem ACTIVE e preservação de início/término quando a sessão ocorre entre polls.
- **12 testes Node**, zero falhas. Dez exercitam política/observador; dois usam sockets reais de loopback para encaminhar bytes de fixture e provar fechamento de ambos os lados na parada/recusa. Casos incluem VIEW, ausência de consentimento, permissões de proprietário, conexão única, lease/prazo, fragmentos/jumbo e perda de pong.
- Os testes Node **não carregam o MeshAgent Windows**, não decodificam imagem de desktop e não aplicam mouse/teclado no SO. O wiring completo MeshAgent/core/relay/browser permanece para a prova Windows.
- Instalação limpa npm ci reaplicou os patches versionados; motor iniciou com node-forge 1.4.1. npm audit: **zero vulnerabilidades** nessa consulta.
- Frontend: tsc -b e vite build concluídos.
- C#: dotnet publish Release win-x64 self-contained concluído. Artefatos em agent/publish e dist/uai-windows-lab.zip; sem assinatura Authenticode da Uai.
- Git diff --check sem erros. Scripts PowerShell e Docker Compose não executados neste Linux.

Evidência anterior, de 26/10: Playwright com API/PostgreSQL reais aprovou login, chamados/comentários/resolução, logout/troca de usuário e layout desktop/móvel. Não foi reclassificada como teste novo do viewer remoto.

## Dependências e assinatura

O alerta antigo de node-forge 1.4.0 foi tratado pela versão upstream **1.4.1**, publicada em 27/10/2026. Não foi ocultado nem aplicado force update incompatível. A análise da cadeia, vulnerabilidade, explorabilidade não demonstrada e fontes está em [06-integracao-e-seguranca-remota.md](06-integracao-e-seguranca-remota.md).

O aviso Authenticode MeshService/MeshCmd foi reproduzido com 1.4.1; stack aponta leitura ASN.1 na preparação do timestamp. TLS/WSS verificado funcionou. O aviso não foi suprimido e permanece pendente de correção/validação do executável exato. C#/scripts também não estão assinados pela Uai.

## Reproduzir

1. mvn -f backend/pom.xml test (H2 por padrão; testes WSS pulados sem variáveis).
2. Para PostgreSQL real, usar banco descartável exclusivo e UAI_TEST_DATABASE/UAI_TEST_DB_USER/UAI_TEST_DB_PASSWORD. Os testes apagam tabelas da aplicação.
3. Para WSS real, definir MESH_SMOKE_URL/USER/PASSWORD de motor exclusivo de teste, com patch instalado, e truststore Java contendo a CA correta. Executar Maven com -Djavax.net.ssl.trustStore=/caminho/truststore e senha apropriada.
4. npm --prefix infra/mesh ci; npm --prefix infra/mesh test.
5. npm --prefix frontend ci; npm --prefix frontend run build.
6. dotnet publish agent/UaiSuporte.Agent -c Release -r win-x64 --self-contained true -o agent/publish.

As fontes e testes ficam no Git. Logs locais em .tools e binários em dist/agent/publish são ignorados; não versionar dados, chaves ou credenciais do laboratório. O script scripts/Build-Windows.ps1 reproduz o pacote no Windows com SDK .NET 10.

## Próximo gate: suas máquinas

Seguir [03-prova-windows.md](03-prova-windows.md), começando só por Test-UaiConnection.ps1 em A/B depois da preparação do servidor e CAs. Aguardar análise do resultado antes de instalar/aceitar sessões.

Pendente comprovar: instalação e assinatura do binário exato; atualização do core; dois consentimentos; tela renderizada; mouse/teclado reais; VIEW sem controle; recusa sem imagem; X interrompendo efetivamente; lease/expiração/revogação/queda cortando o fluxo; resultado correto no histórico. UAC/login/bloqueio/multimonitor/serviço continuam sem promessa de suporte.
