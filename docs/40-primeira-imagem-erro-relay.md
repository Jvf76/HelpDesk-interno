# Primeira imagem e encerramento — 09/11/2026

Tentativa: `5f6d702b-417e-4e41-addf-5aa52a4df51d`. Horários abaixo em UTC.

| Horário | Evidência |
| --- | --- |
| 13:24:01 | Serviço: MOTOR_STARTED; motor e usuário na sessão 1; killOnJobClose=true |
| 13:24:20 | LOCAL_STOP_CONFIRMED, anterior à tentativa analisada |
| 13:24:30 | Backend: criação da tentativa CONTROL |
| 13:24:34 | Interface/serviço: UAI_LOCAL_CONSENT accept na sessão 1 |
| 13:24:37 | Motor: REQUESTED, HELPER_CREATED e HELPER_READY; auxiliar na sessão 1 |
| 13:24:42 | Motor: RESPONSE_ACCEPTED; backend registra engine_consent_at |
| 13:24:55 | Backend: REQUESTER_STOP; relay registra PROTOCOL_ERROR, nativeConsentGranted=true, privacyBar=true e firstFrame=false |
| 13:24:57 | Serviço: SESSION_ENDED |
| 13:24:58 | Motor reiniciado para receber novas solicitações |

O operador relatou imagem real por aproximadamente dez segundos. Isso é evidência
de visualização relatada no Windows, mas não prova controle, duração correta ou
encerramento local durante essa tentativa. O limite registrado era 13:25:37;
essa tentativa não chegou à expiração prevista.

O erro de TOKEN_SESSION_SET anterior à atualização deixou de ocorrer nessa
inicialização. O auxiliar nativo foi criado na sessão correta e respondeu.
Não solicitar nova ativação ou desinstalação para este erro do relay.

## Ponto confirmado e limite

O PROTOCOL_ERROR do relay é emitido pelo catch que envolve TileObserver.feed.
O observador não reconheceu um tile completo, embora o operador tenha visto
imagem. O navegador chama o endpoint genérico de parada após desconexão, que
registra REQUESTER_STOP. Esse resultado isolado não atribui clique ao operador.

Foi reproduzido em teste sintético um erro ao acrescentar bytes de alinhamento
após um tile. Não foi capturado conteúdo da tela real; portanto, padding,
fragmentação ou outra divergência de enquadramento continuam hipóteses, não
causa específica comprovada da tentativa real.

## Diagnóstico adicional instalado no servidor

patch-kvm-diagnostics.mjs adiciona somente um campo sanitizado kvmFailure ao
diagnóstico final. Valores possíveis: KVM_LENGTH_BELOW_HEADER,
KVM_LENGTH_ABOVE_LIMIT ou KVM_OBSERVER_EXCEPTION. Não registra bytes, imagens,
teclas, cookies, nomes ou credenciais. A rejeição e os limites existentes são
mantidos; não altera consentimento, permissões, prazos ou aceitação de pacotes.

O patch foi aplicado ao código-fonte e, separadamente, ao relay legado em
execução. Backup anterior em .tools/relay-20261109/uai-session.before.cjs.
Nenhuma sessão vigente no banco antes do reinício do MeshCentral. Backend,
frontend e instalador não foram substituídos. O servidor continua com o ciclo
legado; não confundir com a máquina de estados nova ainda não implantada.

Suíte Node: 35 testes, 34 aprovados, 1 ignorado, zero falhas. São testes de
política, protocolo sintético e sockets de loopback; não testes Windows reais.
Sintaxe do módulo implantado verificada. A próxima tentativa deve distinguir a
categoria da falha sem coletar conteúdo remoto. Não há correção de framing
declarada nem homologação do atendimento nesta etapa.
