# Instalador gráfico de laboratório 0.3.1

**Histórico, substituído pelo [instalador offline 0.3.2](13-instalador-offline-032.md).**
O perfil Receber suporte agora está bloqueado até homologação do motor. A entrega
atual é um único EXE para distribuição interna, sem publicação web.

O executável `UaiSuporte-Setup-Lab-0.3.1-win-x64.exe` contém os aplicativos
Técnico e Cliente 0.3.0 com .NET autocontido. A versão 0.3.1 é do assistente;
não muda o protocolo remoto. Não há instalação automática feita pelo servidor.
Não é necessário terminal para usar o assistente. Ele não baixa código da UI.

## Dois perfis no mesmo assistente

- **Prestar suporte:** instala o Técnico, com login e viewer incorporados, e
  cria atalhos na área de trabalho e no menu Iniciar. Requer WebView2 Evergreen.
- **Receber suporte:** instala Cliente e MeshAgent dedicado, com atalho e
  inicialização visível no próximo login do usuário. Não instala serviço Windows.
  O funcionário continua precisando autorizar cada acesso localmente.

Execute na conta Windows que utilizará o aplicativo, sem elevação ou troca
para uma conta administrativa. Destinos: `%LOCALAPPDATA%\UaiTelecom\Technician\app`
e `%LOCALAPPDATA%\UaiTelecom\Cliente\app`. O assistente não abre automaticamente
o aplicativo ao terminar; oferece o botão **Abrir Uai Suporte**.

## Pré-requisitos que o instalador não pode substituir

Os dois nomes `suporte.internal` e `mesh.internal` devem resolver para
`131.0.112.23`, a origem de rede deve estar autorizada, e a CA exclusiva do
laboratório deve estar confiada no usuário Windows (ver docs/08). O assistente
verifica HTTPS nos dois servidores, sem aceitar certificado inválido, alterar
hosts ou instalar certificados. O instalador próprio ainda não tem assinatura
Authenticode corporativa. Se SmartScreen, Defender, WDAC ou outra política
bloquear, interrompa e solicite assinatura/aprovação à TI. Não desligue proteções.

Para **Receber suporte**, a TI fornece pela janela:

1. MeshAgent Windows x64 aprovado, obtido do laboratório ou do processo de
   assinatura corporativa, com Authenticode válido.
2. Arquivo MSH do grupo dedicado Uai-Laboratorio. O MSH não é público e não deve
   ser enviado ao GitHub. Apenas opções usuais do grupo são aceitas; opções
   adicionais bloqueiam a preparação para revisão.
3. Código temporário de cadastro, gerado para o dispositivo no aplicativo
   Técnico. Não é senha administrativa. Abra o Cliente antes de expirar (10 min).

O instalador **não inclui MeshAgent nem MSH**, pois a validação de assinatura
do motor ainda está pendente. Ele verifica a cópia local do binário pelo
WinVerifyTrust do Windows, incluindo revogação, e grava o SHA-256 usado pelo
Cliente. Falha de assinatura, cadeia ou consulta de revogação bloqueia a
instalação. Não existe opção para ignorar. Referência da política nativa:
[Microsoft WINTRUST_DATA](https://learn.microsoft.com/en-us/windows/win32/api/wintrust/ns-wintrust-wintrust_data).

O cadastro temporário é protegido com DPAPI CurrentUser. Nenhuma credencial
permanente é incorporada no instalador. Ainda é necessário que a TI confira o
computador no MeshCentral e associe seu Node ID ao dispositivo no Técnico.
O assistente não concede permissões nem confirma essa associação automaticamente.

## Primeiro teste: uma ação por vez

1. Baixar o instalador pelo HTTPS confiável no segundo Windows. Conferir o
   SHA-256 publicado em `setup-0.3.1-SHA256SUMS.txt` antes de executar.
2. Abrir e confirmar que aparecem os dois perfis. Não clicar Instalar até a TI
   fornecer os arquivos e o código. Comunicar o resultado antes de prosseguir.
3. Com os pré-requisitos conferidos, selecionar Receber suporte e os arquivos,
   informar o código e clicar **Verificar e instalar**.
4. Somente após sucesso, abrir o Cliente e conferir cadastro/Node ID com a TI.
5. Seguir a prova de consentimento, imagem, controle e parada local em docs/10.

## Remoção e preservação

Reabra este mesmo instalador, selecione o perfil e use **Remover este perfil**.
Feche o aplicativo primeiro. O assistente não mata processos e não altera outros
agentes. Remove somente a pasta app marcada por ele e os atalhos desse perfil.
Identidades, logs e dados fora dessa pasta são preservados. A TI deve revogar o
dispositivo na API e o node Mesh; reinstalação com identidade existente é bloqueada
até revisão. Não é um atualizador: destinos ou atalhos existentes não são sobrescritos.
Instalações anteriores por script não são removidas automaticamente.

## Build e limites da validação

Na VM: `bash scripts/build-setup.sh`. Saída em `dist/`, com SHA-256 separado.
Testes: `.tools/dotnet/dotnet run --project desktop/Setup.Tests` (configuração
Mesh, destinos de extração, rejeição de caminhos que escapam do pacote).
Compilação cruzada não valida UI WinForms, Authenticode, DPAPI, atalhos, inicialização
Windows ou remoção. Essas verificações e o atendimento entre dois Windows
continuam pendentes. O pacote não significa que o acesso remoto foi homologado.
