# Primeira sessão remota: estados, diagnóstico e prova pendente

## Situação desta entrega

Código instrumentado e testes controlados na VM Linux. Não houve instalação/alteração nos Windows, mudança da stack, nova engenharia reversa, atualização dos serviços de laboratório em execução ou geração de instalador. As alterações anteriores do workspace foram preservadas. O pacote de diagnóstico não é um instalador e não deve substituir arquivos de uma instalação Windows manualmente.

**Não está comprovado que o acesso remoto real foi corrigido.** A duplicação de consentimentos foi explicada no código; a ausência/conclusão do diálogo nativo e o fluxo de captura/controle precisam de Windows real. A análise AnyDesk permanece encerrada e fora deste trabalho.

## Diagnóstico antes da alteração

Os 13 testes anteriores do relay passaram. São simulações de protocolo; não reproduzem janelas nativas. A evidência operacional anterior, registrada em `29-conectar-e-diagnostico.md`, indicava `AWAITING_CONSENT`, protocolo solicitado e consentimento nativo solicitado, mas sem consentimento concedido, barra nativa ou primeiro frame. Não houve nova tentativa em dispositivo de empresa.

A cadeia confirmada pela leitura do código:

1. A interface C# envia a escolha local por IPC; o serviço envia `/api/agent/sessions/{id}/{decision}`.
2. `SessionService.decide` registra o consentimento local. Isso não resolve a promessa nativa do motor.
3. `MeshEngine.create` chama `createDeviceShareLink`, protocolo 2, validade de um minuto, `consent=72`. O valor é `8 | 64`: consentimento de desktop e barra nativa obrigatórios.
4. No `agents/meshcore.js` do MeshCentral 1.3.1, `kvm_consent_ask` emite console `msgid=1`, pausa o fluxo e aguarda `win-userconsent` ou `message-box` (opção suportada `oldStyle`).
5. `kvm_consentpromise_resolved` registra evento 30, emite console 0, cria a barra (evento 31; falha 32), conecta a saída KVM e retoma o fluxo. Recusa gera evento 34. Encerramento local nativo gera evento 29.

Referências locais consultadas: `.tools/mesh-current/package/agents/meshcore.js`, aproximadamente linhas 3215–3340 e 3772–3785; `MeshEngine.java`; `infra/mesh/patch-session.mjs`. Nenhuma alteração no meshcore ou no executável MeshAgent foi feita nesta etapa.

**Causa confirmada da segunda confirmação:** são duas políticas independentes e o aceite C# não é consumido como autorização pelo diálogo nativo. **Hipóteses ainda abertas para o bloqueio Windows:** janela nativa não apresentada na sessão esperada, falha do componente de diálogo, usuário sem acesso à janela, recusa/timeout, falha posterior da barra. Não é possível escolher uma dessas causas apenas com o log anterior.

Não foi localizada na integração inspecionada uma API suportada de aprovação externa por C#. Não foi usado autoaceite, cache de aceite, remoção de flags ou patch para resolver a promessa nativa. O fluxo LAB continua explicitamente em duas confirmações: escolha de permissão no Uai e confirmação nativa. **Um único diálogo integrado permanece uma limitação**, não uma funcionalidade concluída.

## Máquina de estados

`phase` é o estado de domínio persistido; `status` legado permanece para os consumidores existentes. Não há duas fontes para autorizar acesso: permissões/validade continuam verificadas no backend e relay; `phase` governa transições e prazos. O painel usa `safe_message` e exibe o UUID da tentativa.

```text
REQUESTED → TARGET_NOTIFIED → CONSENT_PENDING
  → CONSENT_ACCEPTED_VIEW ou CONSENT_ACCEPTED_CONTROL
  → ENGINE_AUTHORIZING → TRANSPORT_CONNECTING
  → ENGINE_CONSENT_PENDING → AWAITING_FIRST_FRAME
  → FIRST_FRAME_RECEIVED → VIEWING ou CONTROLLING

estado não terminal → STOP_REQUESTED → ENGINE_STOPPING
  → TERMINATED / FAILED / EXPIRED / REVOKED
CONSENT_PENDING → CONSENT_REJECTED
```

`ENGINE_CONSENT_PENDING` e `AWAITING_FIRST_FRAME` são adicionais necessários para distinguir a espera atual. Observações do motor podem chegar entre duas consultas: o backend registra a passagem para espera de imagem e primeiro frame sem inventar uma observação de diálogo nativo que não recebeu. `TARGET_NOTIFIED` significa entrega em consulta autenticada do agente (ou decisão autenticada recebida), não prova visual de que o diálogo apareceu.

Estados terminais são absorventes. Eventos idênticos não avançam nem renovam prazo. Transições inválidas são rejeitadas. Depois de perda de rede, uma nova conexão exige outra tentativa e novo consentimento; não se recupera um compartilhamento encerrado. O UUID de sessão também é o identificador de correlação; `share_id` continua secreto e não é utilizado como identificador público de diagnóstico.

## Imagem e autorização de controle

O relay distingue um bloco KVM completo da confirmação de desenho. O adaptador do controlador emite `uai-rendered` somente depois de uma chamada real de desenho no canvas. O relay consome esse evento e não o encaminha ao MeshAgent. A sessão só passa a `ACTIVE` quando há bloco de imagem, confirmação de desenho, consentimento nativo e barra nativa. O backend projeta `FIRST_FRAME_RECEIVED` e `VIEWING/CONTROLLING`.

Essa confirmação é telemetria do controlador, não prova criptográfica da tela. Um controlador modificado pode mentir sobre desenho, mas não consegue usá-la para substituir o consentimento, inventar um bloco de imagem no canal do agente ou obter controle em VIEW.

No modo VIEW, o backend emite compartilhamento viewOnly, o motor recebe essa restrição, o relay rejeita teclado/mouse/clipboard e o adaptador não instala controles. Em CONTROL, o relay também exige estado ativo e barra. O serviço exige uma interface interativa com confirmação periódica do indicador local; falhas encerram o motor. WebRTC, arquivos e clipboard permanecem fora do fluxo.

## Prazos

| Etapa | Limite |
|---|---|
| Entrega/resposta ao consentimento inicial | 60 s desde a solicitação; consultas não renovam |
| Controlador iniciar emissão após aceite | 15 s |
| Emissão da autorização pelo backend | 20 s; cada comando Mesh tem orçamento total de 8 s |
| Preparação/conexão do transporte | 15 s por etapa no relay, limitado pelo prazo geral |
| Consentimento nativo | janela nativa configurada em 30 s; relay/controlador 35 s |
| Primeiro bloco de imagem após autorização | 15 s |
| Confirmação de desenho após bloco | 10 s |
| Confirmação de encerramento no backend | 10 s; falta de confirmação gera FAILED/STOP_UNCONFIRMED |
| Autorização absoluta de laboratório | máximo de 60 s no compartilhamento, sem extensão |
| Lease do relay sem renovação backend | 12 s |
| Supervisão local | verificação a cada 500 ms; lease da interface de 5 s |

Os limites não se somam para estender o compartilhamento. São prazos lógicos: verificação periódica e chamadas em andamento podem adicionar latência à atualização do painel. O motor/relay mantém os próprios limites mesmo se o backend ficar indisponível. Um resultado `EXPIRED_UNCONFIRMED` nunca é apresentado como confirmação física de parada. Não há promessa de latência zero; o tempo efetivo de corte precisa ser medido em Windows.

## Encerramento local e respostas atrasadas

O canal IPC prioritário já existente encerra o processo motor pelo Job Object, antes de aguardar o backend. Foi acrescentada uma barreira local por geração e UUID da tentativa: consulta ou resposta HTTP anterior ao stop não pode reapresentar/aceitar a mesma tentativa. A interface retira a confirmação do indicador antes da chamada de parada e conserva o aviso quando a confirmação IPC falha. A limpeza do indicador após confirmação local não depende do servidor.

O serviço só reinicia o motor para disponibilidade futura após sincronizar a parada com o backend. Iniciar o motor ocioso não recupera autorização anterior: o relay aceita um único controlador por compartilhamento e recusa reconexão/reutilização. Na inicialização do serviço, pendências de sessões anteriores são encerradas antes de disponibilizar o motor. Troca de sessão Windows, interface perdida e indicador perdido continuam fail-closed.

## Auditoria e contratos

Migração: `V10__remote_lifecycle.sql`. Acrescenta `phase`, `phase_at`, `phase_deadline`, `requested_mode` e tabela `remote_transition`, com índice por sessão/horário. Sessões em andamento anteriores à migração são obrigadas a encerrar; não são reautorizadas. A coluna legada de estado foi preservada.

Endpoint: `GET /api/sessions/{id}/trace`, protegido pela mesma autorização da sessão. Inclui estado anterior/novo, componente, horário, duração, erro enumerado, mensagem segura, alvo, solicitante e modos. No navegador, a identidade comprovada do solicitante é a conta autenticada; `requester_device_id` fica nulo quando não há identidade de dispositivo. Não inventamos um computador solicitante com base em dados fornecidos pelo navegador.

Relay: `UAI_RELAY_TRANSITION` e `UAI_RELAY_DIAGNOSTIC`. Serviço: `UAI_LOCAL_TRANSITION` e códigos de parada. Os registros são correlacionados pelo UUID; não incluem cookie, URL de compartilhamento, token, credencial ou pacotes. A transição completa e sua duração ficam na tabela; os logs locais são marcos complementares.

Contrato de integração Uai do motor atualizado para versão 2, `renderAck=true`. É a versão do adaptador Uai, não uma troca da versão MeshCentral. Backend novo rejeita integração v1. Backend, relay e controlador devem ser preparados juntos para a prova; misturar builds falha de forma fechada. Nada foi aplicado ao servidor em execução nesta entrega.

## Testes e limites

Executados: testes Java de autenticação/autorização e ciclo de vida, migrações em H2 e PostgreSQL isolado, relay com relógio controlado, sockets loopback reais com agente simulado, Chromium com JPEG decodificado no canvas e transporte simulado, políticas C# de lease/fila/barreira de parada e compilação Windows do aplicativo/serviço. Resultados exatos acompanham o pacote de diagnóstico.

Cobertura nova: VIEW/CONTROL, recusa, prazo de consentimento, rejeição do motor, transporte sem conexão, ausência de frame/desenho, entrada indevida em VIEW, parada, revogação, expiração, duplicação/ordem inválida, perda de conexão, ausência da barra, falta de renovação backend, impossibilidade de reutilizar compartilhamento, abertura automática e descarte de autorização atrasada após stop na lógica da interface.

Testes de política C# não executam SCM, named pipes Windows, DPAPI, telas, Job Object ou MeshAgent. Os sockets loopback não são captura remota. Falha real da interface/indicador, corte sem backend e funcionamento do diálogo nativo permanecem pendentes de Windows. Os testes opcionais que exigem integração viva/assinatura devem ser identificados como ignorados, não aprovados.

## Pacote e próxima prova autorizada

Pacote: `UaiSuporte-Diagnostico-Fluxo-20261105.zip`, em `/home/agenda/uai-entregas`. Contém esta documentação, lista/hash dos arquivos da etapa, resultados resumidos, eventos **simulados** sanitizados e exportador com allowlist. Não contém instalador, credenciais, CA privada, cookies, banco, arquivos `.bin` de identidade, configuração de laboratório ou executável MeshAgent.

Exportação offline na VM: `python3 scripts/sanitize-remote-diagnostics.py entrada.log saida.json`. Aceita somente registros Uai conhecidos ou JSON do endpoint de trace. Nunca enviar o log bruto, HAR, configuração Mesh ou pasta ProgramData inteira. Revisar o JSON antes de compartilhar.

Antes da prova, preparar uma implantação de laboratório coordenada dos builds compatíveis, após autorização aplicável; não copiar DLLs manualmente para contornar o instalador/integridade. Confirmar hash, assinatura e identidade preservada. Uma etapa por vez: solicitar VIEW → confirmar escolha C# → verificar se aparece a confirmação nativa → aceitar → observar primeiro frame → encerrar no alvo. Só então repetir CONTROL, testar entrada, stop sem backend, recusa, revogação e falha do indicador em VM descartável. Se a confirmação nativa não aparecer, parar nessa etapa e coletar o UUID/trace e marcos locais, sem autoaceitar.

Critério de aprovação: primeiro frame real e controle autorizado, seguido de interrupção verificável de imagem/entrada no alvo, sem retomada da sessão encerrada. Esse critério ainda não foi comprovado.
