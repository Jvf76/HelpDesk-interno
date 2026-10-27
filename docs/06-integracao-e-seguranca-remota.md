# Integração remota — 27/10/2026

## Componentes

| Local | Componente | Função |
|---|---|---|
| Windows A, técnico | Navegador | Painel HTTPS e viewer Mesh/WSS em outra janela. Nenhum agente |
| Windows B, atendido | UaiSuporte.Agent C#/.NET 10 | Cadastro, identidade DPAPI por usuário, heartbeat HTTPS a cada 5 s, primeiro consentimento, solicitação de parada e log local |
| Windows B, atendido | MeshAgent nativo | Captura, mouse/teclado, segundo consentimento, barra visível com X; conexão de saída WSS ao MeshCentral |
| Servidor S, Linux recomendado | Spring/PostgreSQL, React/Caddy, MeshCentral | Autorização/auditoria; publicação HTTPS; transporte remoto e fiscalização da sessão |

O C# não captura tela nem fala diretamente com MeshAgent. Os dois são associados administrativamente pelo Node ID. Há duplicação deliberada de presença e consentimento: Uai autoriza o pedido; MeshAgent autoriza a transmissão. C# online não garante MeshAgent online. Não há IPC, agente único ou instalação unificada.

Mantida a stack. MeshAgent é dependência nativa adicional necessária ao motor. Reescrever sua captura/protocolo em C# seria outro projeto. C# precisa ficar aberto na sessão interativa; MeshAgent pode ser serviço. UAC, login, bloqueio/troca de usuário e múltiplos monitores continuam sem homologação.

## Fluxo implementado

1. Spring valida login, dispositivo, modo, heartbeat e permissão.
2. C# aceita/recusa. Recusa não cria compartilhamento.
3. Mesmo login pede abertura. Spring exige capacidades Uai v1; motor sem patch é recusado.
4. Link desktop-only, VIEW separado de CONTROL, consentimento 72, máximo absoluto 60 s. Aceita uma única conexão do viewer. Desconexão exige novo pedido e consentimento.
5. MeshAgent pede confirmação. Para sessões Uai, não reutiliza cache de consentimento e exige criação da barra antes de conectar KVM.
6. Relay distingue conexão, consentimento e bloco completo de imagem. Só imagem produz ACTIVE. Prova recepção no relay, **não renderização no navegador**.
7. Spring consulta a cada 3 s e renova lease de 12 s somente enquanto login/dispositivo/permissão/prazo forem válidos. Sem renovação, relay fecha os dois sockets, independentemente de nova chamada API.
8. Recusa, X local, falha da barra, expiração e desconexão vão ao histórico. Eventos locais tardios refinam DISCONNECTED por 15 s. Sem confirmação: STOPPING/EXPIRED_UNCONFIRMED explícitos.
9. Relay verifica pong e fecha sockets sem resposta por aproximadamente 10 s + até 500 ms de varredura. Interromper somente C# torna dispositivo offline em 30 s. São mecanismos distintos.
10. Logout/revogação interrompem renovação e pedem parada. Painel não conserva ACTIVE ao perder contato ou quando confirmação do motor passa de 10 s.

Migração V2 acrescenta started_at (primeiro bloco), engine_consent_at e engine_seen_at. Preserva requested_at, ended_at, result. O observador guarda até 12 bytes de cabeçalho e contadores; não registra imagens/teclas. TLS termina no relay; não se anuncia E2EE.

Viewer limitado a configuração de imagem, monitor e entrada conforme modo. Clipboard, arquivos, comandos e WebRTC não passam no adaptador. Não há gravação do atendimento. Isso não impede gravação externa da própria tela.

## Manutenção do motor

patch-session.mjs aplica alterações exatas no MeshCentral **1.3.1** e instala uai-session.cjs:

- meshuser.js: capacidades e consulta/renovação/parada vinculadas ao proprietário.
- meshrelay.js: conexão única, filtro, imagem e encerramento.
- meshagent.js: eventos autenticados correlacionados por node/identificador Uai.
- agents/meshcore.js: consentimento sem cache e barra obrigatória.
- views/sharing.handlebars: remove exportação de screenshot e opção Ctrl+Alt+Del, fora do MVP.

Preserva Apache-2.0 e avisos. Instalação falha se versão/âncoras mudarem. npm ci e Docker aplicam os mesmos patches. Mudança do motor exige revisão e nova prova Windows. Esse custo permite estado real/lease ausentes na integração anterior; não implementa criptografia, codec ou protocolo de desktop.

Reconecte/reinicie MeshAgent do laboratório após atualizar core; confirme recebimento do core do servidor. Não altere agentes corporativos existentes. Uma instância de API e de Mesh, sem múltiplos workers. Reinício perde mapa de sessões e nega links antigos.

Administradores Mesh mantêm poderes próprios do produto. Técnicos/solicitantes Uai não recebem login Mesh. Integração restrita ao grupo, sem terminal/arquivos/comandos. O adaptador não protege contra administrador do motor comprometido.

## node-forge

Cadeia confirmada: uai-remote-poc → meshcentral@1.3.1 → node-forge@1.4.0. Audit anterior listava biblioteca e pai transitivo, não duas explorações independentes comprovadas.

GHSA-86w9-cpqp-85rv/CVE-2026-85393: falsificação RSA PKCS#1 v1.5 por elementos extras no DigestAlgorithm ASN.1, especialmente expoente e=3. O fornecedor publicou em **27/10/2026** o [aviso GHSA-2g46-22mc-6gwp](https://github.com/digitalbazaar/forge/security/advisories/GHSA-2g46-22mc-6gwp): afetadas <=1.4.0, corrigida 1.4.1. O [changelog fixado](https://github.com/digitalbazaar/forge/blob/8a917370ec51731e817c2d547b7329a58f8210af/CHANGELOG.md) registra a correção. A conclusão anterior “sem correção” ficou desatualizada.

Forge participa de certificados/PKCS#7/assinaturas em runtime. No caminho examinado de autenticação MeshAgent, meshagent.js lê PKCS#7 com Forge mas verifica RSA com node:crypto. Certificados padrão de certoperations.js usam e=65537. AMT contém chamada Forge verify, fora do fluxo escolhido. **Dependência afetada comprovada; exploração do login neste projeto não comprovada.** Não foi demonstrada ausência de outros caminhos.

Aplicado override exato **1.4.1**, lockfile e bootstrap alinhados. Sem force update nem remendo criptográfico. Reexecutados npm ci, motor e testes WSS. Audit do motor: **0 vulnerabilidades em 27/10/2026**. Não equivale a auditoria exaustiva ou prova Windows.

## Assinaturas e certificados

| Mecanismo | Evidência / consequência |
|---|---|
| TLS HTTPS/WSS | CA, hostname e validade verificados por Java/browser/C#. Erro bloqueia conexão. Caddy e Mesh têm CAs distintas; instalar somente CA pública de origem/fingerprint conferidos |
| Identidade Mesh/core | Certificados/assinaturas internos autenticam agentes/core, distintos de Authenticode. Erro pode impedir associação ou core. Ainda sem teste Windows |
| Authenticode MeshService/MeshCmd | Falha reproduzida antes/depois de Forge 1.4.1: Too few bytes to read ASN.1 value. Stack aponta authenticode.js:1493, caminho similar 1921: leitura DER do PKCS#7 para preparar timestamp, antes de requisitá-lo. Não é evidência de falha TLS, Windows ou endpoint de timestamp |
| C#/PowerShell | Build/publish não assinam. Certificado corporativo não foi fornecido. SmartScreen/WDAC/AppLocker podem impedir execução; distribuição confiável exige processo corporativo |
| Timestamp Authenticode | Permite conferir quando código foi assinado. Não foi desativado para contornar ASN.1; cadeia/retorno precisam continuar verificados |

WSS funcionou apesar do aviso Authenticode. Isso não comprova instalador válido/confiável. Não se alteraram strict ASN.1, TLS, Defender, UAC ou ExecutionPolicy. Falha de assinatura permanece pendente de correção/investigação e validação do binário exato no Windows. Não distribuir amplamente.

Antes de instalar, use Get-FileHash -Algorithm SHA256 e Get-AuthenticodeSignature no MeshAgent baixado e no UaiSuporte.Agent.exe; registre Status, StatusMessage, SignerCertificate e TimeStamperCertificate. Não tratar NotSigned como Valid. Se política bloquear, pare e envie status; assinar/aprovar pelo processo da empresa, sem desativar proteções.
