# Conexão direta e monitores — 09/11/2026

## Tentativa real após a correção de alinhamento

UUID: e27d74a7-cf0d-4c8f-b42a-dc13779242c4.
Horários UTC: solicitação 13:51:27; consentimento nativo 13:51:39.654;
primeiro tile reconhecido 13:51:39.808; término 13:51:40.256.
Relay: lastState ACTIVE, firstFrame=true, nativeConsentGranted=true,
privacyBar=true, kvmFailure=null, reason DISCONNECTED. Backend: REQUESTER_STOP.

O erro de parsing anterior não apareceu nesta tentativa. Agora há evidência
automática de frame no relay, mas o canal desconectou aproximadamente 448 ms
depois. Não atribuir essa desconexão ao timeout ou ao botão do usuário sem
correlacionar os registros do receptor. Foi solicitado somente o trecho
sanitizado do serviço Windows referente ao UUID e aos eventos de corte local.
A causa dessa nova desconexão permanece pendente.

## Fluxo e seleção de monitores

O clique Conectar na lista/detalhes monta o atendimento e envia uma única
solicitação. Não exige outro Conectar nem Abrir visualizador. O launch ocorre
após o consentimento Uai; a confirmação nativa permanece obrigatória. Resposta
tardia de cadastro/launch não pode reabrir atendimento fechado pelo solicitante.

O seletor Monitor usa onDisplayinfo/GetDisplayNumbers/SetDisplay do SDK existente.
Mostra somente IDs informados pelo motor, incluindo Todos os monitores quando
65535 estiver disponível. Não inventa telas, não executa comandos remotos e
não altera a permissão VIEW/CONTROL. A interface faz consulta de monitores ao
receber confirmação de ativação; o adaptador legado do laboratório a faz após
o primeiro desenho. Sem monitores enumerados, a seleção permanece indisponível.

## Testes e implantação

Build React/TypeScript aprovado. 67 verificações da interface administrativa com
API simulada, incluindo conexão automática, ausência do botão intermediário,
iframe preservado ao entrar em ACTIVE e rejeição de launch tardio após parada.
Testes Playwright do visualizador incorporado e web: JPEG sintético desenhado,
VIEW sem entrada, CONTROL com entrada após autorização, seleção do monitor 2
por comando nativo e parada limpando canvas/socket. Não são sessões Windows reais.

Painel publicado com backup em .tools/relay-20261109/www-before-flow. HTTPS
verificado com a CA do laboratório e validação habilitada. Backend, banco,
MeshAgent, serviço Windows e instalador não foram alterados nesta entrega.

O visualizador publicado mantém o ciclo legado compatível com o relay atual;
somente recebe a integração de monitores. O viewer do código-fonte exige o
ACK de renderização da revisão nova e não foi copiado integralmente sobre o
legado. A máquina de estados/60 segundos ativos continua pendente de implantação
coordenada. Não declarar essa infraestrutura nova ativa no laboratório.

Pendente: diagnóstico da desconexão real, estabilidade de imagem/controle,
troca de telas em Windows com vários monitores e corte local com backend
indisponível. Não houve novo instalador nem homologação do atendimento.
