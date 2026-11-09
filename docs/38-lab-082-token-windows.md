# LAB 0.8.2 — preparação do token do motor Windows

## Evidência real de 09/11/2026

O operador concluiu a reinstalação e ativação do LAB 0.8.1. O log do serviço
registrou SERVICE_START às 11:56:58 UTC, DEVICE_ACTIVATED às 11:58:10 UTC e,
a partir de 11:58:10.249 UTC, falhas repetidas:

```
MOTOR_START_FAILED {"stage":"TOKEN_SESSION_SET","win32Code":5,"targetSession":1}
```

O código 5 é acesso negado. A falha ocorre em SetTokenInformation(TokenSessionId),
antes de CreateProcessAsUser, associação ao job, diálogo nativo ou captura.
Não há uma sessão remota/UUID a correlacionar nessa etapa de inicialização.
Ativação concluída não significa motor em execução. As retentativas observadas
de aproximadamente 5, 10, 20, 40, 80, 161 e 300 segundos confirmam backoff neste
caso, sem demonstrar o funcionamento de imagem ou controle.

## Diagnóstico e limite da conclusão

O código 0.8.1 duplicava o token antes de habilitar SeTcbPrivilege. A documentação
Microsoft explica que direitos como TOKEN_ADJUST_SESSIONID são condicionados ao
privilégio do chamador durante a duplicação. Entretanto, LocalSystem normalmente
já possui SeTcbPrivilege habilitado. Portanto, a ordem inadequada é um defeito do
contrato, mas não prova sozinha a causa desse erro real. O log 0.8.1 não mediu os
direitos efetivamente concedidos ou o estado anterior dos privilégios.

O handle antigo solicitava 0x10B: QUERY, DUPLICATE, ASSIGN_PRIMARY e
ADJUST_SESSIONID. A referência de compatibilidade do ReactOS verifica acesso
combinado ADJUST_DEFAULT e ADJUST_SESSIONID para esse ajuste. Isso sustenta a
correção candidata da máscara, mas não representa inspeção do kernel do Windows.
Nenhum código do ReactOS foi incorporado; apenas o contrato de acesso foi
comparado. A prova de sucesso depende da próxima execução no Windows autorizado.

Fontes:
- [Microsoft: direitos na duplicação de token](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-zwduplicatetoken).
- [Microsoft: acesso a tokens](https://learn.microsoft.com/en-us/windows/win32/secauthz/access-rights-for-access-token-objects).
- [Microsoft: LocalSystem e privilégios iniciais](https://learn.microsoft.com/en-us/windows/win32/services/localsystem-account).
- [Microsoft: CreateProcessAsUser e privilégios do chamador](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessasuserw).
- [ReactOS: referência de compatibilidade de NtSetInformationToken](https://github.com/reactos/reactos/blob/master/ntoskrnl/se/tokencls.c).

## Alteração candidata

O serviço LocalSystem habilita temporariamente os privilégios já presentes
SeTcbPrivilege e SeAssignPrimaryTokenPrivilege antes de duplicar sua própria
identidade. Solicita explicitamente QUERY, DUPLICATE, ASSIGN_PRIMARY,
ADJUST_SESSIONID, ADJUST_DEFAULT e ADJUST_PRIVILEGES (0x1AB).
ADJUST_PRIVILEGES permite restaurar na cópia o estado original dos privilégios,
evitando que o motor herde os habilitados apenas para preparar seu token.

O serviço ajusta e confere a sessão interativa, restaura os privilégios originais
do chamador e só então devolve a cópia para iniciar o processo suspenso. Em erro,
tenta restaurar todos os estados alterados e descarta a cópia. Falha de restauração
também impede iniciar o motor. O token não é uma credencial de ativação e não é
persistido ou transmitido pelo IPC.

Não há TOKEN_ALL_ACCESS, MAXIMUM_ALLOWED, WRITE_DAC, WRITE_OWNER, token de outro
processo, alteração de ACL ou concessão de privilégios a contas. O serviço
permanece na sessão 0; a interface deve estar autenticada na sessão ativa.
Consentimento 72, assinatura/hash, TLS, proteção DPAPI, job sem breakaway,
indicador e corte local permanecem obrigatórios.

MOTOR_START_FAILED passa a incluir somente a máscara solicitada e dois booleanos
indicando privilégios inicialmente habilitados. Isso não revela tokens,
credenciais, handles, linhas de comando ou conteúdo de tela.

O instalador também inclui a correção de diagnóstico descrita no
[documento 37](37-falha-atualizacao-081.md): etapas de atualização e HRESULT
original preservado, inclusive durante rollback. A ordem de instalação,
preservação de identidade e rollback não foi alterada por essa instrumentação.

## Testes e validação pendente

Service.Tests exercita a política usada pelo código nativo com falhas injetadas:
habilitação parcial, duplicação, restauração na cópia, ajuste/leitura da sessão,
restauração do chamador, sessão incorreta e descarte obrigatório. Também verifica
estados de privilégios inicialmente habilitados/desabilitados e um modelo de
erro 5 para ordem/máscara antigas. Esse modelo não executa APIs Windows.

São necessários testes reais de preparação do token, processo na sessão correta,
diálogo nativo, primeiro frame, controle e corte local. Não há homologação remota.
O servidor continua com relay legado e diagnóstico v3; a máquina de estados nova
e o contador ativo precisam de implantação coordenada antes da prova completa.

## Atualização de laboratório

Instalador único Windows x64, LAB sem assinatura própria, com o mesmo MeshAgent
assinado e aprovado. Preservar os pacotes anteriores. Atualizar sobre 0.8.1 sem
desinstalar ou consumir outro token; verificar que o código público e o cadastro
continuam iguais. Preservação/rollback no Windows ainda exigem validação.

Conduzir uma ação por vez: copiar e conferir SHA-256, conferir espaço e identidade,
atualizar pelo assistente, ler MOTOR_PLACEMENT ou MOTOR_START_FAILED. Parar no
primeiro erro. Não executar MeshAgent isoladamente nem desabilitar proteções.
