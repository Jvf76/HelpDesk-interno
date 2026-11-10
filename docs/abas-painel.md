# Extensão visual do painel

Autorizada após avaliação da Visão geral. Branch `feat/dashboard-visao-geral`.

- Computadores e detalhes recebem navegação, tipografia, superfícies, tabela, formulários e gráficos coerentes com o dashboard.
- Monitoramento passa a usar o componente FleetOverview existente, com /monitoring/series, período, zoom e recuperação de erro.
- Histórico de acessos permite selecionar um computador em páginas de 25 cadastros. Usa /inventory/{id} para as últimas 100 sessões, alterações e eventos de cada categoria. Mostra autoria Equipe de TI. Não é consulta global nem auditoria integral do backend.
- Não foram criados endpoints, alterados banco, autenticação ou motor remoto. Estados da tabela de computadores são Online/Offline; a condição detalhada continua disponível nos filtros existentes.

Validação com API simulada: navegação entre abas, consulta vazia e preenchida do histórico, erro e recuperação, gráficos, temas, telas desktop/móvel, teclado e console. A validação automatizada não equivale à homologação de sessões reais Windows.

Build e suíte completa do frontend aprovados. Verificadas capturas claras/escuras, navegação por teclado existente e ausência de erros inesperados no console; novos testes cobrem histórico preenchido/vazio, falha e tentativa novamente. Galeria local em `/home/agenda/uai-suporte-design-20261110/abas/index.html`. Sem push ou implantação remota.
