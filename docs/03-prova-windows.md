> Registro histórico anterior ao escopo0.3. O produto atual é exclusivamente acesso remoto, sem chamados. Para operação e limitações atuais, use [o guia0.3](10-acesso-remoto-03.md).

# Prova técnica: duas máquinas Windows autorizadas

## Objetivo e estado

Provar **imagem real, consentimento, mouse e teclado, visualização sem controle, encerramento e revogação** antes de liberar o sistema. Este roteiro foi escrito, não executado em Windows. Não há dados de sucesso preenchidos. A dependência node-forge foi corrigida; assinatura de executáveis e homologação permanecem pendentes. Leia também o documento 06.

Separar:

- **A:** Windows do técnico, navegador atualizado; usuário TECNICO no Uai.
- **B:** Windows atendido, usuário local logado, C# e MeshAgent de laboratório, um monitor inicialmente.
- **S:** servidor de laboratório, acessível por LAN/VPN. Pode ser Linux. Sem exposição à internet.

Usar máquinas descartáveis/autorizadas, sem dados sensíveis. Não alterar uma instalação MeshAgent já usada por outra equipe. Definir horários sincronizados nos três hosts; links expiram em 60 s.

## Comece por este pré-teste e envie o resultado

A preparação do servidor abaixo é necessária antes dos dois Windows. Use os nomes **suporte.internal** (painel) e **mesh.internal** (motor) na mesma LAN/VPN, apontando para o IP interno do servidor. Premissa: servidor Linux separado; A e B são Windows x64 com usuário logado e navegador atual. Não há necessidade de conexão direta A→B nem porta aberta nos Windows.

No servidor, com este repositório e Docker/Compose v2:

1. Copie .env.example para .env somente se ainda não existir; preserve instalações/dados anteriores.
2. Preencha as senhas exclusivas e login bootstrap. SITE_HOST=suporte.internal, BIND_IP=IP interno de S, MESH_ENABLED=false.
3. Execute docker compose up --build -d; depois prepare/suba Mesh conforme seção seguinte.
4. Libere TCP 443 e 4433 somente da LAN/VPN autorizada. Não exponha 5432 à rede.
5. Exporte a CA Caddy com docker compose cp web:/data/caddy/pki/authorities/local/root.crt ./uai-local-root.crt.
6. Copie SOMENTE uai-local-root.crt e infra/mesh/data/root-cert-public.crt para A/B. Confira origem/fingerprint por canal confiável. Configure DNS ou hosts para os dois nomes.

No PowerShell do usuário que fará o teste em A e B:

```powershell
certutil -user -addstore Root .\uai-local-root.crt
certutil -user -addstore Root .\root-cert-public.crt
.\scripts\Test-UaiConnection.ps1
```

Esperado em ambos: Painel e Motor com TCP OK, HTTPS confiavel, HTTP 200. O script não ignora TLS e não autentica ninguém. **Pare aqui e envie as quatro linhas de resultado**, indicando A/B. Se o servidor ainda não existir, envie o primeiro erro do comando de preparação. Não instalar agentes antes desse retorno. Política de scripts bloqueando execução: envie o erro; não use Bypass.

## Arquivos para cada computador (etapas após o pré-teste)

- A: navegador, duas CAs públicas, script de pré-teste. Nenhum agente.
- B: mesmos itens; pacote C# com pasta agent/publish completa, agent/install.ps1 e agent/uninstall.ps1; MeshAgent x64 baixado do grupo no seu próprio servidor. O MeshAgent precisa trazer identidade do servidor/grupo, por isso não se entrega um instalador genérico pré-vinculado.
- S: repositório, .env privado, config Mesh, volumes persistentes. Docker compila Java/React; não precisa instalar .NET no servidor para executar o backend.

Gerar C# em estação com SDK .NET 10 (ou usar o ZIP local de laboratório já produzido nesta revisão):

```powershell
dotnet publish .\agent\UaiSuporte.Agent -c Release -r win-x64 --self-contained true -o .\agent\publish
Get-AuthenticodeSignature .\agent\publish\UaiSuporte.Agent.exe | Format-List Status,StatusMessage
.\agent\install.ps1
& "$env:LOCALAPPDATA\UaiTelecom\Suporte\app\UaiSuporte.Agent.exe"
```

Runtime incluído; B não precisa de SDK. Pacote ainda não assinado pela Uai. Não contorne bloqueio corporativo. Antes do MeshAgent, salve o download como MeshAgent-Uai.exe, registre hash/assinatura:

```powershell
Get-FileHash .\MeshAgent-Uai.exe -Algorithm SHA256
Get-AuthenticodeSignature .\MeshAgent-Uai.exe | Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
```

Enviar o resultado para avaliar o aviso documentado antes de instalar. Depois de validado conforme política da empresa, abrir instalador oficial, identificar servidor/grupo e escolher Install. A instalação do serviço pode pedir UAC administrativo; isso não promete acesso remoto ao secure desktop.

## Preparar o motor

1. Configure o servidor principal como no README, com HTTPS confiável nas duas máquinas.
2. Crie `infra/mesh/data`, copie `infra/mesh/config.example.json` para `infra/mesh/data/config.json`. DNS/hosts `mesh.internal` deve resolver o servidor em A e B; internamente o Compose já tem esse alias. Se alterar nome/porta, altere alias do Compose, cert no JSON e `MESH_URL` juntos. O adaptador exige correspondência exata com a URL retornada pelo motor, incluindo porta.
3. Suba apenas o motor:

```bash
docker compose --profile remote-poc up --build -d mesh
```

4. Configure uma conta administrativa inicial pelo mecanismo CLI oficial. Pare o motor antes das operações de banco e faça isso somente nesse volume novo. O comando `node node_modules/meshcentral --help` informa `--createaccount`, `--pass`, `--adminaccount`. Evite salvar senhas em histórico de shell. Exemplo interativo em Bash (a senha é variável temporária, nunca literal):

```bash
docker compose stop mesh
read -r -p 'Login administrativo do laboratório: ' mesh_lab_user
read -r -s -p 'Senha exclusiva: ' mesh_lab_password
export mesh_lab_user mesh_lab_password
docker compose --profile remote-poc run --rm -e mesh_lab_user -e mesh_lab_password mesh sh -c 'node node_modules/meshcentral --datapath /opt/mesh/meshcentral-data --createaccount "$mesh_lab_user" --pass "$mesh_lab_password"'
docker compose --profile remote-poc run --rm -e mesh_lab_user mesh sh -c 'node node_modules/meshcentral --datapath /opt/mesh/meshcentral-data --adminaccount "$mesh_lab_user"'
unset mesh_lab_password mesh_lab_user
docker compose --profile remote-poc up -d mesh
```

Essas opções administrativas do fornecedor podem expor a senha à lista de processos do container por instantes; não executar em host compartilhado sem controle. Para operação definitiva use um procedimento de provisionamento de segredos homologado.

5. Copie `infra/mesh/data/root-cert-public.crt` e confie nessa CA somente nos Windows de laboratório, após verificar origem. O backend Compose importa essa CA no truststore próprio ao iniciar com MESH_ENABLED=true, mantendo validação de hostname. O C# usa a CA do painel; Mesh e Caddy têm CAs diferentes.
6. Em `https://mesh.internal:4433`, entre como administrador, crie grupo **Uai-Laboratório**. Crie conta distinta para a integração, sem administração de servidor. No grupo, conceda **remote control** e **guest sharing**, negue **terminal**, **files**, **AMT**, **registry**, sem agent console, comandos ou gestão de usuários. Não conceda esse login a técnicos. O caminho CLI/API e os nomes exatos devem ser conferidos na interface 1.3.1 instalada.
7. Confirme que o JSON manteve `userConsentFlags=72`, WebRTC=false, todas as formas de autoaceite false e limite do compartilhamento 1 minuto. Não configurar gravação. Não usar o `custom.js` do PainelRemoto.
8. Baixe o MeshAgent do grupo no seu próprio servidor, registre versão/hash e instale em B pela interface oficial, visível. Confira origem/assinatura disponibilizada pelo fornecedor. O teste Linux observou avisos de falha de assinatura de MeshService/MeshCmd; resolva/valide esses binários antes de distribuir, conforme o relatório de resultados. Não desative Defender/UAC nem crie exclusões automáticas para obter resultado.
9. Verifique B online no MeshCentral e obtenha seu Node ID. No painel Uai, crie usuários técnico/solicitante, cadastre B com seu responsável e Node ID, e conceda ao técnico apenas **visualização** primeiro. Não aceite Node IDs enviados pelo agente; a associação é administrativa.
10. Publique/instale o C# em B conforme README, execute e vincule com código. Confirme o computador online no Uai.
11. Defina no `.env` MESH_ENABLED=true, MESH_USER e MESH_PASSWORD da conta de integração. Recrie apenas o backend: `docker compose up -d --force-recreate backend`. A ativação habilita uma integração **experimental**, não homologa o motor.

## Casos e critérios de aprovação

Para cada caso registrar: versão Windows, navegador, MeshCentral, hash MeshAgent, commit do Uai, instante, IDs (sem tokens/URLs), esperado, observado e evidência não sensível. Marcar PASS/FAIL; não presumir sucesso.

| Caso | Ação | Resultado obrigatório |
|---|---|---|
| Autorização negativa | Técnico sem permissão tenta POST /api/sessions para B | 403, nenhum diálogo/canal remoto |
| Vínculo | Reusar código já consumido; tentar código expirado | 401 e nenhum novo token |
| Credencial revogada | Revogar B e enviar heartbeat com token antigo | 401, não permite pedido de acesso |
| Visualização | Solicitar VIEW, aceitar no C#, abrir link e aceitar no MeshAgent | Tela real de B em A; alterações locais aparecem; mouse/teclado de A **não** alteram B |
| Recusa preliminar | C# responde Não | REJECTED; nenhum link criado, nenhuma tela/controle |
| Recusa final | Aceitar C#, recusar MeshAgent | Nenhum frame/controle; sockets fecham; painel termina com REJECTED (ou motivo de falha correspondente), started_at vazio |
| Timeout de consentimento | Não responder | Não autoaceitar; sem captura/controle |
| Controle | Administrador concede controle, técnico solicita CONTROL e ambos os consentimentos aceitam | Abrir Bloco de Notas manualmente em B; digitar texto inofensivo e mover/clicar via A; comprovar mudança real |
| Barra de privacidade | Sessão transmitindo | Barra claramente visível em B com informação de atendimento e X local |
| Encerrar localmente | Clicar X da barra MeshAgent em B | Imagem para e comandos de A não alteram B; verificar por ação real, não apenas texto “desconectado” |
| Botão C# | Pedir encerramento no aplicativo B | API remove share; transmissão/entrada cessam; se sem rede, aplicativo não pode anunciar parada confirmada |
| Revogar permissão | Retirar controle ou todas as permissões durante sessão | Relay fechado e share removido na reavaliação; confirmar corte real de tela e entrada; registrar latência |
| Revogar dispositivo | Revogar B durante sessão | Agente rejeitado; share removido; nenhuma sessão posterior |
| Logout | Sair no painel A durante sessão | Share removido; link não permite reconexão após remoção |
| Expiração | Deixar passar 60 s do compartilhamento sem intervenção | Relay encerra sessão real; reabrir URL expirada falha; não basta backend dizer ENDED |
| Backend indisponível | Durante transmissão, parar API | Motor encerra em até 12 s da última renovação + 500 ms de varredura; conferir corte real |
| Rede indisponível | Desconectar B; fechar C# | B offline no Uai após 30 s + refresh; não aceita nova solicitação; verificar corte remoto |
| Recursos fora do MVP | Tentar terminal, arquivos, clipboard e gravação com contexto do compartilhamento | Sem permissão/caminho disponível; qualquer acesso é reprovação, mesmo se o botão estiver escondido |
| Chamados | Abrir chamado de solicitante 1 e tentar lê-lo/comentar como solicitante 2 | 403/sem itens na lista; histórico preservado para o dono |
| Vínculo de atendimento | Iniciar remoto a partir de chamado ligado a B | ID da solicitação aparece no histórico do chamado e do computador |
| Reinício | Reiniciar backend/motor durante solicitação | Sem retomada não consentida; pedido expira; registrar estado e limpeza |

## Testes exploratórios adicionais

Com o fluxo básico aprovado, testar bloqueio/desbloqueio, logout local, troca de usuário, DPI, monitores múltiplos e UAC. Não contornar a área segura nem conceder permissões implícitas. Falha nesses cenários deve resultar em indisponibilidade informada, nunca em autoaceite. Eles permanecem sem suporte anunciado até existir evidência.

## Encerrar o laboratório

Desativar MESH_ENABLED e reiniciar backend. Revogar cadastros e contas de integração; encerrar todas as sessões no motor. Desinstalar C# e MeshAgent se as máquinas forem devolvidas ao uso comum. Retirar CAs de laboratório quando não forem mais necessárias. Preservar apenas evidências sem telas sensíveis, senhas ou tokens.

**Gate de produto:** não considerar o MVP concluído até todos os casos críticos passarem, as dependências bloqueantes serem resolvidas e a auditoria refletir o início/término/resultado reais do motor. A prova não deve virar implantação por acidente.


## Primeiro atendimento (somente depois de aprovar o pré-teste/instaladores)

1. Em B, confirme MeshAgent online no grupo e C# aberto. Administrador cadastra B no Uai com Node ID e responsável; concede VIEW ao técnico; entrega código de vínculo de uso único.
2. Em C#, informe https://suporte.internal e código. Confira B online no Uai.
3. Em A, entre como técnico, selecione B e solicite visualização. Em B, responda Não no C#. Esperado: ENDED/REJECTED, sem janela transmitindo.
4. Pare e registre o resultado. Próximo teste guiado será aceitar C#, clicar Abrir tela remota em A, depois Connect/Conectar na janela Mesh, e recusar no MeshAgent. Não executar toda a matriz sem analisar falhas.
5. Após recusas aprovadas: aceitar os dois, mover uma janela localmente em B e observar em A; VIEW não altera mouse/teclado. Depois conceder CONTROL, novo pedido/consentimentos e digitar texto de teste no Bloco de Notas aberto manualmente em B.
6. Clicar X na barra de B; tentar nova entrada de A: nada deve mudar em B, imagem deve parar, painel deve terminar. Testar expiração/revogação/perda de rede em sessões novas, conforme matriz, medindo tempos. O texto “encerrado” sozinho não comprova corte.

## Logs e evidências

- Servidor: docker compose logs --since 10m backend mesh web. Não publique .env, cookies, URLs sharing ou logs integrais sem revisão.
- Banco: remote_session (started_at/ended_at/result/engine_seen_at), audit_event e ticket_event. Use ID de sessão para correlação.
- C#: %LOCALAPPDATA%\UaiTelecom\Suporte\agent.log e agent.log.1, UTC; sem token/tela. identity.bin é segredo DPAPI, não enviar.
- Mesh: eventos do dispositivo na interface administrativa e mesherrors.txt no diretório de dados, se existir. No Windows, Event Viewer → Windows Logs → Application/System para falha de serviço; caminho/log próprio do MeshAgent varia conforme instalação upstream.
- Navegador: console/Network para status e erros, removendo cookies e parâmetros auth/c da evidência.
- Registre sistema/versão/commit/hash dos executáveis, ID da sessão, UTC, esperado/observado. Não capture telas com dados sensíveis.

Desinstalação B: parar localmente na barra, revogar no Uai, fechar C#, executar agent/uninstall.ps1. Remover MeshAgent pelo instalador oficial/Uninstall e conferir serviço. Remover CAs de laboratório somente após terminar a prova.
