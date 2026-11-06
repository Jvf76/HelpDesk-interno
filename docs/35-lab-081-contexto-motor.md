# LAB 0.8.1 — correção candidata do contexto Windows do motor

## Evidência que motivou a mudança

Na tentativa real de 06/11/2026 às 12:25 de Brasília, o aceite Uai e o transporte
foram registrados. A instrumentação v3 capturou, no mesmo UUID:

```
REQUESTED: engineSession=0, consoleSession=3, targetSession=-1
CREATE_FAILED: failureStep=CLASSIC_CREATE, errorShape=string,
               errorCategory=CHILD_EXEC_FAILED
fechamento: lastState=AWAITING_CONSENT, nativeConsentGranted=false,
            privacyBar=false, firstFrame=false
```

Isso comprova falha de execução do filho usado pela rotina clássica do diálogo,
antes de qualquer confirmação nativa. Não é evidência de usuário recusando, de
timeout nem de imagem recebida. O relay encerrou com CONSENT_MISSING; o backend
registrou REQUESTER_STOP. Isso não comprova um clique humano em Encerrar. Os dois
registros devem ser preservados, sem substituir um pelo outro.

A implementação anterior iniciava o MeshAgent como SYSTEM na sessão 0, dentro
de um Job Object com KILL_ON_JOB_CLOSE. A referência do message-box tenta criar
um filho na sessão interativa quando esta é diferente. O Windows documenta que
todos os processos de um job devem pertencer à mesma sessão. Além disso, o
executável e os dados do motor estão em pasta com acesso apenas SYSTEM/admin.
Essas incompatibilidades existem no desenho atual; o wrapper legado não informou
o código Win32 da falha, portanto não se pode atribuir a ocorrência exclusivamente
a uma delas ou alegar um ERROR_ACCESS_DENIED observado.

## Correção implementada

O serviço corporativo permanece SYSTEM na sessão 0, com heartbeat, DPAPI, métricas,
IPC autenticado e supervisão. Apenas o processo do motor recebe uma cópia do token
SYSTEM do próprio serviço, com o ID da sessão interativa previamente autenticada.
Ele inicia suspenso em winsta0\default, sem herdar handles, e é associado ao job
antes de executar. Em Windows moderno, o job novo assume a sessão de seu primeiro
processo. Os auxiliares nativos podem então permanecer na mesma sessão e no mesmo
job. O processo continua usando a pasta privada original; seu executável assinado,
hash, chaves e identificação não são substituídos.

Fontes primárias para o contrato Windows:
- [CreateJobObjectW: sessão do primeiro processo e KILL_ON_JOB_CLOSE](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-createjobobjectw).
- [AssignProcessToJobObject: herança e mesma sessão](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject).
- [CreateProcessAsUserW: token, desktop e handles entre sessões](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessasuserw).

Proteções mantidas:
- consent=72 e decisão nativa, sem cache de autoaceite;
- job sem BREAKAWAY ou SILENT_BREAKAWAY, handle não herdável;
- LocalSystem obrigatório para duplicar a própria identidade; nenhum token do
  funcionário, senha ou segredo transmitido pelo IPC;
- privilégio temporário SeTcb restaurado após ajustar a cópia do token;
- executável fixo, caminho absoluto, hash e Authenticode antes de execução;
- sessão positiva e única, interface autenticada, lease e sessão reconferidos
  antes de criar, associar e executar; falha elimina o processo suspenso;
- troca de sessão, saída/travamento da interface ou perda do indicador provocam
  parada; o serviço fecha o job para interromper o motor e seus descendentes;
- nenhum alargamento de ACL, liberação de dados privados ou mudança do código
  público; novo código só altera o contexto de execução do motor autorizado.

Os processos auxiliares do consentimento podem executar como SYSTEM na sessão
interativa. Esse é um limite de privilégio importante: não adicionar navegação,
comandos arbitrários ou acesso não assistido a esses processos. Os diálogos do
motor continuam sendo os existentes; a interface Uai não é elevada por esta mudança.
Não anunciar suporte a UAC, login, sessão bloqueada ou múltiplas sessões ativas.

## Instalação e retorno

Candidato LAB Windows x64, não homologado. Atualizar pelo instalador unificado
sobre a versão existente; não desinstalar nem reativar para testar esta correção.
O caminho de upgrade preserva armazenamento DPAPI, Mesh DB, código público e ID.
Ele verifica o MeshAgent instalado e mantém a transação/rollback anteriores.
Aplicativo, serviço, React incorporado, .NET autocontido, WebView2 privado,
MeshAgent LAB assinado, CA, hosts e desinstalador continuam no mesmo pacote.
O instalador LAB permanece sem Authenticode; não desabilitar proteções do Windows.

Logs adicionais: MOTOR_PLACEMENT com PID/sessão do motor e sessão autorizada;
MOTOR_START_FAILED com etapa fixa e código Win32 capturado imediatamente pela
API que falhou. Esses logs não contêm caminhos, linhas de comando ou credenciais.
O UUID da tentativa continua nos eventos UAI_NATIVE_CONSENT do motor.

## Testes e pendências

Service.Tests simula falhas de criação, associação e resume, sessão errada, lease
ausente e mudança de sessão em cada ponto. Confere criação suspensa, associação
antes de resume e aborto em caso de erro. Compilar em Linux não executa essas
APIs Windows. Na VM Linux: 159 verificações de política do serviço, 48 do
instalador, 38 de transporte e 67 de agendamento de métricas passaram, além de
7 testes da instrumentação do consentimento. O React e as publicações .NET x64
compilaram. Os testes do instalador cobrem políticas, extração segura e
sanitização; não executam atualização, rollback ou desinstalação no Windows.
DPAPI, SCM, token SYSTEM na sessão interativa, herança real do job,
diálogo nativo, primeiro frame e corte local precisam de prova no Windows.

Este candidato corrige o receptor. O servidor LAB mantém o relay legado com o
complemento diagnóstico v3; ele ainda não aplica V10/V11 ou o novo contador de
60 segundos a partir de ACTIVE. A prova inicial é diagnóstica. Não usar esse
ambiente misto para homologar duração, estado visual, controle ou acesso completo.
A implantação coordenada do servidor continua necessária antes dessa homologação.

Conduzir uma ação por vez: conferir pacote → atualizar receptor → conferir mesmo
código e versão → solicitar visualização → aceitar Uai → observar e aceitar
diálogo nativo → verificar primeiro frame → encerrar localmente. Parar no primeiro
erro e coletar somente dados sanitizados daquele UUID. Controle será uma nova
tentativa após a imagem comprovada, com o servidor compatível.
