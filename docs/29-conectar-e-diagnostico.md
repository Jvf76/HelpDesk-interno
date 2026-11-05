# Conectar e diagnóstico — 2026-11-03

Painel web: botão Conectar solicita CONTROL; removidos seletor VIEW/CONTROL e rótulo Solicitar consentimento. O backend não foi alterado: consentimento local continua obrigatório, inclusive com possibilidade de conceder apenas visualização.

Visualizador: prazo de 20 segundos para receber a primeira imagem, após o qual socket/entrada/canvas são encerrados e o painel solicita encerramento no backend. Falha exibida sem credenciais. Não corrige, por si só, a origem de uma transmissão que não começa.

Evidência consultada no servidor: tentativa de 15:30:53 UTC encerrada às 15:31:43 UTC com LOCAL_STOP e started_at nulo; tentativa anterior encerrada com SESSION_CHANGED. Isso confirma recebimento de encerramento, não transmissão ou controle em Windows real. Não foi possível reproduzir captura sem os computadores Windows.

Código Windows: botão retira reconhecimento do indicador antes da chamada IPC e mantém retorno textual por dez segundos; serviço retorna erro se ManagedMesh.Stop não confirmar parada, preservando supervisão para nova tentativa. Mudanças ainda não empacotadas nem instaladas; LAB 0.7.1 preservado.

Validação VM: build React; suíte existente de interface passou; testes novos do controlador verificam pedido CONTROL sem seletor, estado aguardando consentimento e timeout sem primeiro frame com transporte simulado. Inventário: 59 verificações. App e serviço C# compilados sem erros/avisos. Windows nativo, captura, controle e interrupção real ainda pendentes.

Painel estático atualizado após backup em .tools/lab/backups/web-connect-20261103T154018Z; HTTPS e recurso do visualizador conferidos. Nenhum serviço Windows instalado ou alterado.

Próxima evidência necessária: somente últimas linhas de service.log na pasta ProgramData/UaiTelecom/UaiSuporte/Service. Não coletar identity.bin, setup.bin ou arquivos Mesh de credenciais. Diagnosticar ciclo de motor/presenter antes de gerar outro instalador.

## Diagnóstico do relay — 2026-11-04

Adicionado UAI_RELAY_DIAGNOSTIC no encerramento: UUID da sessão (não o identificador secreto do compartilhamento), estado anterior, motivo, associação dos canais, contagem limitada de mensagens, negociação do protocolo, consentimento nativo, barra e primeiro frame. Nunca conteúdo dos pacotes, cookie, URL, nome ou tela. Logs preservam a causa observável mesmo depois do timeout do navegador.

17 testes Mesh aprovados, 1 teste opcional ignorado. Teste novo verifica marcos e ausência de dados secretos/mensagem recebida no registro. Somente uai-session.cjs do servidor foi atualizado após backup e confirmação de zero sessões abertas; MeshCentral reiniciado. Nenhum meshcore.js ou executável Windows foi alterado. A causa da ausência de imagem permanece não confirmada até uma nova tentativa real produzir o diagnóstico.

## Evidência e teste de compatibilidade — 2026-11-05

As duas tentativas diagnosticadas terminaram em AWAITING_CONSENT, com protocolRequested e nativeConsentRequested verdadeiros, nativeConsentGranted/privacyBar/firstFrame falsos. O pareamento já havia sido desfeito ao registrar o encerramento; peerPaired=false nesse instante não significa que nunca houve pareamento (houve mensagens de ambos os lados). O bloqueio observado está no consentimento nativo após o aceite C#.

Configurado consentMessages.oldStyle=true, opção suportada pelo motor para usar message-box em vez de win-userconsent. Todos os autoAccept permanecem false. É um teste de compatibilidade: ainda não comprova qual falha do diálogo avançado impediu sua exibição nem garante captura. Não foram alterados executável assinado, meshcore ou credenciais Windows.

O navegador antes encerrava aos 20 s mesmo com prompt nativo de 30 s. Agora, quando recebe o evento nativo de espera pela primeira vez, concede 35 s limitados pela expiração da sessão, com rótulo explícito de confirmação adicional. Sem esse evento, permanece 20 s; nenhuma tela é aceita como ativa sem imagem.

18 testes Mesh aprovados, 1 opcional ignorado; testes do visualizador web/desktop com transporte simulado aprovados, incluindo prazo nativo e encerramento limitado. Build web e HTTPS validados. Servidor atualizado após zero sessões abertas e backup native-consent-20261105T134038Z. Não houve instalação ou execução remota no Windows.

Pendente: confirmar que diálogo padrão aparece e imagem flui. Depois substituir a duplicação por um único consentimento local autenticado e supervisionado, automatizar abertura da tela após aceite e simplificar aceitar/recusar, sem habilitar acesso não assistido.
