# Sistema visual — Uai Suporte

## Visão geral: composição com presença visual

Modo Operate. Construção diretamente no código, uma tela por vez. O usuário autorizou substituir a composição anterior para uma interface com personalidade e potencial de apresentação no LinkedIn. Preservar identidade e logo oficial da Uai, sem marcas ou componentes copiados.

Primeira faixa: bloco de disponibilidade à esquerda, painel amplo de monitoramento em grafite à direita. O arco representa a proporção de computadores Online entre os estados Online e Offline recebidos, com percentual e contagens textuais. Sem dispositivos ou antes do carregamento, não indicar 0% ou 100% de disponibilidade. Sessões ativas permanecem Online e têm contagem separada.

Monitoramento protagonista: superfície #192630 nos dois temas, CPU em verde-água e memória em violeta, linhas contínua/tracejada e preenchimentos discretos de área. Somente amostras recebidas, sem interpolar lacunas de coleta. Tabela acessível de valores e período nativo. Os gráficos não são elementos decorativos.

Segunda faixa: atenção à esquerda e inventário à direita. Médias nunca substituem as contagens de computadores acima dos limites. Alertas e links usam contratos existentes, sem prometer destinos não implementados. As listas parciais informam sua cobertura.

Tema claro com superfícies brancas e painel de gráfico grafite; tema escuro com camadas grafite distintas. Vermelho institucional reservado à navegação selecionada. Números tabulares, foco visível, estados por texto e ícone. Em tablet, atenção/inventário ocupam a largura disponível; em celular os blocos se empilham e a tabela conserva leitura e interação por teclado.

Capturas para apresentação usam dados fictícios de teste e devem ser identificadas como demonstração. Não expor dados de colaboradores reais. Escopo: somente Visão geral; backend, autenticação e motor remoto preservados. Aprovação da implementação permanece pendente.

## Extensão às abas operacionais

Após avaliação do dashboard, o usuário autorizou aplicar sua linguagem visual às demais abas. Menu e cabeçalho agora compartilham os mesmos estilos entre Visão geral, Computadores, Monitoramento, Histórico e detalhes.

Computadores: superfície de inventário, pesquisa agrupada com filtros, linhas com identificação e disponibilidade por texto e ícone. Detalhes: dados detectados em grade, formulários administrativos e painéis de gráficos em grafite. Preservar ações e permissões existentes.

Monitoramento: componente existente FleetOverview exposto em sua aba, com período, ampliação por ponto, retorno de zoom e tentativa novamente em erro. Histórico: consulta paginada de computadores seguida dos registros já expostos por inventory/{id}; até 100 sessões, alterações administrativas e eventos por equipamento. Não é auditoria global, não traz todos os eventos do sistema e não inventa evidências de primeiro frame ou controle.

## Gráficos de monitoramento compreensíveis sem conhecimento técnico

Aplicação da skill local frontend-design. A direção preserva a identidade aprovada: grafite #192630, texto claro #f0f5f8, texto secundário #b4c4cf, verde-água #83e0cf, âmbar #f1c875 e violeta #d2b5ff. Tipografia operacional existente; títulos 22px, legendas 15px, explicações 13–14px. Alinhamento à esquerda. Organização: título e explicação, última coleta e duas leituras identificadas, evolução no tempo, orientação de interpretação.

A revisão do plano retirou quatro séries de significados diferentes do mesmo gráfico. Disponibilidade agora compara somente Online e Offline; comunicação prolongada e alertas de recursos aparecem em um resumo separado, com aviso de sobreposição. Processamento e memória têm definições práticas e porcentagens da capacidade; médias são identificadas explicitamente. Não inventar limites de normalidade ou afirmar que uma média representa todos os computadores. O desenho utiliza texto, ícones e traçados contínuo/tracejado, não apenas cores.

### Revisão: Online/Offline em números absolutos

A orientação mais recente substitui a evolução histórica de disponibilidade por um bloco de estado atual com duas contagens inteiras: Online e Offline. Não usar médias horárias nem arredondá-las para representar equipamentos. Manter timestamp, atualização manual, estado vazio/carregamento e erro com dados preservados. O gráfico temporal fica reservado ao processamento e à memória.
