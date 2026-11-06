# Falha na preparação do consentimento nativo — prova de 06/11/2026

## Resultado real e limites

Depois de corrigida a confiança da CA no navegador controlador, uma nova
tentativa chegou ao relay. A auditoria confirma solicitação, aceite Uai e emissão
da autorização. Os eventos MeshCentral confirmam início do relay e a execução da
instrumentação no motor Windows. A tentativa foi solicitada como CONTROL;
portanto, não classificá-la como uma prova concluída de visualização.

Horários de Brasília, com milissegundos disponíveis nos registros:

| Horário | Evidência |
| --- | --- |
| 11:55:28.963 | SESSION_REQUESTED |
| 11:55:34.902 | LOCAL_CONSENT |
| 11:55:38.698 | REMOTE_LINK_ISSUED |
| 11:55:39.132 | Evento MeshCentral de início do relay (msgid 15) |
| 11:55:39.189 | REQUESTED: engineSession=0, consoleSession=3, targetSession=-1 |
| 11:55:39.189 | CREATE_FAILED: errorKind=UNKNOWN, codeField=NONE, numericCode=-1 |
| 11:55:49.095–.297 | Encerramento CONSENT_MISSING no relay e backend |

O último estado comprovado foi AWAITING_CONSENT, equivalente à etapa conceitual
ENGINE_CONSENT_PENDING. Não houve AWAITING_FIRST_FRAME nem primeiro frame.
O relay registrou viewerAttached=true, protocolRequested=true,
nativeConsentRequested=true, nativeConsentGranted=false, privacyBar=false e
firstFrame=false. Houve quatro mensagens em cada direção; os conteúdos não
foram coletados. peerPaired=false no fechamento não contradiz o evento de início
do relay e não prova ausência de pareamento anterior.

CREATE_FAILED captura uma exceção síncrona dentro de kvm_consent_ask. Essa função
inclui a criação da mensagem, seleção do módulo, chamada de criação do diálogo e
registro de callbacks. A etiqueta, isoladamente, **não comprova falha em
CreateProcessAsUser**. Não houve HELPER_CREATED, HELPER_READY, PID de helper ou
resposta nativa registrados. Sessão 0 identifica o motor; não é evidência de que
uma janela foi criada na sessão 0. targetSession=-1 significa campo desconhecido,
não uma sessão de destino incorreta comprovada.

O conflito com o Job Object continua sendo hipótese. Falhas de módulo, parâmetros,
permissões ou criação do helper não foram distinguidas pelo diagnóstico v2.
O fechamento com CONSENT_MISSING é a decisão de proteção do relay; não foi
registrado timeout como motivo desta tentativa. Não concluir que um pacote
rejeitado era imagem: nenhum conteúdo foi retido.

## Complemento v3 implantado no LAB, aguardando nova tentativa Windows

O operador autorizou a continuidade dos diagnósticos e ajustes do laboratório,
reservando novas confirmações para ações críticas ou fora do escopo. O complemento
foi aplicado entre 15:14:22 e 15:14:31 UTC em 06/11/2026. Na conferência anterior
havia apenas o computador autorizado conectado, nenhum relay, compartilhamento
vigente ou sessão remota aberta. Somente o MeshCentral LAB foi reiniciado.

TLS/WSS autenticado, capacidades originais e rejeição de bootstrap inexistente
foram verificados. O agente reconectou e anunciou outra identificação de core.
Configuração, unidade de serviço, backend e executáveis protegidos permaneceram
inalterados. O recebimento de eventos 9102 e o resultado de uma nova solicitação
ainda dependem do teste Windows; a reconexão não comprova exibição do diálogo.
Registro privado: `.tools/native-consent-diagnostic-v3/deployment.json`.

O patch mantém as chamadas nativas, argumentos, promises, callbacks e exceções.
Adiciona uma etapa local antes de cada operação de preparação. Se ocorrer falha,
um evento 9102 exporta somente quatro valores enumerados:

- CREATE_FAILED;
- failureStep: notificação, texto, seleção do motor, módulo/criação clássica,
  imagem/promise aprimorada, associação da promise, pausa, handler ou callbacks;
- errorShape: tipo primitivo do erro;
- errorCategory: categoria fechada, quando a mensagem corresponde a um padrão
  conhecido; demais erros permanecem UNCLASSIFIED.

Mensagens, caminhos de executável, argumentos, credenciais e stack não são
exportados. A classificação CHILD_EXEC_FAILED apenas identifica a mensagem do
wrapper; não identifica qual API Win32 falhou nem recupera seu GetLastError.
Não consultar GetLastError depois de outras chamadas e apresentá-lo como causa.

Os padrões conhecidos vêm de referências públicas do MeshAgent:

- [Wrapper de child_process, commit 0e6b4f7](https://github.com/Ylianst/MeshAgent/blob/0e6b4f7fea6c88ad1978206550d202a7f33741c5/microscript/ILibDuktape_ChildProcess.c).
- [Implementação de criação de processos, mesmo commit](https://github.com/Ylianst/MeshAgent/blob/0e6b4f7fea6c88ad1978206550d202a7f33741c5/microstack/ILibProcessPipe.c).
- [child-container, referência pública](https://github.com/Ylianst/MeshAgent/blob/master/modules/child-container.js).

Essas referências não comprovam que o binário LAB contém exatamente o mesmo
código. Não houve análise nova de AnyDesk, execução isolada de MeshAgent,
recompilação do executável, remoção de Job Object ou autoaceite.

Pacote local de revisão: `.tools/native-consent-diagnostic-v3/review/`.
O manifesto contém candidatos e backups contra o runtime v2 em execução. O relay
uai-session.cjs é idêntico antes/depois; apenas o core diagnóstico e seu coletor
recebem o complemento. Os hashes live foram novamente conferidos após preparar.
A autorização para essa distribuição foi recebida e registrada acima. O runtime
agora serve o complemento v3; os backups v2 permitem reverter somente esta etapa.

## Validação

- Mesh/relay: 34 testes, 33 aprovados, um ignorado por ausência de fixture opcional
  Authenticode. Nenhuma falha.
- Sete testes de diagnóstico cobrem argumentos e callbacks preservados, falhas
  síncronas em etapas distintas, exceção original relançada, tipos primitivos,
  exclusão de caminhos/segredos, limite de eventos e impossibilidade de autorizar
  ou reativar sessões pelo evento diagnóstico.
- Exportador Python: campos novos permitidos, conteúdo desconhecido e segredos
  descartados.
- Preparação contra o runtime live: hashes, backups e sintaxe verificados.

Os testes de callbacks e sockets usam simulação controlada; não comprovam
exibição de diálogo, captura, controle ou encerramento local no Windows. O
complemento v3 ainda não produziu evidência real. Não gerar novo instalador para
mascarar essa pendência.

Evidências sanitizadas e UUID individual permanecem na pasta privada de entregas
da VM; não copiar logs brutos, cookies ou dados de tela para o Git.
