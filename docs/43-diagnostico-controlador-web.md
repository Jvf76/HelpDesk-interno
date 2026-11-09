# Diagnóstico do controlador web — 09/11/2026

## Evidência

Na tentativa c0930fca-d0ab-47d8-a6ff-fa106ae9243d, o usuário confirmou que só
apareceu o aceite do Uai Suporte; a confirmação nativa não apareceu.
O serviço registrou aceite às 14:28:05 UTC e SESSION_ENDED às 14:28:11 UTC.
O backend já havia encerrado às 14:28:08 UTC. Relay: CONNECTING, SERVER_STOP,
zero mensagens em ambos os sentidos, sem consentimento nativo e sem frame.

A coleta de eventos de término de processo exibiu saída zero e sessão zero,
mas a consulta direta dos processos mostrou motor PID 8660 na sessão 1,
consistente com MOTOR_PLACEMENT. Não usar essa divergência para afirmar que
o motor principal atual esteja na sessão 0. Não houve evento Application/1000
encontrado no intervalo consultado da tentativa anterior.

Duas instâncias UaiSuporte apareceram na mesma sessão. Program.Main possui mutex
e a instância secundária pode estar apenas na mensagem de aplicativo já aberto,
antes da criação de ReceiverWindow. Isso não prova supervisão concorrente.

## Alteração

O painel passa a registrar, na sessionStorage da aba, até 30 eventos contendo
somente UUID, data UTC e código de uma lista fechada. Não grava resposta da API,
URLs, cookie, token, nome de usuário, conteúdo da tela ou mensagem de exceção.
O botão Copiar diagnóstico exporta somente os campos permitidos e valida os
horários. Uma nova tentativa substitui o histórico local da anterior.

Os eventos distinguem solicitação, launch, falha de polling, estado bloqueado,
fechamento do componente React, erro do viewer, primeiro desenho e desconexão.
Fechamento WebSocket é classificado em 1000, 1006 ou outro, sem exportar o texto
reason. VIEWER_STOP não é rotulado USER_STOP: o próprio viewer também pode parar
por expiração. Falta de storage nunca muda autorização ou fluxo da sessão.

O callback original de fechamento do SDK continua sendo chamado. Erro não
tratado do viewer bloqueia a exibição e solicita encerramento; nenhum erro é
usado para autorizar conexão. Consentimento e timeouts não foram ampliados.

## Validação

- Build TypeScript/React concluído.
- Três testes de diagnóstico: limitação, lista permitida, armazenamento
  indisponível e exportação sem campos arbitrários/segredos.
- 69 verificações Playwright do painel com API simulada, incluindo cópia do
  diagnóstico e ausência do cookie de bootstrap na exportação.
- Viewer web com WSS simulado: desenho JPEG, VIEW/CONTROL, monitores, parada,
  timeouts e callbacks de fechamento 1000/1006/1008, sem copiar reason.
- Smoke do adaptador legado publicado: inicialização sem erro JavaScript e
  criação de socket simulado. Não substitui a prova no navegador Windows.

Backup da publicação em .tools/relay-20261109/www-before-client-diagnostic.
Frontend e pequenos hooks de diagnóstico do viewer legado foram publicados;
backend/relay, Windows e instalador não foram alterados nesta entrega.
A causa da desconexão atual ainda não está confirmada. Próxima prova deve usar
o diagnóstico do controlador para identificar o primeiro evento de fechamento.
