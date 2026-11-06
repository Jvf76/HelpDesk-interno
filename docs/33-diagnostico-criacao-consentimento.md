# Diagnóstico da criação do diálogo nativo — preparado, não implantado

## Evidência e limite da conclusão

O operador confirmou que a interface Uai e o console estão na mesma sessão
interativa. A consulta IsProcessInJob retornou True para o MeshAgent da sessão 0.
Isso prova associação a algum Job Object, não revela suas flags, não identifica
esse objeto e não comprova o motivo de uma falha de CreateProcessAsUser.

ManagedMesh.cs atribui o motor, ainda suspenso, a um Job Object com
KILL_ON_JOB_CLOSE e sem liberação de processos filhos. A documentação Microsoft
exige mesma sessão entre os processos associados a um job:
https://learn.microsoft.com/pt-br/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject

Há uma hipótese concreta de conflito ao iniciar o helper interativo em outra
sessão. Ainda é necessário capturar a criação/falha real. Não remover o Job Object,
não habilitar breakaway e não alterar consent=72 para tentar provar a hipótese.
A fonte de referência dos módulos internos do MeshAgent não comprova equivalência
com todos os módulos do binário legado assinado.

## Instrumentação v2

A falha síncrona em kvm_consent_ask agora registra CREATE_FAILED e relança
exatamente a mesma exceção. Uma rejeição da promise registra PROMISE_REJECTED
antes de continuar a rotina original. Nenhuma aprovação é criada.

REQUESTED, HELPER_CREATED, HELPER_READY, RESPONSE_ACCEPTED/REJECTED permanecem.
Se user-sessions não estiver disponível, campos de sessão ficam -1 em vez de
silenciar todo o registro. HELPER_READY não prova janela visível.

Os registros incluem UUID, tipo de evento, sessão/PID quando disponíveis e
somente uma lista fechada de tipos e códigos numéricos de erro. Não incluem
message, stack, URLs, cookies, tokens ou parâmetros de execução.
numericCode=-1 significa código indisponível/não permitido. codeField registra
qual propriedade forneceu o código. Um valor 5 em uma propriedade arbitrária
não deve ser classificado automaticamente como Win32 ERROR_ACCESS_DENIED.
Não interpretar PROMISE_REJECTED, isoladamente, como recusa humana: pode ser
timeout/falha nativa. Até 64 diagnósticos por tentativa são aceitos pelo logger.
Eventos não mudam consentAt, estado, prazo, entrada, barra ou transmissão.

## Preparação restrita

O comando node scripts/prepare-native-consent-diagnostic.mjs LIVE_PACKAGE NEW_OUTPUT
lê MeshCentral 1.3.1, exige igualdade entre os dois cores servidos e produz:
- candidate: agents/meshcore.js, agents/meshcore.min.js, uai-session.cjs e
  uai-native-diagnostics.cjs;
- backup dos arquivos anteriores;
- manifest.json com hashes anteriores/posteriores e PREPARED_NOT_DEPLOYED.

O script não reinicia serviços nem escreve no runtime live. Recusa sobrescrever
um pacote de revisão e recusa saída dentro do runtime. O relay existente recebe
somente o hook de log: conserva versão de capability, consentimento e deadlines.

Esta preparação não implanta V10/V11, /trace, correções da interface ou o novo
contador de 60 segundos. Serve apenas para esclarecer a falha nativa. Não usar
uma prova com servidor antigo para homologar a versão candidata completa.

## Implantação pendente de autorização

O MeshCentral distribui o core JavaScript aos agentes conectados. Isso altera
um componente executado nos Windows, mesmo sem novo EXE/instalador.
Por isso a implantação deve ser autorizada explicitamente, conforme a restrição
do operador; não é apenas uma mudança local na VM.

Antes de aplicar: conferir os hashes live contra o manifesto, identificar os
agentes conectados e confirmar o escopo autorizado; garantir ausência de sessões
remotas ativas. Interromper se houver outro computador fora do escopo.
Parar somente uai-lab-mesh.service, aplicar os quatro arquivos por troca atômica
e iniciar o serviço. Não tocar em banco, credenciais, TLS, Nginx, backend ou
executável assinado. Não executar MeshAgent separadamente.

Rollback: parar o mesmo serviço, restaurar cada backup cujo hash anterior está
no manifesto e remover somente o módulo novo se ainda tiver o hash esperado.
Reiniciar e verificar saúde; conferir entrega do core anterior após reconexão.
Uma falha de atualização pode exigir reconexão do agente: não prometer rollback
instantâneo em Windows offline. Manter o instalador LAB 0.8.0 inalterado.

Depois, conduzir uma tentativa de visualização, uma ação por vez, correlacionada
pelo UUID. Parar no primeiro erro. Somente a criação/resposta observada poderá
confirmar ou descartar a hipótese do Job Object.

## Verificações executáveis

Testes Node: callbacks nativos preservados; falha síncrona registrada sem texto
sensível e relançada; campos ausentes desconhecidos; logger limitado; tentativa
encerrada não reativada; relay legado recebe somente hook; idempotência e
rejeição de fonte incompatível. Exportador sanitizado mantém apenas campos
permitidos. Esses testes não executam Windows nem comprovam o erro do helper.
