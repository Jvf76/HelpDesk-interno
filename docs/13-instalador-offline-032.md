# Uai Suporte — instalador offline LAB 0.3.2

Entrega única: `UaiSuporte-Setup-0.3.2-Lab.exe`. Sem ZIP de entrega, página de
download, scripts no computador atendido ou busca de dependências na instalação.
Transporte pela TI via SCP durante desenvolvimento; depois, pasta compartilhada,
pendrive ou ferramenta interna. Nenhuma máquina é instalada automaticamente.

## Estado real dos perfis

**Prestar suporte habilitado:** aplicativo Técnico 0.3.0 com React e viewer local,
.NET10 autocontido, atalho para todos os usuários no menu Iniciar, configuração
HTTPS, CA pública LAB, configuração opcional de hosts, WebView2 oficial completo,
licenças, ícone e desinstalador. Não instala Cliente, MeshAgent nem serviço.

**Receber suporte BLOQUEADO na interface e sem caminho de instalação no código
0.3.2.** O binário Cliente 0.3.0 está incorporado como artefato, mas não é extraído
na instalação. MeshAgent NÃO incluído: assinatura/configuração/vínculo seguro e
fluxo real entre dois Windows ainda não foram homologados. Não fornecer arquivos
avulsos nem contornar o bloqueio. Habilitar esse perfil exige uma nova versão com
motor aprovado e testes Windows, incluindo cadastro por código de uso único,
identidade no contexto correto do funcionário e encerramento local efetivo.
Nenhuma senha, credencial Mesh, token permanente, MSH ou chave privada está no EXE.

## Instalar no Windows de laboratório

1. TI copia e confere o hash do executável. Windows x64 e cerca de 2 GB livres.
2. Duplo clique; o manifesto solicita UAC/administrador. Pacote LAB ainda sem
   Authenticode corporativo. Se políticas bloquearem, interromper e tratar com TI.
3. Escolher Prestar suporte, conferir identificação/hash da CA, ler termos
   Microsoft incorporados e autorizar explicitamente as alterações da máquina.
4. Manter opção de hosts se não há DNS corporativo. Conflitos não são sobrescritos.
5. Instalar e concluir. Abrir **Uai Suporte - Prestar suporte** pelo menu Iniciar,
   no usuário normal. O instalador elevado não inicia o aplicativo como administrador.

Instalação global em `%ProgramFiles%\UaiTelecom\UaiSuporteLAB`. Os dados da
aplicação permanecem por usuário em LocalAppData. Não há DPAPI vinculada ao
administrador do instalador para cadastro do Cliente, pois esse perfil está bloqueado.
Login continua no aplicativo e depende de conexão com o backend. A instalação
não exige conexão ao servidor; a checagem HTTPS final é informativa e não desfaz
uma instalação offline concluída. Origem da rede ainda precisa estar autorizada
na infraestrutura; o instalador não abre firewall/provedor para a internet.

## CA e hosts, propriedade e remoção

CA: **Uai Suporte LAB 131.0.112.23 2026-10-27**.
SHA-256 DER: `A1FFB98EB2364BB6EF0B30F5FD5AE61F1689FFFBA1CA6F1510641EAD624D7138`.
Somente essa CA pública é incluída. Antes de adicionar em LocalMachine/Root,
o código verifica hash, nome, BasicConstraints, ausência de chave privada e
validade. O assistente registra se adicionou ou encontrou a CA preexistente.
Não importa raízes Microsoft nem altera verificações TLS do sistema.

Hosts: mapeia `suporte.internal` e `mesh.internal` para `131.0.112.23` apenas
quando ausentes; ignora entradas corretas preexistentes. Entradas conflitantes
bloqueiam a instalação antes das mudanças de confiança/nomes. O bloco novo tem
marcadores BEGIN/END UAI-SUPORTE-LAB e ID único. Bytes das demais entradas,
comentários e codificação compatível são preservados. Backup privado ao diretório
administrativo: hosts-before.bin. DNS administrado pela empresa é preferível na
versão definitiva; não usar IP público fixo de laboratório em produção.

Desinstalar em **Configurações > Aplicativos > Uai Suporte LAB** ou menu Iniciar.
Fecha-se o aplicativo manualmente antes. Remove apenas arquivos/atalhos do perfil
e o bloco hosts exato de propriedade desta instalação. Se o bloco foi alterado
externamente, suspende a remoção para revisão da TI, sem restaurar todo o hosts.

A CA só é removida se foi adicionada pelo instalador, não há componente Cliente
no diretório de instalação e a TI confirma expressamente que nenhum outro
componente ou usuário depende dela. Não é possível inferir automaticamente todos
os consumidores de uma CA no Windows. Sem essa confirmação, preserva a CA e
informa isso. CA preexistente e cópia em CurrentUser nunca são removidas.

WebView2 compartilhado é preservado. Identidades antigas, logs e dados de usuários
não são apagados. O EXE do desinstalador em uso é agendado para exclusão no reboot;
reiniciar antes de reinstalar. Auditoria e registro de propriedade ficam preservados
em Program Files, permitindo rastrear uma CA mantida. Instalação parcial mantém
entrada de desinstalação para limpeza explícita; não promete rollback transacional
do instalador Microsoft. Nenhuma aplicação existente é encerrada à força.

## WebView2 incorporado e assinatura

Incluído instalador oficial **Evergreen Standalone x64**, 214884560 bytes,
SHA-256 `1c401b327fbc7bb9731b4e350a2194f083cbc3ede46508d52e1cae6610a39bea`,
obtido em 28/10/2026 por HTTPS da Microsoft, sem alterações. Não é o bootstrapper.
Fonte: https://go.microsoft.com/fwlink/p/?LinkId=2124701
[Distribuição offline oficial](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).
Licença completa incorporada e exibida na janela; arquivo também instalado com
os avisos React, .NET, SDK WebView2 e MeshCentral. A documentação Microsoft permite
incluir o instalador standalone com a aplicação.

Detecta runtime por máquina no registro oficial EdgeUpdate (pv). Se ausente,
extrai no diretório protegido, confere SHA-256, exige WinVerifyTrust válido e
executa `/silent /install`, aguardando código de retorno e confirmação no registro.
A verificação usa somente evidências de revogação em cache (sem fazer downloads
na instalação); **não ignora revogação**. Windows sem cadeia/cache de confiança
suficiente pode bloquear: TI deve preparar a confiança via administração do Windows,
sem desabilitar verificações. Esse cenário offline ainda precisa ser testado.
Atualizações futuras normais do runtime Microsoft continuam sob políticas da empresa;
não são usadas para baixar a interface React, que continua incorporada.

Validação na VM: osslsigncode confirmou digest e assinatura primária Microsoft
Corporation/PCA2024 usando a raiz pública Microsoft Root Certificate Authority2011
obtida da Microsoft (somente ferramenta de verificação, não incluída nem instalada
como raiz no pacote). Há também assinatura secundária EdgeBuild autoassinada,
rejeitada pela ferramenta; resultado global da assinatura primária foi Succeeded.
Não ocultar esse diagnóstico nem tratá-lo como validação Windows. WinVerifyTrust
na máquina alvo continua obrigatório antes de executar o instalador Microsoft.
A assinatura do setup Uai é outra questão: LAB não assinado; homologação aos
funcionários requer assinatura corporativa e testes reais.

## Build e testes

Na VM: `bash scripts/build-setup.sh`. Pré-requisitos de build em `.tools/setup-deps`:
instalador oficial acima e webview2-license.txt extraído do endpoint oficial
`https://developer.microsoft.com/microsoft-edge/api/eula/webview2?locale=en-us`.
A CA vem de `.tools/lab/exports/uai-lab-ca.cer`. Hashes são fixados no build;
nenhuma chave privada é acessada. Não há download no código do instalador.

Testes portáveis cobrem política de MSH legada, CA pinada e hosts: preservação de
bytes/entradas, conflitos, remoção exclusiva, alterações externas e codificação.
Compilação cruzada win-x64 não valida UAC, WinForms, store Windows, instalação
WebView2, atalhos, registro, reinício ou desinstalação. Esses cenários permanecem
pendentes de prova em Windows. Atendimento real entre dois Windows não homologado.

Logs: `%ProgramFiles%\UaiTelecom\UaiSuporteLAB\setup-audit.log`, registro
`install-state.json` e logs próprios do instalador oficial WebView2 sob Windows Temp.
Sem senhas ou tokens. Antes de enviar logs, não incluir arquivos de identidade.
