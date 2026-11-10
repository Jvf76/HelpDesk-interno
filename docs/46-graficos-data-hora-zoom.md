# Consulta temporal dos gráficos — 10/11/2026

Gráficos compartilhados da visão geral e de CPU/RAM/disco por computador mostram data completa, hora com segundos e valores ao mover o mouse pela área, ou focar pontos pelo teclado. O horário é local ao navegador. Linha guia acompanha a amostra mais próxima; não há interpolação de métricas.

Clique no ponto, Enter ou Espaço aproxima o período para um quarto do intervalo atual, centrado na data escolhida e limitado às extremidades, até um mínimo de um minuto. Gráficos do mesmo grupo compartilham o intervalo. Voltar período desempilha o último zoom; Restaurar período completo retorna ao seletor. Alterar o período também limpa o zoom.

As telas consultam novamente os endpoints existentes com from/to. O backend define a resolução e a retenção; zoom não recupera dados detalhados já eliminados. Estado vazio e erros continuam disponíveis. Intervalo ampliado permanece fixo durante a atualização de 30 segundos. Nenhuma migration ou endpoint novo.

Build aprovado; 79 verificações Playwright de interface com API simulada aprovadas, incluindo data/hora, consulta de intervalo menor, zoom pelo teclado e restauração, para administrador e leitura. Validação de entrega HTTPS dentro da VM: 200 com CA validada. Testes não representam carga nem validação Windows. Publicação somente de React/assets; visualizador remoto legado preservado. Backup do índice em .tools/chart-20261110/index-before-charts.html.
