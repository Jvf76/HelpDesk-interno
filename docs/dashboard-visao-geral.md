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

## Validação concluída após liberação do ambiente

Em 10/11/2026, o navegador e o preview puderam ser executados. Os bloqueios anteriores de sandbox foram superados pela alteração de permissões autorizada pelo usuário; não houve mudança nas regras de autenticação nem no motor remoto.

- Build de produção com TypeScript e Vite: passou.
- Suíte completa `npm run test:e2e`: passou, incluindo 3 testes de qualidade, 34 verificações do receptor com ponte simulada, 14 de login web, visualizador desktop/web com transporte simulado, 65 de inventário/monitoramento, 3 testes de contagens e a suíte dedicada do dashboard.
- Dashboard renderizado no Chromium em 1440×1050 e 390×844, claro e escuro, sem overflow horizontal da página. O gráfico tem rolagem própria no móvel.
- Verificados: navegação por teclado até os detalhes, seleção de período, ausência de pesquisa no dashboard, menu sem Configurações/Auditoria, estado Online mesmo com sessão, carregamento, vazio, erro e recuperação.
- Nenhum erro JavaScript ou de console inesperado detectado pelo teste. As respostas 503 intencionais do cenário de erro são distinguidas das falhas inesperadas.
- Capturas reais do React compilado inspecionadas. Ajustado o menu lateral para que os rótulos “Em breve” não comprimam os ícones; build e suíte do dashboard repetidos após o ajuste e aprovados.
- Dados de inventário e API das capturas são simulados e isolados, não dados reais de colaboradores. Essas verificações não homologam Windows nem acesso remoto real.

## Preview para avaliação

Preview temporário em `http://127.0.0.1:4175/`, com proxy somente de `/api` para o backend local existente em `http://127.0.0.1:18080`. Nenhum serviço existente foi alterado. A configuração persistente Vite permanece intacta. Sem login, `/api/auth/me` retorna 401, como esperado. A tela de login real foi aberta no navegador sem erro JavaScript, sem usar ou registrar credenciais.

O preview não é implantação e está limitado à máquina local. Após autenticação pelo usuário, usa os dados reais que o backend existente disponibilizar. Não foi feita autenticação automatizada com conta real.

## Evidências

Capturas em `.tools/dashboard-review/`: `desktop-light.png`, `desktop-dark.png`, `mobile-light.png`, `mobile-dark.png`, `empty.png`, `error.png`, `loading.png` e `preview-login.png`. Cópia para avaliação em `/home/agenda/uai-suporte-design-20261110/implementado/`.

Para reproduzir os testes, dentro de `frontend/`:

```sh
npm run build
npm run test:e2e
```

O teste dedicado `npm run test:dashboard` regenera as capturas com API simulada. A aprovação de design continua sendo do usuário; não avançar para outras telas até recebê-la. Sem push ou implantação.
