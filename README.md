Aplicativo Técnico Windows com React incorporado: [prova desktop e instruções](docs/09-tecnico-desktop.md).

Publicação do laboratório no Nginx existente pela porta443:
[procedimento e estado da validação](docs/08-publicacao-443.md).

# Uai Suporte

Central interna da Uai Telecom: **Java 21 / Spring Boot, React / TypeScript, PostgreSQL e agente C# / .NET 10**. Integração experimental com MeshCentral/MeshAgent para acesso assistido. Interface pt-BR, sem dispositivos ou sessões fictícios. Aplicativo Técnico Windows com React incorporado: abertura, login e logout confirmados pelo operador; viewer e atendimento remoto ainda pendentes.

**Estado: implementação parcial, não homologada para produção.** Autenticação, autorização, dispositivos, chamados e ciclo de solicitações estão implementados. O agente compila, mas não foi executado em Windows. Integração com eventos do motor e lease implementada; acesso remoto entre duas máquinas e encerramento físico ainda precisam ser validados. O motor vem desativado. Leia também os alertas de dependências em [resultados](docs/04-resultados.md).

## Laboratório nesta VM

Ambiente nativo isolado em execução: painel https://suporte.internal e motor https://mesh.internal, ambos pela porta443. Portas internas18443/14433 restritas a loopback. Acesso externo depende da origem autorizada. Consulte [endereços reais, CA, contas, operação e teste Windows](docs/07-laboratorio-vm.md). Isso não homologa o atendimento remoto.

## Documentação

- [Referência, licença, decisões e arquitetura](docs/01-referencia-e-arquitetura.md)
- [Segurança e limites explícitos](docs/02-seguranca-e-limitacoes.md)
- [Prova reproduzível em dois Windows](docs/03-prova-windows.md)
- [Resultados executados e trabalho pendente](docs/04-resultados.md)
- [API e estados](docs/05-api.md)
- [Agentes, integração, node-forge e assinaturas](docs/06-integracao-e-seguranca-remota.md)

## Servidor com Docker Compose

Pré-requisitos: Docker com Compose v2, acesso à internet para as imagens/dependências, nome DNS ou hosts resolvendo o servidor. O Compose não foi executado neste ambiente (Docker ausente).

1. Copie `.env.example` para `.env`. Defina `POSTGRES_PASSWORD`, `BOOTSTRAP_LOGIN` e `BOOTSTRAP_PASSWORD` (14–72 bytes, exclusiva e aleatória). `openssl rand -base64 32` pode gerar cada segredo separadamente. Não reutilize senha do banco, administrador e motor.
2. Para teste local, mantenha `SITE_HOST=localhost`, `BIND_IP=127.0.0.1`, `MESH_ENABLED=false`.
3. Execute `docker compose up --build -d`. API e frontend são compilados; o build do backend roda os testes com H2. Flyway aplica as migrações PostgreSQL na inicialização.
4. Abra `https://localhost`. O Caddy usa uma CA interna. Exporte e instale conscientemente essa CA no dispositivo de teste; não ignore erros TLS:

```bash
docker compose cp web:/data/caddy/pki/authorities/local/root.crt ./uai-local-root.crt
```

No Windows de laboratório, valide a origem do arquivo e instale para o usuário:

```powershell
certutil -user -addstore Root .\uai-local-root.crt
```

Para LAN/VPN, defina um nome em `SITE_HOST` e o IP da interface interna em `BIND_IP`; configure DNS/hosts nas duas máquinas e confie na CA. A porta 443 é do painel/API; 4433 é do motor de laboratório. PostgreSQL só publica 5432 em loopback para desenvolvimento.

O primeiro administrador é criado apenas se o banco estiver vazio. Não existe senha fixa. Depois do primeiro bootstrap, retire a senha inicial do ambiente de execução. O usuário autenticado administra cadastros pela interface.

## Desenvolvimento sem Docker

Requisitos: JDK 21, Maven 3.9+, Node 24, PostgreSQL 16+ e, para compilar o agente, SDK .NET 10. As ferramentas baixadas durante esta execução ficaram em `.tools/`, ignoradas e não necessárias para outra instalação.

Crie um banco e um usuário com permissões apenas nele. Exporte as variáveis; não cole segredos em arquivos versionados:

```bash
export DATABASE_URL='jdbc:postgresql://127.0.0.1:5432/uai'
export POSTGRES_USER='uai'
# Defina POSTGRES_PASSWORD, BOOTSTRAP_LOGIN e BOOTSTRAP_PASSWORD no seu ambiente.
export SECURE_COOKIE=false  # exclusivamente HTTP em loopback
mvn -f backend/pom.xml spring-boot:run
```

Em outro terminal:

```bash
cd frontend
npm ci
npm run dev
```

Abra `http://127.0.0.1:5173`. O Vite encaminha `/api` à API em loopback. Não use `SECURE_COOKIE=false` na rede. O agente C# exige HTTPS e não conecta a esse desenvolvimento HTTP; para a prova Windows use a configuração TLS.

## Agente Windows

O componente C# é a UI de vínculo/consentimento. **Não substitui o MeshAgent**, que fornece captura e entrada. Instale o motor conforme o roteiro de prova, com consentimento obrigatório.

Em uma máquina com SDK .NET 10:

```powershell
dotnet publish .\agent\UaiSuporte.Agent -c Release -r win-x64 --self-contained true -o .\agent\publish
.\agent\install.ps1
```

Instalação por usuário, em `%LOCALAPPDATA%\UaiTelecom\Suporte\app`, com atalho visível no menu Iniciar. Não cria serviço, tarefa oculta ou regra de firewall. Não exige administrador e não altera ExecutionPolicy. Se a política corporativa exigir assinatura, assine o script/binário pelo processo da empresa.

No painel, cadastre um computador e copie seu código de vínculo (10 min, uso único). No agente, informe a origem HTTPS do painel e o código. O token será protegido com DPAPI CurrentUser. Abra o agente em cada sessão Windows em que for atender; não há inicialização automática.

Para desinstalar: encerre a transmissão no X da barra MeshAgent, revogue o dispositivo no painel, feche o aplicativo e execute `agent/uninstall.ps1`. O script remove a aplicação e a identidade local. **MeshAgent é separado:** use o instalador oficial e a ação de desinstalação; confirme a remoção do serviço no Windows. Não remover uma instalação corporativa já existente sem verificar sua finalidade.

## Testes

```bash
mvn -f backend/pom.xml test
npm --prefix infra/mesh ci
npm --prefix infra/mesh test
npm --prefix frontend ci
npm --prefix frontend run build
dotnet build agent/UaiSuporte.Agent -c Release
```

Por padrão os testes backend usam H2 em modo PostgreSQL. Para banco PostgreSQL real, **use banco descartável exclusivo**: os testes apagam dados das tabelas da aplicação a cada caso.

```bash
export UAI_TEST_DATABASE='jdbc:postgresql://127.0.0.1:5432/uai_test'
export UAI_TEST_DB_USER='usuario_de_teste'
# Defina UAI_TEST_DB_PASSWORD no ambiente.
mvn -f backend/pom.xml test
```

O [roteiro Windows](docs/03-prova-windows.md) é obrigatório antes de considerar o acesso remoto funcional. Testes com motor substituído não são prova de captura/controle reais.

## Operação e dados

- Backup PostgreSQL com `pg_dump` e restauração em banco separado. Testar restauração antes de depender do backup.
- Guardar o volume do MeshCentral (identidades e certificados), as CAs Caddy e o `.env` em armazenamento protegido. Perder chaves do motor pode exigir novo vínculo dos agentes.
- `docker compose down` preserva volumes. Não usar `down -v` em ambiente com dados que precisam ser mantidos.
- `audit_event` registra metadados; `ticket_event` preserva comentários e mudanças. Não há exclusão física de usuários/dispositivos pela interface.
- A revisão de retenção, backup automatizado, auditoria do motor, assinatura e monitoramento é trabalho de preparação para produção, ainda pendente.

### Teste de navegador reproduzível

Com a API/painel em execução e **banco descartável exclusivo**, defina `UAI_E2E_LOGIN` e `UAI_E2E_PASSWORD` de um administrador, `UAI_E2E_DISPOSABLE_DATABASE=true` e opcionalmente `UAI_E2E_BASE_URL` (padrão `http://127.0.0.1:5173`). O teste cria chamados e um solicitante identificados como teste; não executa sessões remotas.

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```
