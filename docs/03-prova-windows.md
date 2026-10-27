# Prova técnica: duas máquinas Windows autorizadas

## Objetivo e estado

Provar **imagem real, consentimento, mouse e teclado, visualização sem controle, encerramento e revogação** antes de liberar o sistema. Este roteiro foi escrito, não executado em Windows. Não há dados de sucesso preenchidos. Antes de uso fora de laboratório, resolver os alertas de dependências no relatório de resultados.

Separar:

- **A:** Windows do técnico, navegador atualizado; usuário TECNICO no Uai.
- **B:** Windows atendido, usuário local logado, C# e MeshAgent de laboratório, um monitor inicialmente.
- **S:** servidor de laboratório, acessível por LAN/VPN. Pode ser Linux. Sem exposição à internet.

Usar máquinas descartáveis/autorizadas, sem dados sensíveis. Não alterar uma instalação MeshAgent já usada por outra equipe. Definir horários sincronizados nos três hosts; links expiram em 60 s.

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
| Recusa final | Aceitar C#, recusar MeshAgent | Nenhum frame sensível/controle; viewer mostra recusa. Registrar que o painel não recebe ainda esse resultado |
| Timeout de consentimento | Não responder | Não autoaceitar; sem captura/controle |
| Controle | Administrador concede controle, técnico solicita CONTROL e ambos os consentimentos aceitam | Abrir Bloco de Notas manualmente em B; digitar texto inofensivo e mover/clicar via A; comprovar mudança real |
| Barra de privacidade | Sessão transmitindo | Barra claramente visível em B com informação de atendimento e X local |
| Encerrar localmente | Clicar X da barra MeshAgent em B | Imagem para e comandos de A não alteram B; verificar por ação real, não apenas texto “desconectado” |
| Botão C# | Pedir encerramento no aplicativo B | API remove share; transmissão/entrada cessam; se sem rede, aplicativo não pode anunciar parada confirmada |
| Revogar permissão | Retirar controle ou todas as permissões durante sessão | Share removido na reavaliação; confirmar corte real de tela e entrada; registrar latência |
| Revogar dispositivo | Revogar B durante sessão | Agente rejeitado; share removido; nenhuma sessão posterior |
| Logout | Sair no painel A durante sessão | Share removido; link não permite reconexão após remoção |
| Expiração | Deixar passar 60 s do compartilhamento sem intervenção | Relay encerra sessão real; reabrir URL expirada falha; não basta backend dizer ENDED |
| Backend indisponível | Durante transmissão, parar API | Motor encerra pelo prazo próprio; nenhum compartilhamento indefinido |
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
