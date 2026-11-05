# Consentimento nativo pendente: diagnóstico e correção de apresentação

A tentativa real de 05/11/2026 foi examinada por seleção explícita de campos no
PostgreSQL, journal do relay e eventos MeshCentral. Evidência individual e UUID
ficam fora do Git, na entrega privada de diagnóstico na VM.

## O que está comprovado
Solicitação CONTROL, aceite Uai e emissão da autorização aparecem na auditoria.
O registro final do relay contém AWAITING_CONSENT, protocolRequested=true,
nativeConsentRequested=true, nativeConsentGranted=false, privacyBar=false e
firstFrame=false. O término foi DISCONNECTED no relay e REQUESTER_STOP no banco.
Não foi registrado timeout nesta tentativa.

A confirmação nativa é a última etapa pendente. Não houve comprovação de
AWAITING_FIRST_FRAME nem FIRST_FRAME_RECEIVED. RTT não comprova captura.
peerPaired=false foi registrado durante fechamento: não prova ausência de
pareamento anterior. Não inventar horários intermediários que não foram gravados.

O backend em execução tinha migrations somente até V9; sua classe
SessionController não continha /{id}/trace. O receptor informou 0.8.0.0, mas o
servidor não tinha a instrumentação correspondente. O código novo em disco e o
instalador não constituem prova de implantação do servidor. V10/V11 não recuperam
retroativamente transições ausentes. Não houve implantação durante esta análise.

A política live exige p=2 e consent=72 ao registrar o compartilhamento.
O evento de compartilhamento foi registrado para a tentativa. A emissão é
consistente com essa política, mas não houve captura do cookie ou do transporte
para alegar inspeção independente de seus campos. Não coletar esses segredos.

## O que permanece desconhecido
PID e sessão Windows do helper, sua criação/exibição, seleção do usuário
interativo e resposta local. Não afirmar sessão 0 a partir do serviço estar na
sessão 0. Sem os registros Windows, não distinguir falha de exibição, seleção
de sessão, falha do helper ou resposta não processada.
Os eventos MeshCentral dessa tentativa não confirmam aceite/recusa nativos.

Próximo passo mínimo: coletar somente UAI_LOCAL_CONSENT, UAI_LOCAL_TRANSITION
e UAI_NATIVE_CONSENT do service.log / service.log.1 no computador acessado,
filtrando pelo UUID e exportando apenas campos permitidos. Parar no primeiro erro.
Não solicitar logs brutos, credenciais .bin, tokens, cookies ou chaves.

## Correção implementada no código, ainda não implantada
- Abrir visualizador mostra controle/visualização solicitados, nunca autorizados.
- ENGINE_CONSENT_PENDING: Aguardando confirmação no computador acessado.
- AWAITING_FIRST_FRAME: Acesso autorizado — aguardando imagem.
- VIEWING: Visualização ativa. CONTROLLING: Controle ativo.
- Desenhar um frame envia a confirmação de renderização, mas não libera entrada.
- Somente metadado de ativação emitido pelo relay, após renderização, consentimento
  e barra, libera CONTROL; VIEW não libera entrada.
- O SDK emite key-up ao receber tamanho de tela, mesmo com stopInput=true.
  O adaptador agora filtra também os pacotes de saída do SDK, além dos handlers.
- Ack prematuro, atrasado após stop ou com prazo inválido não ativa a interface.
- RTT/qualidade atualizam diagnósticos sem alterar estado.
- Expiração nativa tem erro específico no visualizador, painel e backend.
- consent=72, confirmação local, timeouts e política do motor preservados.

## Testes e limites
Playwright usa codec real, JPEG sintético e WSS simulado: entrada bloqueada antes
da imagem e antes do ack, VIEW sem entrada, CONTROL somente após ack, parada
limpando canvas e bloqueando ack tardio, RTT sem falsa ativação, prazo nativo.
Backend verifica ENGINE_CONSENT_TIMEOUT e ausência de started_at quando expira.
Esses testes não comprovam captura nem diálogo em Windows real.
Nenhum instalador foi gerado nesta correção; o LAB 0.8.0 entregue permanece
inalterado. Não usar a correção visual como evidência de resolução do bloqueio.
