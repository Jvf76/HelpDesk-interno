# Extensão visual do painel

Autorizada após avaliação da Visão geral. Branch `feat/dashboard-visao-geral`.

- Computadores e detalhes recebem navegação, tipografia, superfícies, tabela, formulários e gráficos coerentes com o dashboard.
- Monitoramento passa a usar o componente FleetOverview existente, com /monitoring/series, período, zoom e recuperação de erro.
- Histórico de acessos permite selecionar um computador em páginas de 25 cadastros. Usa /inventory/{id} para as últimas 100 sessões, alterações e eventos de cada categoria. Mostra autoria Equipe de TI. Não é consulta global nem auditoria integral do backend.
- Não foram criados endpoints, alterados banco, autenticação ou motor remoto. Estados da tabela de computadores são Online/Offline; a condição detalhada continua disponível nos filtros existentes.

Validação com API simulada: navegação entre abas, consulta vazia e preenchida do histórico, erro e recuperação, gráficos, temas, telas desktop/móvel, teclado e console. A validação automatizada não equivale à homologação de sessões reais Windows.

Build e suíte completa do frontend aprovados. Verificadas capturas claras/escuras, navegação por teclado existente e ausência de erros inesperados no console; novos testes cobrem histórico preenchido/vazio, falha e tentativa novamente. Galeria local em `/home/agenda/uai-suporte-design-20261110/abas/index.html`. Sem push ou implantação remota.

## Períodos independentes e estabilidade de rolagem

Cada gráfico de monitoramento e de recursos do equipamento tem seu próprio período, pilha de zoom, retorno, dados e recuperação de erro. Alterar CPU/memória não altera disponibilidade nem armazenamento. Durante consultas, o último gráfico e seu intervalo permanecem montados com aviso de atualização; controles e área de leitura reservam espaço para não reduzir a página e deslocar a rolagem.

Rótulos maiores, cinco referências no eixo vertical, datas abreviadas no eixo horizontal, legenda contínua/tracejada e valores detalhados em texto. Gráficos continuam acessíveis por teclado. Testes de regressão verificam isolamento das consultas e estabilidade de scroll em clique desktop e Enter no celular. Capturas de testes agora exigem `UAI_CAPTURE_UI=1`; desativadas por padrão conforme preferência do usuário.

Build e suíte completa aprovados após a correção. Novas verificações incluem alteração do seletor apenas de CPU/memória, ausência de nova consulta no gráfico vizinho, período independente do disco e estabilidade da posição vertical após zoom com mouse e teclado. Sem capturas geradas nesta validação.

## Clareza dos gráficos

Monitoramento apresenta “Computadores online e offline” e “Uso de processamento e memória”. Cada leitura identifica a última coleta do período, explica o significado da medida e informa a unidade do eixo. Alertas são separados da comparação de disponibilidade para não misturar estados e condições sobrepostas. CPU e RAM recebem nomes completos e explicações; valores sem coleta permanecem “Sem medição”. Períodos independentes, ampliação e estabilidade de rolagem preservados. Sem capturas automáticas.
