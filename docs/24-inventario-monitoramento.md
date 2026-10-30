# Inventário e monitoramento — implementação de laboratório

O Windows continua usando ativação única e credencial individual protegida. O painel web exige login e CSRF nas mutações. O navegador apenas controla sessões: receber acesso exige aplicativo Windows ativo. Nenhum novo instalador foi gerado nesta etapa.

## Reaproveitamento e permissões

São reutilizados device, ativação recuperável, identidade individual, vínculo Mesh, sessões, auditoria e autenticação web. V8 acrescenta panel_role sem destruir os papéis históricos. ADMIN administra; OPERADOR consulta e solicita acesso somente aos dispositivos autorizados; LEITURA consulta sem editar ou conectar. O consentimento local é obrigatório. As regras são verificadas no backend. TECNICO permanece como papel legado; novos operadores devem usar OPERADOR. O aplicativo autenticado por dispositivo mantém seu fluxo próprio, sem login humano.

Dados administrativos (nome amigável, responsável, cidade, setor, observações) são separados dos detectados. Alterações não mudam código público, identidade ou usuário Windows. Cada campo alterado registra valor anterior/novo, administrador, horário e motivo opcional. Revogar preserva o histórico e impede presença, métricas e novas sessões.

## Arquivos principais

- backend/src/main/resources/db/migration/V8__inventory_monitoring.sql
- backend/src/main/java/br/com/uaitelecom/suporte/MonitoringController.java
- backend/src/main/java/br/com/uaitelecom/suporte/MonitoringService.java
- AuthController, AdminController, Security, DeviceController, DesktopController, SessionService e Errors: integração de papéis, presença e validação.
- frontend/src/MonitoringPanel.tsx, monitoring.css: inventário, detalhes, dashboard, administração e configuração.
- frontend/src/WebSession.tsx e scripts/sync-viewer.mjs: controlador interno, reutilizando o viewer existente e seus arquivos legais.
- desktop/UaiSuporte.Receiving/MonitoringCollector.cs, MonitoringSchedule.cs e Program.cs: coleta, presença e reconexão.
- backend/src/test/java/br/com/uaitelecom/suporte/CriticalFlowsTest.java, frontend/tests/monitoring.mjs, viewer.mjs e desktop/Monitoring.Tests: verificações automatizadas.

## Migração V8

Estende device com campos administrativos, detecção, versões, último contato, integridade declarada e início das condições de alerta. Adiciona device_change, device_metric, device_metric_hour, device_event, monitoring_config e fleet_metric. As séries possuem índice por dispositivo/horário e índice temporal para retenção. Nenhuma credencial é devolvida pelo inventário.

PostgreSQL convencional é suficiente para começar. A escolha não constitui capacidade comprovada. TimescaleDB pode ajudar com particionamento, compressão e agregação contínua quando medições de volume, latência e custo de manutenção justificarem; não é dependência desta versão.

## API adicionada

| Método e caminho sob /api | Uso / autorização |
|---|---|
| POST /agent/presence | Presença e amostra agrupada opcional; credencial individual e vínculo Mesh |
| GET /agent/requests | Consentimentos pendentes; credencial individual |
| POST /agent/events | Códigos de evento permitidos, limite por dispositivo |
| GET /inventory | Consulta paginada, ADMIN/OPERADOR/LEITURA e TECNICO legado |
| GET /inventory/{id} | Identificação, última amostra, últimos 100 acessos/alterações/eventos |
| PUT /inventory/{id} | Dados administrativos; ADMIN |
| GET /inventory/{id}/metrics?from=...&to=... | Série individual; permissões de leitura |
| GET /monitoring/summary | Contadores e versões |
| GET /monitoring/series?from=...&to=... | Série agregada da frota |
| GET /monitoring/config | Configuração de monitoramento; leitura |
| PUT /monitoring/config | Intervalos, limites e retenção; ADMIN |

A listagem aceita page (base zero), size (1–100, padrão 25), q, city, department, version, state, lowDisk, highCpu e highMemory. COUNT e LIMIT/OFFSET são executados no banco. As séries limitam a resposta a 1.000 pontos, indicam truncamento e consolidam períodos superiores a seis horas. No dashboard consolidado, quantidades são médias por hora. Discos consolidados representam a última amostra da hora, não uma média de capacidade. CPU contém média e máximo na tabela horária; a interface mostra média.

## Coleta e volume

Presença padrão: 30 s. Métricas padrão: 60 s, enviadas junto da próxima presença disponível; na prática podem levar aproximadamente 60–90 s. Há variação aleatória de ±10% e relógio de coleta separado. O painel consulta detalhes a cada 15 s, sem aumentar a coleta do computador. Solicitações de consentimento ainda são consultadas a cada 3 s; essa consulta foi separada da gravação de presença.

Por dispositivo continuamente online, estimam-se aproximadamente 2 requisições de presença/minuto e 960–1.440 amostras/dia. Cada amostra é um payload compacto com CPU, RAM e todos os discos locais, não uma requisição por métrica. O tamanho depende do número de discos; não foi feito teste de capacidade ou benchmark de armazenamento para uma frota de produção. O polling de consentimento soma aproximadamente 20 consultas/minuto por computador, além das métricas. Esses valores são estimativas de configuração.

Coleta usa GetSystemTimes, GlobalMemoryStatusEx, discos locais fixos, endereços IPv4, nome/usuário da sessão e versão do SO. A primeira leitura de CPU não tem delta e é nula. Não lê documentos, histórico de navegador, teclas ou telas. O IP público é observado no servidor, respeitando proxy local confiável; não é consultado em serviço externo.

A versão do motor é a identificação fixada da distribuição LAB; o estado é informado pelo componente local após suas verificações existentes de hash/assinatura. Não é atestação remota de integridade contra um Windows comprometido.

Há no máximo um envio em andamento e nenhuma fila persistente de métricas: na recuperação envia-se uma amostra recente, descartando o intervalo perdido. Reconexão exponencial de 5 até 300 s, com jitter (máximo 330 s), sem bloquear a interface. Falhas de credencial/TLS não são contornadas. Revogação bloqueia novas conexões. O coletor roda no aplicativo da sessão interativa e não é um novo serviço de coleta antes do login Windows.

## Retenção e alertas

Padrões configuráveis: dados detalhados 2 dias; consolidados por hora 90 dias; eventos técnicos 365 dias. Job horário consolida horas completas antes de excluir detalhes. Auditoria administrativa/de acesso e histórico de mudanças não são apagados por esse job (preservação indefinida nesta etapa; política corporativa de arquivamento deve ser definida separadamente).

CPU/RAM acima de 90%, disco livre abaixo de 10%: duração mínima 300 s. Presença offline após 100 s; ausência prolongada após 3.600 s. Configuração de offline exige pelo menos três intervalos de presença. Uma quebra de continuidade reinicia os contadores; amostras antigas não disparam alertas de recursos atuais. Há alertas de saúde persistente, credencial revogada e versão diferente da esperada; campo de versão vazio desativa essa comparação. Somente alertas visuais, sem envio externo.

## Telas e limites de validação

Computadores: busca, filtros, paginação; detalhes: identificação, métricas, discos, alterações, eventos, acessos, edição, revogação e ativação administrativa confirmada. Dashboard escuro com identidade Uai, séries e períodos predefinidos/personalizado. Usuários e permissões são restritos ao administrador. Valores ausentes são apresentados como não informados, nunca simulados no produto.

O viewer web reutiliza código/decodificação/entrada existentes dentro da página. A configuração Mesh deve permitir explicitamente suporte.internal em allowedOrigin, mantendo mesh.internal; nenhum wildcard. A rede continua restrita à Uai/VPN pelo proxy existente. Não se altera firewall para publicar o painel livremente.

Testes de interface usam APIs simuladas exclusivamente na execução dos testes. Os testes backend usam banco isolado, incluindo PostgreSQL real na VM, sem conectar computadores reais. A compilação C# para Windows não executa contadores nativos, DPAPI ou ciclo de inicialização/desinstalação. Coleta real, consumo de CPU do coletor, usuário Windows, discos, reconexão e sessões navegador/aplicativo com consentimento e encerramento local ainda exigem Windows autorizado. O instalador 0.6.0 já entregue não contém este novo coletor; não foi sobrescrito.

## Resultado na VM — 30/10/2026

- Migrações V1–V8 e 68 testes backend passaram em H2 e PostgreSQL 16 isolado (64 fluxos críticos + 4 contratos Mesh). Dois testes Java opcionais de WSS ficaram sem execução nessa bateria; WSS real foi verificado separadamente pelo script do laboratório.
- 19 verificações Playwright do inventário/dashboard passaram com API simulada, incluindo paginação, separação de responsável/usuário Windows, edição com CSRF, bloqueios visuais de LEITURA, período personalizado e viewport de 390 px.
- 23 verificações de interface Windows com ponte simulada; 14 de login web; 2 de qualidade adaptativa passaram. Viewer testado nas duas integrações com JPEG decodificado no canvas, VIEW sem entrada, CONTROL com entrada e limpeza ao encerrar; transporte simulado.
- 67 verificações do agendamento/backoff, 37 do transporte e 47 das políticas do instalador passaram. Compilação C# do aplicativo Windows: zero erros e zero avisos. Isso não executa o aplicativo no Windows.
- Testes Node do motor: 16 passaram; 1 teste opcional de binário unsigned não executado, pois não fornecido nesta rodada. Nenhum binário MeshAgent foi modificado ou distribuído nesta etapa.
- Teste concorrente: 18 dispositivos e 6 workers em banco isolado, para isolamento funcional. Não equivale a teste de carga ou capacidade homologada.
- Publicado backend V8 e frontend na VM, sem sessões remotas abertas. Backup anterior em .tools/lab/backups/monitoring-20261030T125139Z. Comparação das identidades existentes confirmou preservação.
- Serviços backend, PostgreSQL, MeshCentral e proxy interno ativos. HTTPS, login/logout, inventário paginado e configuração verificados. WSS autenticado passou para mesh.internal e suporte.internal; origem externa rejeitada. CA não confiada continua sendo rejeitada.
- A inicialização do MeshCentral ainda registra avisos de falha de assinatura automática de seus binários upstream. Isso não modifica o MeshAgent LAB previamente assinado e não autoriza usar os binários gerados com falha. Não houve nova distribuição nesta etapa.
- Inventário e séries da frota usam dados reais do banco. Zero amostras detalhadas de Windows recebidas no momento da verificação; o instalador 0.6.0 existente ainda não contém este coletor.

Comandos reproduzíveis (na raiz do repositório, ferramentas instaladas):

```bash
JAVA_HOME="$PWD/.tools/java" .tools/apache-maven-3.9.11/bin/mvn -f backend/pom.xml test
python3 scripts/test-monitoring-postgres.py
npm --prefix frontend run build
npm --prefix frontend run test:e2e
.tools/dotnet/dotnet build desktop/UaiSuporte.App/UaiSuporte.App.csproj
.tools/dotnet/dotnet run --project desktop/Monitoring.Tests
.tools/dotnet/dotnet run --project desktop/Transport.Tests
.tools/dotnet/dotnet run --project desktop/Setup.Tests
npm --prefix infra/mesh test
python3 scripts/verify-lab.py
UAI_TEST_ORIGIN=https://suporte.internal node scripts/verify-lab-wss.cjs
```

Logs locais desta rodada: .tools/monitoring-results (fora do Git). Nenhum teste instalou componentes nos Windows. Falta publicar um pacote LAB integrado após a validação acordada e executar os testes reais de coleta, reconexão, persistência, consentimento e encerramento entre dois Windows. O sistema não está homologado.

## Revisão visual da página inicial — 30/10/2026

A pedido do usuário, o painel passou a usar tema claro, a imagem original da marca Uai e navegação lateral. A visão geral apresenta total cadastrado, online e offline, com a lista paginada abaixo. Os gráficos da frota foram retirados da navegação inicial; métricas individuais continuam disponíveis nos detalhes, e a coleta/retencão não foi alterada. Busca, filtros, edição, ativação e permissões continuam integrados. Nenhum instalador Windows foi modificado por esta revisão web.


## Ajuste posterior: monitoramento geral, ações e tema
A orientação posterior do usuário concentra gráficos na Visão geral: disponibilidade online/offline e médias de CPU/memória, com períodos selecionáveis e atualização em 30 s. A aba Computadores tem apenas a lista, busca, filtros e paginação. Ativar computador e a opção de recuperação no menu ficam nessa aba, com autorização administrativa. A seta oferece detalhes, conexão autorizada, cópia do código e recuperação de cadastro revogado. Não se revoga automaticamente um dispositivo ativo para emitir token.
O tema claro/escuro é escolhido no cabeçalho e persistido localmente como preferência não sensível. Métricas atuais, armazenamento e histórico permanecem nos detalhes, sem os gráficos individuais. API, retenção, autorização e ciclo de sessão não foram alterados. A publicação é apenas web.
