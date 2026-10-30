# Uai Suporte 0.3.0 — acesso remoto interno

Produto exclusivo de acesso remoto assistido para Uai Telecom TI/NOC. Sem módulo
de chamados. Stack preservada: Spring Boot/PostgreSQL, React incorporado em
C#/.NET10/WebView2, Cliente C# e MeshCentral/MeshAgent. Código existente evoluído;
nenhum computador corporativo recebe instalação automática desta entrega.

## Mudança de escopo e preservação

O vínculo ticket_id era opcional. Foram removidos TicketController, métodos de
Access exclusivos, telas, modelos, menus, dashboard, endpoints e testes de
chamados. Solicitações remotas não aceitam nem consultam chamado. Histórico
contém apenas acessos. Não foram alterados os checksums das migrações V1/V2,
nem apagadas tabelas, registros históricos ou a FK antiga. A coluna legada é
omitida da API. Testes de sessão continuam independentes desses registros;
GET /api/tickets autenticado retorna404. Remoção física futura requer política
de retenção e backup explícito, não é requisito para o produto remoto.

## Técnico: interface e viewer incorporados

React e viewer (HTML/CSS e três scripts MeshCentral1.3.1 Apache-2.0) são recursos
dos assemblies do pacote. Não se baixa HTML/JS/CSS do servidor. O segundo
WebView2 serve https://mesh.internal/uai-viewer/index.html localmente; essa URL
é virtual apenas dentro do aplicativo, não um site publicado. Navegação remota,
frames, downloads, pop-ups e permissões de dispositivos são bloqueados. CSP
permite somente WSS para mesh.internal/meshrelay.ashx nesse viewer. A janela
principal conserva a origem uai-technician.invalid e a ponte API restrita.

POST /sessions cria pedido com deviceId e mode VIEW/CONTROL. O Cliente aceita,
recusa ou reduz CONTROL para VIEW. Depois do consentimento inicial, o técnico
abre o viewer interno. A API emite via control WSS do Mesh um bootstrap JSON,
usando o mesmo encodeCookie do motor, vinculado ao share, proprietário, IP,
modo, consentimento72, protocolo2 e expiração de no máximo60s. Não há criptografia
própria ou compartilhamento de credenciais administrativas com o Windows.
O token chega somente ao viewer local e permanece em memória. Sem consentimento
final do MeshAgent não passa imagem. A origem WSS é mesh.internal e a validação
de origem do motor continua ativa, sem allow-all de CORS.

O backend confirma os estados reais do relay a cada3s; o aplicativo consulta a
cada2s e elimina o viewer quando perde autorização/confirmação. O relay exige
lease de12s e encerra na expiração, revogação ou perda de conexão. O viewer
marca imagem renderizada somente após drawImage real; conexão sozinha não é
ACTIVE. O botão local do viewer limpa canvas, desativa entrada, fecha WSS e pede
encerramento à API. Fechar o aplicativo também fecha o viewer e pede parada.
Arquivo, comandos remotos, clipboard, gravação e acesso não assistido continuam
fora do escopo. Identificação do dispositivo é o UUID completo, sem código
curto previsível. Pesquisa por UUID/nome/setor/responsável/localidade.

## Cliente e parada local

UaiSuporte.Client.exe é a evolução do projeto agent/UaiSuporte.Agent. Não tem
funções administrativas ou para acessar outros computadores. A TI prepara os
arquivos e vínculo de uso único; o funcionário apenas aceita/recusa/encerra.
Credencial individual e configuração são protegidas por DPAPI CurrentUser.
O código de vínculo é apagado da configuração após consumo. Não há segredo
permanente ou senha de administrador no ZIP.

A instância dedicada do MeshAgent é executada como processo filho interativo
com argumento run (suportado pelo código upstream), nunca instalando serviço
nem usando agentes existentes. Um Job Object Windows com KILL_ON_JOB_CLOSE
limita o filho e descendentes: botão ENCERRAR AGORA, fechamento ou falha do
Cliente encerram essa instância. A parada do processo precede qualquer chamada
HTTPS e verifica sua saída; falha de confirmação é mostrada explicitamente.
Nenhum PID de agente alheio é procurado ou encerrado. Após parada ou perda de
contato, é necessário Retomar disponibilidade, que invalida pedidos antigos
antes de iniciar outra instância. A barra nativa MeshAgent continua obrigatória.

O Cliente permanece visível, mostra identificação, conexão, técnico e modos no
consentimento. Em sessão ativa, a janela muda de cor e fica acima das outras.
A presença na API é o último heartbeat do Cliente (30s), não uma prova de que
MeshAgent já terminou a conexão. Um processo filho iniciado não comprova captura.
A associação de Node ID é feita explicitamente pela TI no aplicativo Técnico,
para evitar vincular silenciosamente o computador errado.

Inicialização automática ocorre no LOGIN do usuário, pela pasta Startup do
Windows. Não há captura na tela de login, antes do login, em Session0 ou área
segura UAC. Bloqueio do Windows para o motor; desbloquear requer retomar.
Múltiplos monitores, troca de usuário, políticas corporativas, job Windows,
consentimento nativo e parada física ainda exigem prova em dois Windows reais.

## Pacotes e preparação pela TI

Arquivos:
- dist/uai-suporte-tecnico-0.3.0-win-x64.zip
- dist/uai-suporte-cliente-0.3.0-win-x64.zip
- dist/remote-0.3.0-SHA256SUMS (hashes externos aos ZIPs).

.NET10 está incluído. Técnico requer WebView2 Runtime Evergreen atualizado;
Cliente não requer WebView2. Preferir Windows11x64 no laboratório.
Os executáveis próprios desta entrega NÃO possuem Authenticode corporativo.
Os ZIPs contêm os avisos de licença e instruções. Não contornar SmartScreen,
WDAC, AppLocker, Defender, política PowerShell ou validação TLS.

O ZIP Cliente NÃO contém MeshAgent nem MSH de enrollment. Não se redistribui
um binário cuja assinatura ainda não foi validada. A TI precisa obter o
MeshAgent x64 e o MSH do grupo dedicado Uai-Laboratorio pelo servidor Mesh,
com TLS confiado, e conferir assinatura/origem. Prepare-ClientLab.ps1 exige
Authenticode Valid do MeshAgent; os avisos ASN.1 anteriores não foram contornados.
Caso não exista binário compatível com assinatura válida, preparação fica
BLOQUEADA até correção/assinatura corporativa. O pacote Cliente sozinho não
comprova que o atendimento está pronto. Não execute o instalador de serviço
MeshAgent em paralelo: este perfil usa somente processo filho dedicado.

Depois de validar hash e política de execução, a TI extrai o Cliente em pasta
nova e executa no contexto do funcionário de teste:

    .\Prepare-ClientLab.ps1 -MeshExe 'C:\Laboratorio\meshagent.exe' -MeshSettings 'C:\Laboratorio\meshagent.msh'

O script pede o código de cadastro sem eco, copia app/mesh para
%LOCALAPPDATA%\UaiTelecom\Cliente, protege configuração, registra Startup, mas
NÃO inicia processos. Rejeita destino já existente; não sobrescreve identidades.
Nenhuma credencial entra nos argumentos ou no ZIP. Iniciar manualmente:

    & "$env:LOCALAPPDATA\UaiTelecom\Cliente\app\UaiSuporte.Client.exe"

Quando o node aparecer no grupo Mesh, a TI confere nome/computador físico e
associa seu Node ID ao UUID cadastrado no aplicativo Técnico. O funcionário
não faz essa configuração. Remoção: encerrar sessão, fechar Cliente, executar
Remove-ClientLab.ps1; revogar cadastro na API e node no grupo Mesh. Preserva
outros agentes e usuários. Não execute scripts antigos agent/install.ps1.

## Transferência e sequência de teste — uma etapa por vez

No Windows Técnico já com CA e hosts corretos, baixar pelo HTTPS restrito:

    $name = 'uai-suporte-tecnico-0.3.0-win-x64.zip'
    Invoke-WebRequest "https://suporte.internal/lab/$name" -OutFile "$env:USERPROFILE\Downloads\$name"
    Get-FileHash "$env:USERPROFILE\Downloads\$name" -Algorithm SHA256

Para o segundo Windows, trocar name por uai-suporte-cliente-0.3.0-win-x64.zip.
Conferir hashes antes de extrair; não desabilitar TLS. A CA exclusiva do
laboratório e hosts continuam os mesmos (ver docs08). Endereços:
https://suporte.internal API e https://mesh.internal WSS, ambos443. PostgreSQL,
API interna e Mesh interno continuam privados. Somente origem autorizada.

Roteiro a executar somente quando houver dois Windows autorizados:
1. Conferir hashes, assinaturas/política e dependências; extrair em pastas novas.
2. Técnico: executar UaiSuporte.Technician.exe, login, confirmar lista sem chamados.
3. TI: cadastrar dispositivo, preparar Cliente, conferir node e vínculo; habilitar
   permissão VIEW ou CONTROL apenas para o técnico de teste.
4. Solicitar VIEW e RECUSAR no Cliente: nenhuma imagem/entrada, resultado recusado.
5. Novo pedido CONTROL; permitir apenas visualização no Cliente e confirmar no
   MeshAgent: ver tela sem conseguir controlar. Encerrar pelo Cliente.
6. Novo pedido CONTROL; aceitar as duas confirmações: imagem dentro do aplicativo;
   mover mouse e digitar somente em um Bloco de Notas vazio de teste.
7. Clicar ENCERRAR AGORA no Cliente: confirmar imediatamente que o processo
   dedicado terminou, canvas do Técnico foi removido e mouse/teclas não atuam.
   Conferir horário/resultado no histórico. Não basta o botão mudar de texto.
8. Repetir com expiração60s, revogação de permissão, fechamento do Técnico,
   fechamento do Cliente e perda de rede autorizada. Não interromper rede produtiva.
9. Conferir registros e relatar resultado antes de prosseguir para cada caso.

Logs: Técnico %LOCALAPPDATA%\UaiTelecom\Technician\technician.log;
Cliente %LOCALAPPDATA%\UaiTelecom\Cliente\client.log. Códigos de estado, sem
senhas/cookies/captura. Servidor: journalctl --user -u uai-lab-backend -u uai-lab-mesh;
NGINX usa URI sem query, não registra tokens. Não enviar DB do Mesh nem identidade
DPAPI em relatórios. Código e testes não equivalem à homologação Windows.

## Evidências atuais

Veja [resultados0.3](11-resultados-03.md). A abertura/login/logout confirmados
no Windows pertencem à versão0.2; não comprovam o viewer ou Cliente0.3.
