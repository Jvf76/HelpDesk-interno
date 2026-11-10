# Uai Suporte

Acesso remoto interno, inventário e monitoramento de computadores da Uai Telecom. A equipe de TI utiliza o painel web; o computador atendido utiliza o aplicativo Windows integrado ao MeshAgent.

## Pré-requisitos

Para executar o servidor com containers:

- Docker Engine e Docker Compose v2.
- Portas locais 443 e 5432 disponíveis. Não use essa configuração sobre serviços existentes nessas portas.

Para desenvolvimento fora dos containers:

- Java 21 e Maven 3.9 ou superior.
- Node.js 24 e npm.
- PostgreSQL 17, que também pode ser executado pelo Compose.

Execute os comandos abaixo na raiz do repositório.

## Configuração

```bash
cp .env.example .env
chmod 600 .env
```

Edite `.env` e preencha:

| Variável | Uso |
| --- | --- |
| `POSTGRES_PASSWORD` | Senha exclusiva do banco. |
| `BOOTSTRAP_LOGIN` | Login do administrador inicial. |
| `BOOTSTRAP_PASSWORD` | Senha inicial forte, entre 14 e 72 bytes. |
| `SITE_HOST` | Nome do servidor; use `localhost` para desenvolvimento local. |
| `BIND_IP` | Interface publicada; mantenha `127.0.0.1` no desenvolvimento local. |

Não versione `.env`. Não existe senha administrativa padrão. Mantenha `MESH_ENABLED=false` para iniciar somente o painel e a API; a configuração do acesso remoto é descrita adiante.

## Executar painel, API e banco com Docker

```bash
docker compose up -d --build db backend web
docker compose ps
```

Acesse **https://localhost**. O Caddy gera uma CA interna: obtenha seu certificado público e confira sua identificação antes de adicioná-lo ao repositório de confiança da máquina de desenvolvimento:

```bash
docker compose cp web:/data/caddy/pki/authorities/local/root.crt ./uai-dev-ca.crt
openssl x509 -in uai-dev-ca.crt -noout -subject -fingerprint -sha256
```

Importe somente esse certificado público no repositório de autoridades confiáveis do sistema/navegador. Não ignore alertas TLS nem copie a chave privada da CA.

Entre com o administrador definido em `.env`. O backend aplica as migrations Flyway ao iniciar. O banco persiste no volume Docker e sua porta fica limitada ao loopback.

Para parar ou reiniciar:

```bash
docker compose stop
docker compose start
```

Para remover os containers preservando o banco:

```bash
docker compose down
```

## Desenvolvimento com recarga automática

Inicie apenas o banco:

```bash
docker compose up -d db
```

Em um terminal Bash, configure as mesmas credenciais utilizadas em `.env`, sem colocá-las no histórico:

```bash
export DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/uai
export POSTGRES_USER=uai
read -rsp 'Senha do banco: ' POSTGRES_PASSWORD; printf '\n'
export POSTGRES_PASSWORD
read -rp 'Login inicial: ' BOOTSTRAP_LOGIN
export BOOTSTRAP_LOGIN
read -rsp 'Senha inicial: ' BOOTSTRAP_PASSWORD; printf '\n'
export BOOTSTRAP_PASSWORD
BIND_ADDRESS=127.0.0.1 SECURE_COOKIE=false mvn -f backend/pom.xml spring-boot:run
```

Se alterou `POSTGRES_USER` em `.env`, use o mesmo valor acima. `SECURE_COOKIE=false` aplica-se somente a esse processo local HTTP. Na implantação HTTPS, mantenha cookies seguros.

Em outro terminal:

```bash
npm ci --prefix frontend
npm run dev --prefix frontend -- --host 127.0.0.1
```

Acesse o endereço local indicado pelo Vite (normalmente **http://127.0.0.1:5173**). O frontend encaminha `/api` para o backend em `127.0.0.1:8080`.

## Acesso remoto e aplicativo Windows

O Compose acima inicia painel, API e banco; não provisiona sozinho uma instalação completa do motor remoto. Para preparar MeshCentral, certificados, rede autorizada e o aplicativo Windows, siga os guias:

- [Preparação do servidor de laboratório](docs/07-laboratorio-vm.md).
- [Proxy HTTPS, nomes e rede autorizada](docs/08-publicacao-443.md).
- [Integração e provisionamento do MeshAgent](docs/15-meshagent-e-provisionamento.md).

O computador atendido deve receber o instalador integrado do Uai Suporte e ser ativado com token individual de uso único. Não execute o MeshAgent separadamente. O painel controlador exige login e o acesso exige consentimento local.

Em uma VM **já provisionada** pelos scripts do projeto:

```bash
python3 scripts/labctl.py status
python3 scripts/labctl.py start
# Para parar:
python3 scripts/labctl.py stop
```

## Build e testes

```bash
mvn -f backend/pom.xml test
npm ci --prefix frontend
npm run build --prefix frontend
# Instala o Chromium usado pelos testes de interface:
(cd frontend && npx playwright install chromium)
npm run test:e2e --prefix frontend
```

O build web é gerado em `frontend/dist/`. Testes de interface usam APIs e transporte simulados; a validação do atendimento remoto requer Windows real.

## Diretórios

- `frontend/`: painel React/TypeScript.
- `backend/`: API Spring Boot e migrations.
- `desktop/` e `agent/`: componentes Windows e instalador.
- `infra/`: infraestrutura e motor remoto.
- `scripts/`: execução, build e ferramentas de laboratório.
- `docs/`: guias técnicos e registros de validação.
