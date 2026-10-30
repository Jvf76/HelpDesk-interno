# LAB 0.6.0 — identidade do dispositivo, sem login Windows

## Contrato e separação de identidades

O aplicativo incorporado mostra ativação, código público e conexão. Não chama `/auth/login`, `/auth/me` ou `/auth/logout`. A versão web mantém sessão de usuário, cookie e CSRF. A ponte nativa permite somente identidade, conexões e sessões do próprio dispositivo. Um bearer de dispositivo não concede administração web.

A administração emite um token em `POST /api/activation-tokens`, com `lifetimeSeconds` entre 30 e 3600; padrão da interface: 10 minutos. Tokens têm 256 bits aleatórios, organização `UAI_TELECOM`, hash SHA-256 no banco e auditoria por ID não secreto. A emissão exige ADMIN + CSRF. `POST /api/activation-tokens/{id}/revoke` revoga um token ainda não utilizado. Expiração é auditada pelo agendador ou pela tentativa de uso. Não colocar tokens em terminal, URL, configuração ou logs.

`POST /api/agent/activate`: token, installationId, credential, name, os e recoverDeviceId opcional. O aplicativo gera uma credencial aleatória de 256 bits e persiste sua proteção antes da chamada; o servidor atribui essa credencial exclusivamente ao cadastro e guarda somente seu hash. Essa escolha preserva o mecanismo recuperável anterior e permite revogar até uma ativação cuja resposta tenha sido perdida. O segredo não é gerado a partir do código público. A resposta contém apenas deviceId e code.

O consumo usa transação e bloqueio de linha. Repetir o mesmo token, installationId e credencial recupera o mesmo dispositivo; outro solicitante recebe token usado. Revogação invalida também essa recuperação. O código público é alfanumérico de 12 posições, exibido em grupos de quatro. UUIDs antigos continuam identificando os registros existentes; a migração adiciona código sem apagar cadastros.

Credenciais existentes e válidas são preservadas. `/devices/register` retorna 410, não cadastra novos dispositivos por login. As rotas administrativas anteriores de recuperação/enrollment continuam exigindo autorização administrativa e token temporário, sem conceder controle sem consentimento.

## Proteção Windows e vínculo

DPAPI CurrentUser, ACL com usuário proprietário/SYSTEM/Administrators e entropia vinculada ao MachineGuid do Windows. Arquivos novos têm envelope UAI2. Arquivos legados DPAPI são migrados somente após descriptografia bem-sucedida no contexto original. Isso não oferece proteção contra um administrador local malicioso ou clonagem integral do Windows e do perfil; esse cenário exige identidade baseada em hardware/TPM e outra etapa de homologação.

O token de ativação permanece apenas em memória durante a chamada; o campo é apagado após enviar. A credencial não é entregue ao React. Copiar os arquivos para outro computador/usuário não é um método suportado de migração. A garantia de rejeição precisa de teste Windows real.

O cadastro só fica disponível após o desafio temporário de vínculo do MeshAgent, confirmação pelo motor e heartbeat autenticado. O aplicativo confere hash e Authenticode antes de iniciar o MeshAgent. Não há download de executáveis adicionais ou execução isolada do agente pelo funcionário.

A inicialização é no **logon do usuário Windows**, com interface visível, não um serviço oculto antes do login. UAC, desktop seguro e tela de login continuam fora do escopo. Perfil Windows diferente não herda a credencial.

## Reativação, rotação e remoção

A rotação desta versão é administrativa: revogar o dispositivo e emitir token com `recoverDeviceId` do mesmo registro. O aplicativo prepara uma nova credencial em `activation-recovery.bin`, preserva o cadastro anterior até a confirmação e repete com os mesmos dados após falhas. O servidor preserva o código público e substitui o vínculo somente quando o token corresponde ao registro revogado. Não existe botão de redefinição de identidade nem rotação automática silenciosa.

O painel administrativo oferece emissão/revogação de tokens novos e seleção de cadastro revogado para recuperação direcionada. Não é necessário orientar funcionários a usar terminal.

Desinstalação revoga credenciais individuais, inclusive as pendentes, antes de apagar dados. Sem confirmação do servidor, mantém o bloqueio e os registros de limpeza para tentar novamente. Remove apenas componentes próprios; CA e hosts seguem a política de propriedade existente. Pode ser necessário reiniciar para remover o executável do próprio desinstalador. Reinstalação limpa exige novo token; recuperar o código anterior exige token administrativo direcionado. Não instalar por cima de uma instalação existente.

## Sessão e indicação local

Dispositivos autenticados usam `/api/desktop/identity`, `/connections`, `/sessions/{id}`, `/sessions/{id}/launch` e `/sessions/{id}/stop`. Authorization e X-Uai-Device são definidos nativamente. O backend verifica a credencial, propriedade da sessão, disponibilidade do solicitante e alvo, prazo e consentimento. Revogação de qualquer participante encerra o lease. Usuário Windows é metadado informativo declarado pelo aplicativo, não uma autenticação de usuário.

Auditoria registra dispositivo solicitante, código, nome, usuário Windows informado, alvo, modo, consentimento e término. O contorno nativo azul e uma barra por monitor são criados após aceite local, antes da liberação do visualizador. A borda ignora cliques; a barra tem Encerrar acesso. A perda de uma janela de indicação ou mudança de monitores solicita parada local do MeshAgent dedicado. Tela cheia exclusiva, múltiplos monitores e interação com o indicador precisam de validação real. Encerramento local mata o processo dedicado antes de aguardar o servidor.

## Limitações de validação

Compilação Linux com target Windows não valida DPAPI, WinVerifyTrust, ACL Windows, Job Object, início no logon, UAC, monitor físico, instalação, rollback ou desinstalação reais. Testes de política não substituem esses testes.

A versão web continua com login, dispositivos e administração. O **controlador remoto web ainda não foi implementado**; seus botões continuam bloqueados. Esta entrega não afirma que navegador já controla Windows.

Nenhuma instalação é realizada automaticamente. A homologação exige dois Windows: ativar A, confirmar código/online, ativar B, solicitar, aceitar, visualizar, controlar, encerrar no alvo e conferir que imagem/entrada cessam. Também testar recusa, perda de rede, revogação, expiração, reinício e cópia de arquivos para outra máquina.
