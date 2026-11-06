**Candidato diagnóstico LAB 0.8.1:** a tentativa real mais recente falhou ao criar o auxiliar do consentimento nativo, sem primeiro frame. O candidato inicia o motor na sessão interativa verificada, mantendo o serviço na sessão 0, consentimento obrigatório, hash/assinatura e encerramento pelo Job Object. [Evidência, alteração e limites](docs/35-lab-081-contexto-motor.md). Os testes da VM não validam a execução no Windows. O servidor em execução ainda usa o relay legado com instrumentação v3; a máquina de estados e o contador novos do código-fonte não estão implantados. Não homologado.

**Corretivo LAB 0.7.1:** preparação local com propriedade administrativa e diagnóstico por etapa. [Pacote e limitações](docs/28-correcao-preparacao-071.md). Instalação Windows ainda pendente; 0.7.0 preservado.

**Candidato corporativo LAB 0.7.0 em validação:** serviço Windows separado da interface, credencial protegida do serviço, presença/métricas independentes da janela e canal local supervisionado. [Arquitetura, testes e limitações](docs/27-servico-corporativo.md). Os instaladores anteriores não contêm esta revisão. Não homologado em Windows real; não distribuir aos funcionários.

**Fluxo atualizado — LAB 0.6.2:** aplicativo Windows somente receptor, com bandeja e início ao entrar no Windows. Conexões iniciadas exclusivamente pelo painel web autorizado. [Comportamento, migração e limites](docs/26-aplicativo-receptor.md). Validação de bandeja/consentimento no Windows real pendente.

**Nova entrega LAB 0.6.1:** instalador único com componente remoto interno, ativação e coletor de monitoramento. Painel administrativo somente web. [Arquivo, hash, testes e limitações de atualização](docs/25-instalador-lab-061.md). Validação desta versão no Windows pendente; LAB 0.6.0 preservado.

**Monitoramento no laboratório:** inventário paginado, dashboard web com login, papéis ADMIN/OPERADOR/LEITURA e coletor Windows. [Arquitetura, API, retenção e limites](docs/24-inventario-monitoramento.md). Código novo não incluído no instalador 0.6.0 já entregue; validação real do coletor em Windows pendente.

**Entrega LAB 0.6.0:** aplicativo Windows com ativação única e autenticação de dispositivo; login web preservado. [Artefato, testes e pendências](docs/22-resultados-ativacao-060.md). Não homologado entre dois Windows.

> Implementação em andamento: LAB 0.6.0 substitui o login Windows por ativação administrativa de dispositivo. O login web é preservado. Consulte [ativação e limites de validação](docs/21-ativacao-dispositivo.md). Versões anteriores abaixo são histórico; não representam o fluxo atual. O acesso remoto entre dois Windows ainda não foi homologado.

# Uai Suporte

**Atualização LAB 0.5.3:** o instalador Inno Setup não pede código temporário.
O aplicativo cadastra o computador após login com uma conta ativa. O fluxo está
implementado e testado automaticamente; ativação real no Windows ainda precisa
ser validada. [Fluxo e limitações](docs/20-cadastro-apos-login.md).


Ferramenta de acesso remoto interno assistido: aplicativo Windows único e
controlador web previsto, com a mesma interface React. Para receber acesso, o
aplicativo/agente Windows instalado e em execução é obrigatório. Qualquer usuário
com conta ativa pode compartilhar **Seu código** e **Conectar a outro computador**.
Não existe aplicativo exclusivo da TI/NOC ou aplicativo Cliente separado, nem
módulo de chamados. O código identifica o computador, não concede acesso.

A pessoa acessada vê a identidade autenticada do solicitante e escolhe recusar,
permitir visualização ou permitir controle. Pode encerrar localmente a qualquer
momento. Sem acesso não assistido, comandos remotos, arquivos, clipboard ou gravação.
Administração de usuários e cadastros permanece restrita; conectar por código não
exige papel técnico nem grant prévio, mas sempre exige consentimento local.

**Estado: versão 0.5 de laboratório, não homologada.** Interface, backend e componentes
locais foram unificados. MeshAgent com assinatura LAB verificada na VM e assinatura/cadeia confirmadas pelo
operador no Explorer Windows; agente ainda não executado.
Cadastro integrado está implementado no instalador; instalação/reversão e atendimento
real entre dois Windows ainda precisam ser validados. Nenhum código de dispositivo fictício,
nenhum bypass de TLS/assinatura, nenhuma instalação automática em máquinas da empresa.

## Arquitetura e código

- `desktop/UaiSuporte.App`: único executável C#/.NET10/WinForms/WebView2.
- `desktop/UaiSuporte.Receiving`: módulo interno de consentimento e parada local;
  não é outro aplicativo.
- `desktop/UaiSuporte.Transport`: ponte nativa HTTPS, cookies/CSRF e origem restrita.
- `desktop/UaiSuporte.Setup`: instalador único offline, sem seleção de perfis.
- `frontend`: React/TypeScript incorporado localmente, incluindo viewer MeshCentral.
- `backend`: Java21/Spring Boot, autenticação, solicitações, auditoria e limites.
- `infra/mesh`: MeshCentral1.3.1 com patches de consentimento/lease e viewer.
- PostgreSQL, migrações V1/V2 preservadas; V3 adiciona sessões assistidas e limites;
  V4 permite recuperação sem duplicatas e V5 vincula identidade Mesh única.

O código atual é o UUID do cadastro real. A solicitação passa por POST /api/connections;
qualquer conta ativa pode usá-lo. O histórico é privado por solicitante. Limites:
5 tentativas/minuto/conta, 5/destino e 60/IP observado. Início de transporte exige
consentimento; expiração, revogação e perda de conexão encerram a autorização.

[Arquitetura atual, decisões, compatibilidade e limites](docs/14-aplicativo-unico.md).
[Resultados e evidências](docs/11-resultados-03.md).
[Investigação atual de assinatura e provisionamento](docs/15-meshagent-e-provisionamento.md).
[Instalador integrado 0.5, vínculo, reversão e roteiro de laboratório](docs/17-cadastro-integrado-lab.md).
[Controladores Windows/web, indicador azul e qualidade adaptável](docs/16-controladores-indicador-e-qualidade.md).
Documentos 01–13 descrevem etapas históricas; o documento16 complementa e atualiza o14.

## Build e laboratório

Testes: Maven em backend; npm run build e npm run test:e2e em frontend;
dotnet run --project desktop/Transport.Tests e desktop/Setup.Tests.
Instalador único Windows x64 autocontido: `bash scripts/build-setup.sh`.
Dependências de build oficiais locais descritas no documento14; o usuário final
não precisa de scripts nem baixar runtimes adicionais.

API HTTPS: suporte.internal; Mesh/WSS: mesh.internal, porta443. CA do laboratório
pinada; hosts opcionais configurados explicitamente pelo instalador, sem alterar
outras entradas. NGINX existente preservado; serviços internos/banco não expostos.
Origem externa autorizada do laboratório: 131.0.115.234/32. A versão definitiva deve
usar DNS administrado. Segredos em .tools/lab/secrets, fora do Git e instalador.
Não reprovisionar .tools/lab sobre os dados existentes.

O instalador novo não remove instalações LAB anteriores silenciosamente. Certificados
preexistentes nunca são apagados; remoção da CA própria exige confirmação de que
não há dependentes. Pacote LAB sem Authenticode próprio, ainda não distribuível aos
funcionários. Nenhum MeshAgent não aprovado acompanha a entrega.

### Componente remoto interno

A integração de apresentação para o próximo pacote está descrita em
[distribuição única](docs/23-componente-remoto-integrado.md). O LAB 0.6.0 já entregue
não foi substituído. O candidato [LAB 0.8.0](docs/31-lab-080-prova-remota.md)
implementa atualização sobre 0.6.0, com preservação de identidade e rollback.
A atualização real e a migração DPAPI ainda aguardam prova no Windows.
Os 60 segundos de uso começam somente na ativação visual, sem consumir o tempo
de consentimento. O pacote inclui diagnóstico por UUID da sessão Windows do
consentimento nativo, mantendo ambas as autorizações locais. Backend, relay e
controlador correspondentes foram preparados, sem implantação no laboratório
em execução. Não é uma versão definitiva nem acesso remoto homologado.
