# Entrega LAB 0.5 — cadastro integrado (28/10/2026)

- Arquivo: `/home/agenda/uai-entregas/UaiSuporte-Setup-0.5.0-Lab.exe`. Tamanho: 481455073 bytes.
- SHA256: `8ca406fab0412493b66cca15244e78b5193d5294deb0dbbe1453bf2a0e23dc16`.
- Inclui aplicativo único, React/viewer locais, .NET autocontido, MeshAgent LAB
  assinado, WebView2 Microsoft Fixed156.0.4314.50 privado, CA pública, licenças e
  assistente/desinstalador. Não contém identidade, segredo permanente compartilhado,
  MSH pronto ou chaves privadas de assinatura.
- Vínculo por desafio de120s enviado exclusivamente pelo canal nativo autenticado;
  Node ID obtido dessa conexão, grupo/dono/prazo conferidos, índice único no banco.
  Credencial API individual/DPAPI e código público distintos; código temporário de
  cadastro de uso único. Formulário não atribui Node ID e edição preserva vínculo.
- Core servido pelo MeshCentral: corrigido para que meshcore.min.js carregue o
  mesmo código revisado de meshcore.js. Antes, a preferência pelo arquivo minificado
  poderia omitir as alterações nativas. Novo teste verifica ambos os caminhos.
- Reversão/desinstalação implementadas com revogação, limpeza de dados próprios,
  hosts/CA somente quando pertencentes ao instalador e atalhos. Reversão sem rede
  fica explicitamente pendente, motor encerrado/configuração de recepção retirada,
  app bloqueado e registro/credencial DPAPI preservados para concluir pela rede.
  Não declarar atomicidade entre Windows e servidor durante indisponibilidade.
- Execução interativa por usuário: LAB exige mesma conta Windows na elevação.
  Outra conta/UAC, serviço antes do login e múltiplos usuários não homologados.
- Runtime privado permite remover a dependência junto com o app, sem alterar
  runtimes preexistentes. CAB/EXE Microsoft verificados; hashes de todos os arquivos
  fixados e conferidos no build/instalador. Sandbox preservado com ACLs recomendadas.

## Verificações realizadas na VM

- 43 testes Java passaram; 2 testes opcionais de conexão real omitidos.
- 17 testes Node do motor passaram, incluindo desafio/expiração/grupo/dono, core
  efetivamente servido e encerramento/recusa/VIEW em transporte simulado.
- 33 verificações de políticas do instalador passaram (hosts, CA, ZIP e bloqueio
  de instalação incompleta/reversão). Não são teste de alterações Win32 reais.
- 28 verificações de transporte, 14 React/ponte, 2 de qualidade e viewer passaram.
- Build/publish Windowsx64 dos componentes passou. ZIP interno conferido por CRC,
  componentes presentes, hash Mesh e runtime conferidos; pacote externo hash acima.
- Banco V5 aplicado; backend e core ativos conferidos contra os arquivos testados.
  Backup final de servidor: `.tools/lab/backups/integrated050-final-20261028T160609Z`;
  backup pré-V5: `.tools/lab/backups/integrated-v5-20261028T154312Z`.
- HTTPS/CA, login/logout e API passaram. WSS real entre VM/backend/Mesh confirmou
  emissão/configuração/consulta/cancelamento do desafio, sem simular cadastro de PC.
  Nenhuma ampliação de ACL ou alteração de Nginx. Nenhum instalador publicado na web.

## Evidência Windows e pendências

Operador confirmou hash, assinatura e cadeia do MeshAgent pelo Explorer, sem
executá-lo. A instalação integrada0.5, WinVerifyTrust no assistente, DPAPI, ACLs,
atalhos, reversão/desinstalação e o Fixed Runtime ainda não foram executados em
Windows real. Captura, consentimento, mouse/teclado e parada entre dois PCs seguem
pendentes. Contorno azul e controlador web permanecem etapas posteriores.

Próxima ação é copiar/conferir este instalador no WindowsA; aguardar confirmação
antes de emitir código temporário e orientar o assistente. Não executar agente avulso.

# Atualização — cadeia Authenticode confirmada pelo operador e backend V4

- Windows: operador confirmou hash final, assinatura válida do editor Uai Telecom
  LAB - MeshAgent e cadeia/CA Uai Suporte LAB 131.0.112.23 2026-10-27 válida no
  Explorer. Agente não executado nem instalado; evidência relatada, não observação
  direta nesta VM. Não equivale a testar a política WinVerifyTrust do aplicativo.
- Backend: Maven package passou com 40 testes, zero falhas/erros; 2 testes opcionais
  de conexão real omitidos. Cópia anterior do JAR e pg_dump foram preservados em
  `.tools/lab/backups/enrollment-v4-20261028T151925Z`; pg_restore --list conferido.
- Zero sessões abertas e zero dispositivos antes da implantação. Apenas o backend
  reiniciado. PostgreSQL aplicou V4 com sucesso, sem remover dados/migrações antigas.
- Primeiro teste HTTP ocorreu durante inicialização e falhou; repetido após a
  aplicação ficar pronta: HTTPS painel/motor, login/logout, dispositivos/histórico
  e rejeição de CA não confiada passaram. Quatro serviços permanecem ativos.
- Instalador atual não inclui MeshAgent. Configuração MSH, associação comprovada
  de Node ID ao cadastro e preparação pelo assistente ainda pendentes; não orientar
  execução avulsa do agente como se isso realizasse o vínculo.
- Nenhum novo instalador, alteração visual, instalação em Windows ou teste remoto
  entre duas máquinas nesta etapa. Não há nova ação de instalação para o operador.

# Atualização de 28/10/2026 — arquitetura web e candidato MeshAgent LAB

- Escopo confirmado no documento16: Windows recebe; aplicativo ou navegador
  controlam. Web, toque e contorno por monitor ainda não implementados.
- Viewer incorporado recebeu adaptação de JPEG/escala/intervalo, perfis manuais,
  RTT com expiração da medição e limpeza de timers/canvas ao encerrar. SDK original
  preservado; sem novo protocolo. Prioridade de transporte e reconexão da
  sinalização ainda pendentes; sem retomada silenciosa de autorização encerrada.
- `cd frontend && npm run test:e2e`: 2 testes de qualidade, 14 verificações
  React/ponte, viewer VIEW/CONTROL com JPEG, RTT, qualidade e encerramento passaram.
  Transporte simulado, não captura Windows nem medição real de desempenho.
- Assinatura LAB dedicada emitida; osslsigncode verificou digest, cadeia LAB,
  timestamp RFC3161 Sectigo e CRL. Arquivo adulterado rejeitado. Ver documento15
  e infra/mesh/agent-provenance.json para hash, origem, editor e validade.
- CRL pública publicada no HTTPS interno existente; verificação de acesso somente
  pela VM. Não foi criada página de downloads nem alterado firewall/Nginx.
- Build C# do aplicativo passou com zero avisos/erros; não executado no Windows.
- Nenhum agente instalado, nenhum instalador final gerado. Candidato apenas para
  inspeção Authenticode no Windows; approvedForInstallation continua false.
- PostgreSQL/migração V4 e backend live não alterados nesta etapa.

# Investigação de MeshAgent e provisionamento — 28/10/2026 (em andamento)

- Binário oficial MeshService64.exe legacy-1.2.6 conferido contra digest GitHub
  e manifesto fixado; Authenticode AUSENTE, sem editor de assinatura. Não aprovado
  para instalação. Dados completos em docs/15 e infra/mesh/agent-provenance.json.
- Causa ASN.1 reproduzida com a descrição Unicode do laboratório. Correção de
  preservação de bytes UTF-16 aplicada ao código fonte via patch idempotente,
  sem relaxar ASN.1 ou timestamp. 14 testes Mesh passaram; timestamp inválido
  ainda rejeitado. Não significa assinatura final nem execução Windows.
- Cadastro recuperável implementado: credencial individual persistida antes de
  enviar, recibo idempotente limitado, identidade confirmada, recuperação ADMIN
  sem duplicar UUID, revogação e limite de30 enrollments/minuto/IP. MigraçãoV4.
- 40 testes backend passaram (36 fluxos + 4 contratos), 2 opcionais Mesh sem
  ambiente ignorados. App/recepção e setup compilados sem avisos/erros. Setup
  compilado apenas para verificação; nenhum novo pacote/instalador final gerado.
- Inicialização visível por usuário condicionada a vínculo/motor válidos e
  remoção de atalhos próprios adicionadas ao código; ainda sem teste Windows.
- UI mantida. Fonte de certificado de assinatura em decisão pelo operador;
  nenhuma CA real usada para emitir/assinar, nenhum novo MeshAgent instalado,
  nenhuma alteração desta etapa aplicada aos serviços ativos/banco do laboratório.
- Fluxo remoto real, provisionamento completo no Windows, vinculação Mesh Node ID,
  assinatura final, timestamp real, instalação/remoção continuam pendentes.

---

# Aplicativo único 0.4.0 — 28/10/2026

- Único UaiSuporte.exe, biblioteca interna de recepção, UI com Seu código e
  Conectar a outro computador; instalador sem perfis. Fontes antigas movidas,
  componentes reutilizados, dados preservados. Contas comuns podem solicitar
  por código e veem apenas seu histórico; administrador não é requisito de conexão.
- Backend: 36 testes passaram (32 fluxos críticos + 4 contratos), 2 testes Mesh
  opcionais sem ambiente ignorados. Novos testes verificam conta comum, identidade
  autenticada no pedido, recusa sem transporte, downgrade para VIEW, parada local,
  revogação de usuário, privacidade de histórico e limitação de tentativas.
- React: 14 verificações com ponte simulada, incluindo conta SOLICITANTE e os dois
  elementos da tela principal; viewer com JPEG real/entrada/limpeza em transporte
  simulado passou. .NET: 28 verificações da ponte, 26 políticas do instalador.
- Aplicativo e instalador Release Windows x64 compilados sem erros/avisos.
  Inspeção do pacote: único UaiSuporte.exe e UaiSuporte.Receiving.dll, sem os dois
  executáveis anteriores, sem MeshAgent, credenciais, MSH ou chave privada.
- Laboratório atualizado com backup `.tools/lab/backups/unified04-20261028T105428`;
  não havia sessões ativas. V1/V2/V3 aplicadas no PostgreSQL; HTTPS/login/logout,
  histórico privado e rejeição de CA não confiada verificados dentro da VM.
  Quatro serviços ativos; infraestrutura/proxies/certificados preservados.
- Entrega offline: `/home/agenda/uai-entregas/UaiSuporte-Setup-0.4.0-Lab.exe`,
  381625704 bytes. SHA-256:
  `1c874b0deb79b109af687ad34907de6e4d8000fcf2847870bd926cebf8d19d1c`.
- **Não validado em Windows real:** aplicativo único, integração do receptor com
  viewer, instalação/remoção e prova entre dois PCs. Assinatura/configuração do
  MeshAgent e provisionamento seguro permanecem bloqueios da recepção, não
  resolvidos por unificar a UI. Sem identidade local o app informa cadastro pendente.
  LAB sem assinatura corporativa; não homologado para funcionários.
- Arquitetura/limites atuais: [documento14](14-aplicativo-unico.md).

---

# Evidências de laboratório — versão0.3.0

## Implementado

- Produto sem chamados na UI/API ativa; tabelas e migrações históricas preservadas.
- React e viewer MeshCentral incorporados no Técnico, sem HTML/JS/CSS remotos.
- Bootstrap JSON autenticado, proprietário/share/IP/modo/consentimento/prazo vinculados.
- Viewer interno, transporte WSS, indicação de desenho real e parada/limpeza local.
- Cliente dedicado, DPAPI, cadastro temporário, consentimento separado e downgrade
  CONTROL→VIEW, Job Object com encerramento do filho, presença/offline e Startup.
- Scripts de preparação/remoção executados somente pela TI, nunca automaticamente.

## Testado na VM Linux

- Java: 31 testes passaram (27 fluxos críticos +4 contratos). Incluem isolamento
  de permissões, recusa, expiração, revogação, estado real do motor, cliente offline,
  downgrade para VIEW, bootstrap sem consentimento/por outro usuário e rota antiga404.
  Dois testes Java WSS opcionais foram pulados no build sem variáveis específicas.
- Node: 13 testes passaram. Incluem lease, consentimento, filtro VIEW, parada local,
  desconexão, expiração, bootstrap e dois testes com sockets reais e agente simulado.
- .NET: 28 verificações do transporte/política passaram; inspeção do assembly
  confirmou recursos React e viewer HTML/JS/CSS incorporados (29ª verificação).
  O transporte .NET também passou 8 verificações adicionais contra a API real
  (36 com as verificações base), incluindo cookie, CSRF incorreto e logout.
- React: 10 verificações com ponte nativa simulada passaram, incluindo login/logout,
  ausência de chamados, indisponibilidade e erro TLS.
- Viewer: scripts upstream reais decodificaram JPEG e desenharam canvas; VIEW não
  emitiu mouse/teclado, CONTROL emitiu entrada; stop fechou socket e apagou pixels.
  WebSocket foi simulado nesse teste; não existe captura Windows nessa evidência.
- Publicações Técnico e Cliente compiladas para Windows x64, .NET autocontido.
- Servidor de laboratório atualizado após backup protegido de banco/JAR/configuração
  do motor. HTTPS/login/logout/lista de dispositivos verificados; WSS autenticado
  e bootstrap para share inexistente negado sem emissão de token. NGINX e portas
  compartilhadas não foram modificados. Banco preservado.

## Windows real

Versão0.2.0: operador confirmou hash, abertura da janela, login e logout.
Versão0.3.0: ainda não executada em Windows real. Não há segundo Windows disponível.
Nenhum agente foi instalado nesta entrega. Teste sem rede também permanece pendente.

## Pendências e bloqueios

- MeshAgent x64 com Authenticode Valid e configuração do grupo dedicado, conferidos
  pela TI. O aviso de assinatura anterior não foi corrigido nem contornado nesta
  etapa; por isso o binário não foi incluído e o script bloqueia assinatura inválida.
- Assinatura corporativa dos executáveis próprios e aprovação de distribuição.
- Prova obrigatória entre dois Windows: solicitar → consentir → imagem → mouse/
  teclado → encerrar no Cliente → comprovar parada de imagem e entrada.
- Confirmar comportamento real do Job Object, falha/fechamento do Cliente, perda
  de rede, expiração60s, revogação, inicialização no login, TLS e barra nativa.
- Associação do Node ID continua sendo responsabilidade explícita da TI; não
  há configuração pelo funcionário, mas não é provisionamento totalmente automático.
- UAC/secure desktop/login/serviço/múltiplos monitores não homologados.

**Conclusão de estado:** implementação e pacotes de laboratório disponíveis;
MVP de atendimento remoto NÃO concluído ou homologado. Nenhum teste simulado é
apresentado como sessão remota real entre computadores Windows.

## Hashes dos artefatos entregues

Registro externo aos ZIPs (o pacote não pode incluir seu próprio hash):

```text
f2556e261d6a8da0d83b37d3f57e01ef38d0134e0c202d8f884dd2a5cf25bb79  uai-suporte-tecnico-0.3.0-win-x64.zip
e33f3b2e2a7bfbcf99d4660f580d36d9ffa72d050d3e929b6b5ede7ed266036a  uai-suporte-cliente-0.3.0-win-x64.zip
```
# Instalador gráfico 0.3.1 — atualização de 28/10/2026

- Implementado assistente Windows x64 com perfis Prestar/Receber suporte,
  aplicativos incorporados e .NET autocontido; atalhos, preparação DPAPI,
  verificação TLS e Authenticode do MeshAgent, remoção com preservação de dados.
- Compilação Release win-x64 concluída sem avisos/erros. 15 testes de política
  passaram (MSH/origem/chaves duplicadas/opções adicionais/extração segura).
- Dentro da VM: API respondeu 401 sem login, Mesh respondeu 200, ambos via
  HTTPS com CA validada. Download HTTPS integral do instalador conferiu o hash.
- Inspeção dos dois payloads: 278 arquivos Cliente e 289 Técnico, sem MeshAgent,
  MSH, setup.bin, identity.bin ou chaves privadas. Nenhuma máquina foi instalada.
- **Pendente no Windows:** interface do assistente, Authenticode, DPAPI, atalhos,
  início no login, remoção e atendimento real entre duas máquinas. Pendência da
  assinatura do MeshAgent permanece; não foi contornada.
- Arquivo: `UaiSuporte-Setup-Lab-0.3.1-win-x64.exe` (~207 MiB).
- SHA-256: `fc605fbfc65f2eb82a3603473cb68cf01294b652cd4639b7f8cce814bd1d8746`.
- Guia: [instalador gráfico](12-instalador-grafico.md).

# Instalador offline LAB 0.3.2 — 28/10/2026

- Entrega única em `/home/agenda/uai-entregas/UaiSuporte-Setup-0.3.2-Lab.exe`;
  também preservada em `dist/`. 431535464 bytes (411,54 MiB).
- SHA-256: `efd6b4b6da9c5dec49d1ff08cb11c9399f99d81007c83b1f96c76303d91c2b97`.
- Release win-x64 compilado sem avisos/erros. Manifesto requireAdministrator
  confirmado no EXE final. 26 testes portáveis passaram; cópia de entrega teve
  hash conferido. Payload Técnico: 294 arquivos; Cliente: 278; sem credenciais,
  MSH ou MeshAgent. Cliente incorporado mas bloqueado/não extraído na instalação.
- Incluídos .NET, WebView2 oficial completo, CA pública pinada, interface local,
  licenças, configuração de laboratório e desinstalador. Perfil Técnico habilitado.
- Distribuição web anterior retirada, com backup em
  `.tools/lab/backups/retired-downloads-20261028T103137`. URL anterior retorna404.
  Backend, PostgreSQL, Mesh e proxy continuam ativos. Nenhum Windows instalado.
- Pendente: validar elevação, store de certificados, hosts, runtime offline,
  atalhos, desinstalação/reinício/reinstalação em Windows real. O verificador nativo
  não ignora falhas de confiança/revogação offline. MeshAgent/assinatura/vínculo e
  atendimento entre dois Windows seguem pendentes; perfil Receber suporte bloqueado.
- [Instruções, composição, fontes e limites](13-instalador-offline-032.md).


## 2026-10-29 — instalação relatada no Windows A e ajustes de interface

- Usuário relatou instalação 0.5.0 concluída, HTTPS/certificados confirmados,
  abertura pelo menu Iniciar e estado online no DESKTOP-0ON0ICK.
  Código público informado: `083cf71b-3d84-4232-9a9a-da0cdfc334d6`.
  Evidência relatada pelo usuário; não equivale a atendimento remoto validado.
- A pedido do usuário, priorizamos simplificação visual antes do Windows B.
  Assistente agora concentra código temporário e autorizações, com detalhes
  técnicos e licença em janelas próprias. Nome/hash da CA permanecem visíveis.
  Não alterados vínculo, credenciais, assinatura, TLS ou mecanismo de rollback.
- React: definidos estilos ausentes de cartão/barra de pesquisa, espaços internos,
  campos maiores, separação entre identificação e conexão e navegação legível
  em janela estreita. Texto local não restringe mais solicitações à TI.
- Verificado na VM: build React; 14 verificações da ponte simulada;
  2 testes de qualidade; teste de visualizador com transporte simulado;
  33 verificações de políticas do instalador; compilação App e Setup sem avisos
  ou erros. Revisão de imagens em 1440, 1024 e 390 px sem overflow da página,
  usando dados explicitamente simulados somente no teste temporário.
- Sem implantação nos serviços e sem novo instalador distribuído. A compilação
  do Setup usou o payload existente apenas para verificar C#, não para entrega.
  Interface incorporada instalada não muda até uma nova publicação do aplicativo.
- Pendentes: revisão do assistente em Windows (incluindo escala de tela),
  estratégia de atualização que preserve o vínculo existente e prova de
  consentimento, imagem, controle e encerramento entre Windows A e B.

## 2026-10-29 — assistente tradicional Windows

- Substituído o formulário longo por cinco etapas WinForms com painel Uai Suporte,
  rodapé fixo, barra de progresso e conclusão com opção de iniciar o aplicativo.
- Motor LAB preservado; acrescentados eventos de diagnóstico sem mensagens
  arbitrárias de exceções e abertura restrita ao usuário interativo não elevado.
- Falhas consultam journal; não prometem remoção integral com rollback pendente.
- 39 verificações de políticas/diagnóstico e 28 de transporte na VM;
  compilação do Setup sem execução WinForms real. Nenhum instalador final novo
  distribuído, nenhum servidor/Windows A modificado.
- Detalhes e roteiro de validação: [Assistente Windows](18-assistente-windows.md).

## 2026-10-29 — entrega do novo assistente LAB 0.5.1

Publicação completa `UaiSuporte-Setup-0.5.1-Lab.exe`, 481471457 bytes,
SHA-256 `f5306a5112ba55e781ac188f7e100d5af52a39f85f4f93cc04556f101f8a3b2c`.
Bundle final e seus recursos verificados; versão 0.5.0 preservada.
Testes repetidos sem falhas (2 opcionais backend pulados), sem Windows real.
[Detalhes e evidências](18-assistente-windows.md#publicação-lab-051--29102026).

## 2026-10-29 — Inno Setup LAB 0.5.2

A pedido do usuário, substituído o frontend de instalação por Inno Setup real,
com motor C# seguro preservado e modo `/VISUAL=1` sem cadastro/instalação.
49 verificações Setup e 28 Transport passaram; compilação C#/Inno sem erros.
Prévia observada apenas em Wine/VM, não Windows real. Cadastro automático sem
código continua pendente no modo de instalação real. Artefato e limites em
[Inno Setup](19-inno-setup.md).

## 2026-10-29 — remoção do código do instalador (LAB 0.5.3)

Inno/WinForms sem campo de código; cadastro implementado após login, sem senha ou
credencial compartilhada no instalador. Backend V6 implantado com backup validado,
Windows A preservado, HTTPS/login/logout/TLS verificados. 47 testes backend
passaram (2 opcionais pulados), 48 Setup, 28 Transport e testes React/qualidade/viewer
passaram. Fluxo normal Inno inspecionado em Wine até o resumo e cancelado: sem
página de autorização de uso único. Nenhuma instalação Windows efetuada.
[Artefato, hash e limitações](20-cadastro-apos-login.md).
