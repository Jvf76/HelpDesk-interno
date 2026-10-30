# Uai Suporte 0.4 — aplicativo único, conexões assistidas

Esta versão substitui os perfis Técnico/Cliente. Há um produto Windows
`UaiSuporte.exe` e um instalador `UaiSuporte-Setup-0.4.0-Lab.exe`. A tela principal
mostra **Seu código** e **Conectar a outro computador**. Não há separação por
função TI/NOC para conectar. Administração de cadastros continua restrita.

**Adendo aprovado:** controlador Windows e web compartilhando React; receptor
Windows obrigatório. Ver [documento16](16-controladores-indicador-e-qualidade.md).
A restrição anterior ao Windows refere-se ao que está implementado, não ao escopo final.

## Identidade, código e consentimento

Premissa preservada: contas individuais autenticadas no servidor. Qualquer conta
ativa, inclusive contas armazenadas com o papel legado SOLICITANTE, pode solicitar
conexão. Não há acesso anônimo nem credencial administrativa compartilhada. O nome
mostrado na solicitação vem da conta autenticada do servidor, não do texto enviado
pelo computador solicitante. Um código identifica o destino; não é uma senha.
O código atual é o UUID aleatório do cadastro, não um número curto sequencial.

`POST /api/connections` recebe `{code,mode}` (VIEW ou CONTROL), registra auditoria
e cria PENDING. Nenhum share remoto é criado nesse momento. A pessoa atendida
pode recusar, permitir somente visualização ou permitir visualização e controle.
Reduzir CONTROL para VIEW muda a autorização real no backend e no motor. Depois
do aceite inicial, o viewer incorporado ainda depende do consentimento nativo
MeshAgent. Nenhum acesso não assistido foi adicionado.

O aplicativo só mostra Seu código quando existe identidade individual local
provisionada. Sem cadastro, mostra pendência; não inventa dispositivo/código online.
A recepção usa identidade de agente separada da conta usada para solicitar acesso.
Este computador e o viewer são abas do mesmo processo; uma barra sempre visível
expõe o estado da recepção e ENCERRAR ACESSO A ESTE COMPUTADOR. O botão encerra
primeiro o processo Mesh dedicado, antes de tentar confirmar o término pela rede.
Fechar o aplicativo e bloquear o Windows continuam interrompendo a recepção.

## Autorização e abuso

Para conexões assistidas novas, não se exige grant prévio por técnico: exige-se
conta ativa/sessão autenticada válida, dispositivo não revogado e online, código
exato, motor configurado e consentimento local. Credenciais expiradas, logout,
revogação da conta ou do dispositivo e perda de heartbeat invalidam a sessão.
Token de transporte curto e lease do motor permanecem. O consentimento é por
sessão e modo, nunca uma liberação permanente por código.

Limites persistidos por janela de um minuto: 5 tentativas por conta, 5 por destino,
60 por IP observado pela API. Incluem códigos inválidos; respostas indisponíveis
não expõem cadastro. No laboratório o IP observado é o proxy loopback, portanto
esse limite é compartilhado; limites por conta e destino continuam individuais.
Não se confia em X-Forwarded-For arbitrário para relaxar esse controle.

Histórico `GET /api/connections` mostra somente as próprias solicitações (100 mais
recentes). Leitura/stop/launch de sessão de outra conta continuam bloqueados, salvo
supervisão administrativa prevista. O diretório completo de computadores/usuários
não é aberto aos usuários comuns. Podem informar código de destino não listado.

Migração V3 adiciona consent_only e connection_attempt; não apaga usuários,
dispositivos, grants ou histórico. Coluna technician_id e rótulos internos legados
continuam por compatibilidade de dados; representam o solicitante autenticado.
Sessões criadas pela API legada /sessions mantêm seu modelo antigo de grants para
não reinterpretar permissões de sessões existentes; o aplicativo novo usa somente
/connections para solicitar. Rotas administrativas legadas não são o fluxo Conectar.
Os testes antigos continuam verificando a compatibilidade e as restrições de dados.

## Componentes reaproveitados

- `desktop/UaiSuporte.App`: único executável WinForms/WebView2, React e viewer
  locais incorporados, cookies/CSRF nativos, navegação externa bloqueada.
- `desktop/UaiSuporte.Receiving`: biblioteca interna de recepção, sem executável
  ou instalador próprios. Mantém consentimento, DPAPI e Job Object do Mesh.
- `desktop/UaiSuporte.Transport`: ponte HTTPS restrita e políticas de origem.
- `desktop/UaiSuporte.Setup`: único assistente administrativo, sem seleção de perfis.
- Spring Boot/PostgreSQL/MeshCentral, CA e TLS existentes preservados.

Origem local da interface: https://uai-suporte.invalid. Não baixa HTML/JS/CSS.
Dados locais novos: `%LOCALAPPDATA%\UaiTelecom\UaiSuporte`; identidades antigas não
são migradas/copias silenciosamente para outro usuário. Scripts antigos de
preparação Cliente estão arquivados em docs/legacy-client-provisioning, sem uso
na entrega. Eles não devem ser executados para habilitar a recepção desta versão.

## Instalador e bloqueios ainda reais

O EXE offline inclui apenas um app, seu módulo de recepção, .NET, interface local,
WebView2 oficial completo, CA pública pinada, hosts opcionais, licenças e
um desinstalador. Não instala um segundo aplicativo. Mantém UAC e registro de
propriedade de CA/hosts descritos em docs/13. Novo diretório Program Files:
UaiTelecom/UaiSuporte. Instalações LAB antigas não são apagadas automaticamente.

**Recepção remota ainda não liberada para funcionários:** MeshAgent com assinatura
aprovada, provisionamento seguro no contexto do usuário e prova real continuam
pendentes. Nenhum MeshAgent não aprovado é incluído, nenhum botão ignora assinatura,
e não se instala agente automaticamente. Sem esses itens, o app exibe cadastro
pendente e não pode receber sessão. Unificar os executáveis não resolve esse bloqueio.
A instalação não habilita inicialização automática de um receptor não provisionado.

Os componentes C# de recepção estão integrados, mas sua execução/encerramento
junto ao viewer no mesmo Windows ainda precisa ser validada. Não anunciar o produto
como pronto só porque compilou. Próxima prova continua: dois Windows autorizados,
código real → solicitante identificado → recusar/aceitar VIEW/CONTROL → imagem e
entrada reais → encerrar no destino → confirmar interrupção. Testar também expiração,
revogação, repetição de tentativas, desconexão e fechamento do app.

Build na VM: `bash scripts/build-setup.sh`. Windows de desenvolvimento:
`scripts/Build-RemoteLab.ps1` com as dependências oficiais locais conferidas.
Entrega não publicada na web. Instalação gráfica não exige terminal nem downloads
adicionais. LAB sem assinatura própria; homologação requer assinatura e teste Windows.
