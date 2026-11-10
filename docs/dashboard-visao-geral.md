# Visão geral — implementação para revisão

Branch: `feat/dashboard-visao-geral`, criada a partir de `feat/uai-suporte-inicial` após confirmar ausência de alterações versionadas. A skill local e a configuração não versionada preexistentes foram preservadas. Sem push ou implantação.

## Escopo

Dashboard real em React, isolado em `DashboardOverview.tsx` e `dashboard.css`. Logo original; temas persistentes claro/escuro; identidade Equipe de TI; menu com Visão geral, Computadores e dois destinos explicitamente indisponíveis nesta etapa (Monitoramento e Histórico de acessos). Não existe navegação fictícia para funções não implementadas.

Busca somente na página Computadores existente. O dashboard não contém busca, Localizar computador ou botões Detalhes repetidos. Linhas abrem os detalhes existentes; o nome é um botão nativo acessível por teclado. Estado do resumo é somente Online/Offline. A página completa Computadores e seus filtros preexistentes não foram redesenhados nesta etapa.

Resumo, recursos, alertas e tabela têm carregamento, ausência de dados e erro com nova tentativa. Falha de atualização preserva o último snapshot com aviso de desatualização. A tabela do gráfico oferece alternativa textual às linhas; CPU e memória têm traços distintos, além de cores. No celular, o inventário vira resumo por equipamento e o gráfico permite rolagem para manter rótulos legíveis.

## Contratos e limites

- `/api/monitoring/summary`: total, alertas e grupos de disponibilidade. Online soma ONLINE + IN_SESSION + ERROR. Offline soma OFFLINE + DISABLED, coerente com `online` retornado pelo inventário. Não há mudança de estados no backend.
- O cartão “Sessões ativas” apresenta **computadores com sessão ACTIVE**, conforme IN_SESSION do contrato existente; não é contagem independente de sessões simultâneas nem prova adicional de primeiro frame. A legenda declara esse limite. Não usa pedidos pendentes nem infere sessões a partir das cinco linhas visíveis.
- `/api/inventory?page=0&size=5`: resumo sem filtro; `lowDisk`, `highCpu`, `highMemory` usam filtros reais e o total paginado do servidor, não a contagem local de linhas.
- `/api/monitoring/series`: período de 15min a 7 dias. Médias referem-se à última amostra retornada no período, cuja data aparece na tela; os totais de alertas são atuais. Métricas ausentes não viram zero.
- Nenhum segredo, endpoint, dado de exemplo ou valor fixo de frota foi adicionado ao código de produção. Dados de exemplo existem somente nos testes interceptados.
- Não alterados backend, banco, autenticação, visualizador, consentimento Windows ou motor. Identificação “Equipe de TI” é apresentação; não muda contas ou regras de autorização.

## Validação

- Build de produção com TypeScript e Vite: passou.
- Testes sem navegador (`quality.mjs` e `dashboard-data.mjs`): passaram. Verificam inclusive a sobreposição de sessão com Online e ausência de métricas distinta de zero.
- `npm run test:e2e`: iniciou e passou pelo teste de qualidade, mas parou na inicialização do Chromium antes dos testes de interface: `sandbox_host_linux.cc: Operation not permitted`.
- Teste dedicado `node tests/dashboard.mjs`: também bloqueado ao iniciar Chromium. As verificações foram escritas, mas **não executadas com sucesso**.
- Preview local na porta 4175: bloqueado por `listen EPERM`.
- Portanto, console, renderização, teclado real, temas renderizados, desktop, celular e capturas continuam **pendentes**. Não há novas capturas nem alegação de aprovação visual. Nenhuma imagem conceitual substitui essa validação.

Em terminal com permissão para navegador e porta local, dentro de `frontend/`:

```sh
npm run build
npm run test:e2e
npm run preview -- --port 4175
```

O preview usa o proxy existente para a API local configurada em Vite; necessita do backend local disponível para dados reais. Os testes interceptam as APIs e não dependem do laboratório. O teste dedicado (`npm run test:dashboard`) gera capturas reais do React compilado com dados simulados em `.tools/dashboard-review/`: desktop-light, desktop-dark, mobile-light, mobile-dark, empty, error e loading.

Aguardar revisão do dashboard renderizado antes de implementar outras telas. Não considerar esta etapa visualmente homologada enquanto o bloqueio de execução não for resolvido.
