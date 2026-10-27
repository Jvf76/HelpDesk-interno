# Segurança, limites e critérios de liberação

## Implementado na aplicação

- Usuários: senhas BCrypt custo 12, mínimo 14 caracteres (máximo 72 bytes), sessão aleatória de 256 bits, hash SHA-256 no banco, 8 h de validade, cookie HttpOnly/Secure/SameSite Strict. Logout apaga a sessão e solicita revogação remota.
- Sem credencial de administrador de fábrica: bootstrap exige ambiente configurado. Remover o segredo de bootstrap do ambiente após provisionamento (Compose ainda exige variável preenchida para interpolação; pode-se usar outro segredo aleatório depois).
- CSRF nas mutações autenticadas, sem CORS aberto; login JSON exige preflight em origem diferente. HTTP somente no desenvolvimento por loopback; Compose usa HTTPS.
- Dez falhas de login por IP ou conta em 15 minutos; contadores persistidos. O backend não confia em X-Forwarded-For. Atrás do proxy todos compartilham o limite de IP: proteção conservadora, mas pode afetar vários usuários. Antes de produção, definir proxies confiáveis e testar limites por origem.
- Agente: credencial separada, individual, revogável e armazenada por hash. Enrollment de 256 bits com expiração de 10 min e consumo único. Revogado não pode se reinscrever no mesmo cadastro. Agente não define seu Mesh Node ID; somente administrador pode vinculá-lo.
- Presença de agente e capacidade de tela são diferentes: online = heartbeat nos últimos 30 s. O MeshAgent pode estar offline mesmo com C# online; nesse caso a conexão remota falha. Não há sincronização automática do inventário Mesh ainda.
- Autorização de dispositivo é reavaliada na solicitação, emissão e varredura a cada 3 s. Controle exige permissão explícita; solicitante não inicia acesso remoto. Perfil ADMIN pode operar todos os computadores.
- Logs de auditoria contêm IDs, ações e tempo. Comentários/descrições pertencem ao chamado; não são duplicados no log de auditoria. Tokens, URLs de compartilhamento, imagens e conteúdo de telas não são registrados pelo código Uai.
- HTTP/WSS utilizam implementações padrão e validação normal de CA/hostname. Não se usa TrustAll, `-k` ou desativação de proteção Windows.
- Terminal, arquivos, clipboard, gravação e comandos não têm endpoints ou controles na aplicação. O compartilhamento Mesh solicita apenas desktop (`p=2`). O motor completo continua possuindo recursos administrativos; credenciais da conta de integração nunca devem ser entregues a técnicos/solicitantes. Restringir essa conta ao grupo de laboratório com remote control + guest sharing e sem terminal/arquivos/console/admin de servidor. Validar que não há caminho alternativo no viewer da versão fixada.

## Limites que impedem declarar o MVP completo

1. **Sem teste Windows:** nenhum resultado de captura, mouse, teclado, recusa, privacy bar, expiração ou corte de conexão foi medido em Windows. Compilação cruzada não valida WinForms/DPAPI nem MeshAgent.
2. **Eventos do motor:** integração implementada com consentimento final, bloco de imagem e desconexão. Testada com fixtures e sockets locais; Windows ainda pendente. ACTIVE significa imagem recebida no relay, não renderizada no navegador.
3. **Encerramento local:** o X da barra MeshAgent é o mecanismo local de interrupção da transmissão. O botão C# pede remoção ao backend; não tem autoridade sobre o serviço MeshAgent e não garante parada instantânea sem rede. Em falha, informa isso e orienta usar a barra. STOPPING e EXPIRED_UNCONFIRMED não significam confirmação física.
4. **Conexão encerrada no viewer:** patch vincula link a uma única conexão e encerra os dois sentidos. Reinício do motor nega links antigos. Sem retomada automática. Validar o fechamento físico em Windows.
5. **Privacidade e recursos excluídos:** o viewer é externo e upstream. A prova precisa verificar que arquivos/clipboard/terminal não estão acessíveis com a credencial de compartilhamento, que a gravação está desabilitada e que a barra não pode ser dispensada pelo técnico. O aplicativo não oferece essas funções, mas uma auditoria do motor e binário distribuído ainda é necessária. A gravação local feita por terceiros no navegador/SO não pode ser impedida pela aplicação.
6. **Autorização eventual:** polling de 3 s mais latência. Lease de 12 s no relay fecha a sessão sem renovação; prazo absoluto de 60 s permanece. Não prometer parada instantânea pelo painel em partição de rede. X local é o mecanismo imediato, ainda a validar em Windows.
7. **Navegação:** o painel abre sessão em nova janela; pop-ups precisam estar liberados. Ainda não há viewer incorporado nem persistência do acompanhamento da sessão após recarregar a página (auditoria permanece no banco).
8. **Operação:** uma instância de API; listagens limitadas/sem paginação completa (chamados: últimos 500). Não há MFA, SSO/AD, reset de senha por e-mail, autoatualização assinada, inventário avançado ou backup automático pronto. Conta de integração Mesh não usa MFA no adaptador atual; deve permanecer restrita à rede interna.
9. **Confiança no dispositivo:** DPAPI é por usuário Windows; o aplicativo não tem identidade TPM/atestado de hardware. Usuário com acesso à sessão local pode usar sua própria credencial. Se precisar impedir isso, usar serviço dedicado e credencial protegida por máquina com UI/IPC autenticado, após nova revisão.
10. **TLS no PostgreSQL:** Compose mantém banco em rede Docker privada e porta de desenvolvimento em loopback. A conexão JDBC interna não usa TLS. Se banco estiver em outro host, configurar `sslmode=verify-full` e CA; não usar a topologia de desenvolvimento como rede de produção.

## Cenários Windows não homologados

| Cenário | Estado |
|---|---|
| Desktop comum com usuário logado | Prova fornecida, execução pendente |
| UAC / secure desktop | Não suportado como promessa; não há tentativa de elevar ou contornar UAC |
| Login / sem usuário | Acesso não assistido desligado, autoaceite desabilitado |
| Tela bloqueada | C# suspende heartbeat e pede encerramento; comportamento Mesh deve ser testado. Não anunciar acesso ao bloqueio |
| Vários monitores / DPI / múltiplas sessões | Sem homologação; começar com um monitor 100% DPI |
| Agente C# como serviço | Não implementado; WinForms roda na sessão interativa |
| MeshAgent como serviço | Motor upstream pode instalá-lo; procedimento e consentimento precisam de testes em máquina autorizada |
| Instalação MSI/assinatura | Script por usuário e publish disponíveis; assinatura de binário/instalador ainda não providenciada |

Acesso não assistido não tem opção de habilitação no código Uai. Evoluções possíveis: MFA/SSO, viewer incorporado, instalação assinada, múltiplos monitores. Terminal, arquivos, clipboard e gravação só poderão ser considerados em escopo futuro, com autorização e políticas próprias.
