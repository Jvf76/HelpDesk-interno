# Uai Suporte

Plataforma interna On-Premises da Uai Telecom para acesso remoto autorizado, inventário, monitoramento e administração de computadores corporativos.

A equipe de TI inicia os acessos pelo painel web, mediante consentimento local explícito do colaborador. O computador acessado mantém uma indicação visível da sessão e permite encerrá-la imediatamente. O produto não possui módulo de chamados.

O projeto está em desenvolvimento. Requisitos de produto, implementação e homologação são registrados separadamente na documentação.

## Documentação

- [Escopo e regras do produto](PRODUCT.md)
- [Sistema visual](DESIGN.md)
- [Fluxo de trabalho](.impeccable/WORKFLOW.md)
- [Dashboard — Visão geral](docs/dashboard-visao-geral.md)
- [Abas do painel](docs/abas-painel.md)
- [Documentação técnica e histórico](docs/)

## Estrutura do projeto

- `frontend/`: painel web e interfaces React/TypeScript.
- `backend/`: serviços Java/Spring Boot.
- `desktop/`: aplicativo Windows e instalador.
- `infra/`: infraestrutura e integração do componente remoto.
- `scripts/`: ferramentas de desenvolvimento e build.

## Frontend

A partir da raiz do repositório:

```bash
npm ci --prefix frontend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
```

Os testes automatizados de interface utilizam dados simulados. Sua aprovação não substitui a validação do aplicativo e das sessões remotas em Windows real.
