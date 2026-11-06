# Entrega diagnóstica LAB 0.8.1 — 06/11/2026

## Tentativa examinada

UUID `222013a1-efab-49ff-82bf-709d44ba298b`. Horários abaixo em UTC,
obtidos do backend e da instrumentação do motor/relay. Não há primeiro frame
comprovado nem execução bem-sucedida do diálogo nativo nesta tentativa.

| Horário | Evidência |
| --- | --- |
| 15:25:05.435 | Auditoria SESSION_REQUESTED, modo CONTROL |
| 15:25:11.190 | Auditoria LOCAL_CONSENT |
| 15:25:14.409 | Auditoria REMOTE_LINK_ISSUED |
| 15:25:14.669 | Nativo REQUESTED: motor na sessão 0, console na sessão 3, destino −1 (seleção automática) |
| 15:25:14.683 | CREATE_FAILED: CLASSIC_CREATE / CHILD_EXEC_FAILED; o wrapper retornou texto, sem código Win32 |
| 15:25:24.572 | Backend encerrou com REQUESTER_STOP |
| 15:25:24.575 | Relay: CONSENT_MISSING; último estado AWAITING_CONSENT; consentimento nativo, barra e primeiro frame ausentes |

Última etapa comprovada: canal solicitado e espera da confirmação do motor.
Não houve avanço comprovado para AWAITING_FIRST_FRAME. Não interpretar RTT como
captura nem REQUESTER_STOP como prova de um clique humano. O endpoint de trace
da implementação nova não está implantado nesse backend; não foi usado como se
estivesse disponível.

A falha comprovada é a criação do auxiliar nativo. Conflito entre sessões do
Job Object e acesso à pasta privada são problemas encontrados no código. O
wrapper antigo não permite distinguir qual erro Win32 ocorreu. A alteração
candidata e as fontes primárias estão no [documento 35](35-lab-081-contexto-motor.md).

## Artefato

- Nome: `UaiSuporte-Setup-0.8.1-Lab.exe`.
- Caminho: `/home/agenda/uai-entregas/UaiSuporte-Setup-0.8.1-Lab.exe`.
- Tamanho: **533989724 bytes** (aproximadamente 509,3 MiB).
- SHA-256: `25013BDF33E2276C549B6BDE30B8CECE60927EB13A44B7C45228E04E0765E638`.
- Instalador LAB sem Authenticode próprio; não é distribuição definitiva.
- MeshAgent incorporado inalterado: SHA-256
  `4CB9AAB0E6F9D90249F29BF15E46E66C702A282BC9F991BBB9B6EF0B78478019`.
  Sua assinatura LAB foi validada anteriormente pelo operador no Windows; esta
  compilação não substitui uma nova verificação de confiança no computador alvo.

Mantidos aplicativo, serviço, React incorporado, .NET autocontido, WebView2 privado,
MeshAgent, CA específica, avisos legais, desinstalador e transação de atualização.
O caminho existente de atualização preserva identidade e dados DPAPI. Atualização,
rollback e preservação real desses dados continuam sujeitos à prova no Windows.
Não desinstalar nem emitir novo token para esta prova de atualização.

## Verificações executadas na VM Linux

| Verificação | Resultado |
| --- | --- |
| Políticas do serviço, incluindo falhas no lançamento suspenso/sessão/job | 159 passaram |
| Políticas do instalador, extração, CA/hosts e sanitização | 48 passaram |
| Políticas de transporte/autenticação local | 38 passaram |
| Agendamento/backoff de métricas | 67 passaram |
| Instrumentação do consentimento nativo | 7 passaram |
| React/TypeScript e publicações .NET Windows x64 | Compilação concluída |
| Inno Setup | Compilação concluída; versão PE 0.8.1.0 |
| Assembly do receptor no payload | 0.8.1.0, com InteractiveSystemToken, InteractiveLaunch e MeshLaunchPolicy |
| Recursos incorporados | Hashes do payload, MeshAgent e CA conferidos; 24 recursos locais React/viewer/ícone conferidos |
| Arquivos de identidade/ativação no payload | Ausentes |
| Instaladores 0.6.0 e 0.8.0 já entregues | Preservados e hashes reconferidos |

Os testes são de política e compilação; não executam CreateProcessAsUser,
DPAPI, SCM, ACLs ou interfaces Windows. Nenhuma instalação foi feita remotamente.
Não houve implantação de backend, banco ou frontend nesta entrega. O servidor
continua com relay legado e instrumentação v3; os novos estados/contador ativo
precisam de implantação coordenada antes de validar o fluxo completo.

## Próxima prova

Entregar **somente a cópia e conferência do hash**, sem executar o instalador.
Depois, conduzir atualização manual do computador acessado, confirmação do mesmo
código público, presença e versão. Solicitar VIEW e verificar consentimentos Uai
e nativo, frame e parada local, uma ação por vez. Controle exige nova tentativa
após imagem comprovada e servidor compatível. Parar no primeiro erro.

Diagnóstico adicional em
`%ProgramData%\UaiTelecom\UaiSuporte\Service\service.log`:
`MOTOR_PLACEMENT` contém PID/sessões; `MOTOR_START_FAILED` contém etapa fixa e
código Win32. Logs do diálogo continuam correlacionados pelo UUID no servidor.
Não pedir credenciais, arquivos `.bin`, cookies ou linhas de comando completas.

Pendente: criação real na sessão interativa, diálogo nativo, herança do Job
Object, primeiro frame, controle, encerramento local e indisponibilidade do backend
em Windows autorizado. Acesso remoto ainda não homologado.
