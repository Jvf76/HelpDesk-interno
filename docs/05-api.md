# API atual — acesso remoto interno

Base /api. Sessão de usuário em cookie UAI_SESSION HttpOnly/Secure/SameSiteStrict;
CSRF em X-CSRF-Token nas mutações. Desktop guarda cookie em memória nativa e
valida a origem da ponte. Não existe endpoint público para obter viewer sem
login, permissão e consentimento. Agente usa Bearer individual, hash no banco.

- POST /auth/login: login/password, rate limit, retorna usuário e CSRF.
- GET /auth/me; POST /auth/logout: consulta/revogação real.
- GET /users; POST /users; PUT /users/{id}: equipe/admin conforme autorização.
  Perfis usados no produto: ADMIN e TECNICO. SOLICITANTE pode existir em dados
  legados, não recebe permissão de controle e não entra no aplicativo Técnico.
- GET /devices?q=&location=: somente dispositivos autorizados; busca nome,
  UUID, setor e responsável; estado pelo heartbeat em30s, revogação sobrepõe.
- POST /devices; PUT /devices/{id}: admin, nome/setor/localidade/responsável/node.
- POST /devices/{id}/enrollment: código de uso único com prazo10min.
- POST /devices/{id}/revoke: invalida credencial e encerra sessões.
- GET/PUT /devices/{id}/permissions; DELETE /devices/{id}/permissions/{userId}:
  admin, VIEW ou CONTROL por técnico ativo.
- GET /devices/{id}/history: somente sessões, com técnico, horários e resultado.
- POST /agent/enroll: code/os, retorna deviceId/token; sem senha de usuário.
- POST /agent/heartbeat: os, retorna solicitações e horário do servidor.
- POST /agent/offline: identidade do dispositivo; encerra pedidos e remove presença.
- POST /agent/sessions/{id}/{decision}: accept, accept-view, reject ou stop.
  accept-view reduz CONTROL para VIEW; não existe escalada local de VIEW para CONTROL.
- POST /sessions: deviceId, mode VIEW/CONTROL; exige staff, permissão e presença.
- GET /sessions/{id}: técnico proprietário/admin; estado confirmado pelo motor.
- POST /sessions/{id}/launch: após consentimento, mesmo login/cookie da solicitação;
  retorna JSON authCookie/viewOnly/expiresAt. Somente aplicação nativa encaminha
  ao viewer local; não registrar token nem persistir em arquivo. Sem link/browser.
- POST /sessions/{id}/stop: encerra transporte, registra técnico e resultado.

Estados: PENDING, CONSENTED, ISSUING, READY, CONNECTING, AWAITING_CONSENT,
AWAITING_FRAME, ACTIVE, STOPPING, UNVERIFIED, ENDED. Recusa/expiração aparecem
no resultado final. ACTIVE exige bloco de imagem no relay; renderização é
confirmada separadamente pelo viewer. Sem confirmação, não manter indicação ativa.

Não há rotas de chamados. Tabelas/coluna ticket_id legadas ficam apenas por
preservação de dados; não são lidas para autorizar/iniciar sessão nem expostas.
No laboratório, IP do token Mesh é obtido do header sobrescrito pelos proxies
somente quando a conexão da API vem de loopback. Outra topologia exige configurar
proxies confiáveis explicitamente; não aceitar X-Forwarded-For arbitrário da internet.
# Atualização 0.4 — aplicativo único

O fluxo novo usa `POST /api/connections` com `{code,mode}` e `GET /api/connections`
para o histórico privado. Qualquer conta ativa pode solicitar; não exige papel
técnico nem grant prévio. O código é o UUID real do destino, não credencial.
Conta/IP/destino são limitados; consentimento local e revalidação contínua são
obrigatórios. Endpoints /sessions/{id}/launch e /stop continuam vinculados ao
solicitante. POST /sessions e grants abaixo são compatibilidade legada, não o
fluxo do aplicativo novo. Consulte [contrato e limites atuais](14-aplicativo-unico.md).

## Cadastro integrado LAB 0.5

- POST /api/agent/binding: bearer individual; desafio de 120s e MSH do broker.
- POST /api/agent/binding/confirm: consulta prova nativa autenticada; não recebe Node ID
  do cliente. Unicidade assegurada no banco. Idempotente após confirmação.
- POST /api/agent/unregister: revoga somente credencial autenticada, encerra sessões
  e preserva cadastro público/histórico para recuperação administrativa.
- Heartbeat rejeitado antes do vínculo Mesh. Edição de metadados preserva Node ID;
  formulário não atribui nem troca identidade Mesh. Recuperação exige ADMIN.

Não registrar respostas de binding: contêm desafio temporário.

## Cadastro após login — LAB 0.5.3

`POST /api/devices/register` exige sessão de usuário ativo e CSRF, para qualquer
perfil. Body: `installationId` UUID privado persistido, `credential` aleatória
base64url de 43 caracteres, `name` e `os`. Resposta: `deviceId` público, sem token.
Idempotência por instalação/conta/credencial; revogados não são reativados.
Limite: cinco novos computadores por hora/conta. A credencial segue individual e
revogável; disponibilidade depende do vínculo Mesh e do heartbeat.

## Dispositivos sem login de usuário — LAB 0.6.0

Contrato atual: [ativação e autenticação de dispositivo](21-ativacao-dispositivo.md). `/devices/register` foi retirado de uso (410); usuários web continuam usando login/cookie/CSRF. Tokens administrativos não concedem sessão remota.

## Inventário e monitoramento (V8)

Consulte [contratos, permissões e frequência](24-inventario-monitoramento.md#api-adicionada). O inventário usa paginação no backend; os endpoints de agente exigem identidade individual e preservam o vínculo da ativação.
