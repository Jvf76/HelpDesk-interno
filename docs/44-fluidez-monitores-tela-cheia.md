# Laboratório: fluidez, monitores e tela cheia — 09/11/2026

## Evidência real e correção do diagnóstico

Tentativa `9ce88615-9f7f-424a-a555-0e53a567f2de`: REQUEST_CREATED 14:44:52.219Z; LAUNCH_BEGIN 14:44:58.252Z; LAUNCH_OK 14:44:58.610Z; FRAME_DRAWN 14:45:00.684Z; VIEWER_DISCONNECTED 14:45:41.935Z. O usuário confirmou posteriormente que encerrou manualmente, porque não encontrou tela cheia e percebeu travamentos. Não classificar esse término como timeout ou queda espontânea. Houve imagem real, mas a estimativa de 20 FPS é percepção, não medição. Não comprova homologação do controle ou do encerramento local no alvo.

## Mudanças

- Perfil equilibrado: intervalo solicitado de captura de 100 para 50 ms.
- Perfil Fluidez: JPEG 45, escala 1024, intervalo 33 ms. Nitidez continua JPEG 75/100 ms; Economia JPEG 30/escala 640/200 ms.
- Automático avança para Fluidez após três amostras boas, respeitando intervalo de 20 segundos entre mudanças; duas amostras congestionadas reduzem para Economia. Perfil manual permanece fixo.
- Intervalo solicitado não equivale a FPS entregue: captura, compressão, transporte, decodificação e mudanças da tela influenciam o resultado. Tiles desenhados também não equivalem a frames completos. O aumento pode consumir mais CPU/rede; não foi medido no Windows.
- Seletor usa apenas identificadores informados pelo motor. Atualizar monitores solicita nova enumeração, com limite de frequência; exibe quantidade ou ausência de resposta. Não fabrica dois monitores quando o alvo só reporta um.
- Tela cheia solicita Fullscreen API a partir do clique, incluindo controles e botão de encerramento. Falha de permissão apresenta alternativa F11, sem encerrar a sessão.
- Índice web e dependências possuem versão de cache para evitar mistura de React novo com adaptador antigo. Não foi demonstrado que cache causasse desconexões anteriores.
- Diagnóstico inclui somente códigos fixos de consulta/enumeração/seleção de monitor, UUID e horário; nenhum conteúdo de tela ou segredo.

## Publicação e validação

Build React aprovado; 6 testes de política de qualidade e diagnóstico aprovados; testes Playwright do visualizador web aprovados (entrada/saída de tela cheia, JPEG decodificado, consulta e troca de monitor, comando de compressão, VIEW sem entrada, CONTROL com entrada e limpeza ao encerrar); 69 verificações da interface administrativa aprovadas. APIs e transporte foram simulados nesses testes.

Servidor de laboratório mantém o adaptador legado compatível com seu backend/relay: somente os hooks de qualidade, monitores e tela cheia foram publicados nele. Não houve migração do backend nem substituição pelo adaptador fonte que exige ACK de duração ativa. Backup local em `.tools/relay-20261109/www-before-quality-fullscreen`.

Não houve instalador, instalação Windows, alteração de credencial, consentimento nativo ou TLS. O código compartilhado desktop foi preparado, mas não distribuído. Fluxo de tela cheia dentro do navegador do usuário, seleção entre dois monitores físicos, desempenho, CPU/rede e controle/encerramento local continuam sujeitos à prova Windows.

Próxima ação no controlador: atualizar o painel com Ctrl+F5. Orientar a próxima sessão somente após retorno do usuário.
