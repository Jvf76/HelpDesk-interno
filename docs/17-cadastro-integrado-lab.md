# Uai Suporte LAB 0.5 — cadastro integrado, primeira prova Windows pendente

Pacote único `UaiSuporte-Setup-0.5.0-Lab.exe`: aplicativo C#/.NET10 autocontido,
React/viewer incorporados, MeshAgent assinado LAB, runtime Microsoft WebView2
Fixed Version 156.0.4314.50 x64, CA pública, configuração, licenças e desinstalador.
Nenhum download manual de componente no Windows, nenhuma chave de assinatura, conta Mesh
administrativa ou credencial de dispositivo compartilhada no pacote. O instalador
Uai em si continua sem Authenticode, identificado LAB. Não homologado para funcionários.

## Vínculo e sequência do assistente

1. TI usa cadastro de dispositivo da administração Uai para obter código temporário
   de 10min, uso único. Para recuperação/reinstalação, recuperar o MESMO cadastro;
   não criar outro só porque a instalação anterior falhou. UUID público permanece.
2. Usuário executa o instalador integrado; confirma CA/nome/hash e hosts opcionais.
   Conta interativa e conta elevada devem ter o mesmo SID nesta prova LAB. UAC com
   credenciais de outra conta é recusado antes das alterações. Não há serviço de
   recepção na tela de login nem suporte validado a múltiplos usuários simultâneos.
3. Assistente confere hash do MeshAgent fixado no código e WinVerifyTrust, sem
   ignorar revogação, TLS ou alertas. Confere também arquivos e assinatura Microsoft
   do runtime privado. Falha impede continuar; não contornar SmartScreen/Defender.
4. Credencial individual aleatória de 256bits é gravada com DPAPI CurrentUser antes
   do enrollment. API consome código uma única vez; só armazena hashes. Recibo permite
   repetição exata em caso de resposta perdida, sem novo dispositivo.
5. API, autenticando a credencial individual, solicita desafio de 120s ao broker
   Mesh. Arquivo transitório ao lado do agente contém esse desafio (não token API).
   MSH vem do canal autenticado e é validado para o servidor/grupo do laboratório.
6. Assistente inicia somente seu MeshAgent sob Job Object, para vinculação. Core
   revisado envia o desafio pelo canal nativo autenticado; servidor obtém Node ID
   da conexão, não de JSON do cliente. Grupo, dono, prazo e identidade são conferidos.
   Índice único impede associar o mesmo Node ID a dois cadastros. Reemissão invalida
   desafio anterior. Não há execução remota de comandos nesse protocolo.
7. API confirma vínculo; assistente encerra o processo, apaga desafio, grava setup
   DPAPI e cria atalhos. Durante cadastro, não envia heartbeat de disponibilidade;
   nenhum acesso remoto é habilitado. Sem confirmação, falha e inicia reversão.
8. Abrir Uai Suporte pelo menu Iniciar inicia aplicativo interativo normal. Ele
   confere credencial, hash/assinatura e inicia seu agente; heartbeat torna disponível.
   Mostra UUID real e solicitações; consentimento continua obrigatório.

Na primeira conexão, o protocolo MeshCentral entrega seu core operacional revisado
pelo canal WSS autenticado. Isso é inicialização do motor, não carregamento remoto
da interface React. A máquina precisa alcançar o servidor durante o cadastro.

O MSH identifica o grupo e fixa a identidade do servidor; não é senha de acesso.
A credencial API, identidade criptográfica Mesh e código público são distintos.
Pasta Mesh/DB e DPAPI ficam no perfil do usuário. A pasta Mesh tem ACL exclusiva
do usuário, SYSTEM e administradores. O argumento nativo `-nocertstore` mantém
a identidade privada do Mesh no DB dedicado, evitando contêineres criptográficos
compartilhados com outros MeshAgents; não desativa TLS, pinning ou Authenticode.
Remover esse DB remove também a identidade nativa da instalação. A cópia avulsa usada para conferir
assinatura NÃO é mecanismo de instalação e não deve ser executada pelo operador.

## Reversão e desinstalação

- Falha durante cadastro encerra o processo dedicado, revoga a credencial via API,
  desfaz somente seu bloco hosts/CA adicionada, arquivos, atalhos e runtime privado.
  Dados que já existiam não são sobrescritos. Código consumido não volta a ser válido.
- Se a revogação não puder ser confirmada por queda de rede, a reversão NÃO é
  declarada concluída: o motor é encerrado, a configuração de recepção é retirada
  e a abertura do app fica bloqueada pelo registro de instalação incompleta. Registro/desinstalador e credencial
  protegida permanecem para repetir a compensação depois de reconectar. Não apagar
  manualmente essa credencial; a TI também pode revogar/recuperar o mesmo cadastro.
  Não é possível garantir transação atômica entre Windows e servidor sem rede.
- Desinstalar por Configurações → Aplicativos → Uai Suporte LAB, na mesma conta de
  cadastro, com rede. Fechar o app primeiro. Revoga a credencial antes de remover os
  arquivos locais, inclui DB Mesh, DPAPI, cache WebView, logs do usuário e Startup.
- CA só é removida se adicionada por essa instalação e TI confirmar ausência de
  dependentes. CA preexistente/CurrentUser é preservada. Hosts remove só bloco próprio.
- Executável do desinstalador e arquivos do diretório administrativo são agendados
  para remoção no reinício (não apagar executável em uso). Reiniciar conclui limpeza.
  Histórico de acesso/cadastro revogado permanece no servidor para auditoria e
  recuperação; não apagar registros de segurança. Não encerrar outros MeshAgents.
- WebView2 privado pertence ao aplicativo e é removido com ele. Runtimes Edge/WebView
  já existentes no Windows não são instalados, atualizados ou desinstalados.

## Runtime privado

Fonte/versão/hashes: `desktop/webview2-fixed-provenance.json`. CAB e executável
Microsoft verificados com osslsigncode na VM. O CAB possui assinatura ao final,
reportada como dados após arquivo pelo extrator 7z; verificação Authenticode passou.
O instalador confere hashes de todos os arquivos e WinVerifyTrust do executável.
Permissões RX dos SIDs de AppContainer são aplicadas somente ao Runtime privado,
conforme documentação Microsoft, sem desativar sandbox:
https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution

Atualização de runtime/UI privada depende de nova versão do pacote; não carregar
HTML/JS remoto para atualizar aplicativo. A TI precisa manter essa versão corrigida
antes de produção. A primeira execução do Fixed Runtime no Windows ainda será testada.

## Rede, confiança e logs

API `https://suporte.internal`, Mesh `https://mesh.internal`, ambos TCP443 e
131.0.112.23. Rede autorizada atual 131.0.115.234/32, sem ampliação de firewall.
Instalador pode configurar hosts explícito; produção prefere DNS administrado.
CA SHA256 `A1FFB98EB2364BB6EF0B30F5FD5AE61F1689FFFBA1CA6F1510641EAD624D7138`.
Certificados/CRLs devem ser válidos e acessíveis; não desabilitar verificações para
instalar. CRL LAB: `/pki/uai-lab-codesign.crl` no servidor suporte.

Logs: `%ProgramFiles%\UaiTelecom\UaiSuporte\setup-audit.log`; aplicativo em
`%LOCALAPPDATA%\UaiTelecom\UaiSuporte\app.log` e `client.log`. Na VM:
`journalctl --user -u uai-lab-backend -u uai-lab-mesh`. Não enviar DPAPI, DB Mesh,
código temporário, tokens, desafio de vínculo ou chaves. Após remoção completa,
logs locais deixam de existir; coletar somente informações necessárias antes dela.

## Evidência e primeira prova

Testes automatizados cobrem código único, recuperação sem duplicata, revogação,
identidade autenticada do motor, expiração/reemissão, isolamento por grupo/dono e
unicidade do Node ID. Testes de relay/quadros não capturam tela Windows.
VM valida build e comunicação backend/broker com TLS. Não consegue validar Win32,
UAC, DPAPI, Job Object, atalhos/ACLs, reversão real, captura e consentimento nativo.

O usuário confirmou assinatura e cadeia LAB pelo Explorer do candidato, sem executá-lo.
A primeira prova será instalar A → confirmar cadastro/código → instalar B → confirmar
código → solicitar/aceitar → imagem/controle → encerrar em A e confirmar interrupção.
Aguardar resultado a cada etapa. Contorno azul e controlador web permanecem etapas
posteriores; o indicador atual é a barra nativa Mesh/estado do aplicativo.
