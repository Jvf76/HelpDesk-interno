# QA — painel web Uai Suporte

final result: passed

## Referências e estado
- Layout: /tmp/codex-clipboard-5jdiZ2.png (1200 × 832).
- Marca fornecida: /tmp/codex-clipboard-Ap9WRX.png (1000 × 1000), copiada sem alteração para frontend/public/brand/uai-logo.png.
- Implementação: .tools/ui-redesign/desktop.png (1200 × 832, viewport CSS 1200 × 832, DPR 1).
- Responsivo: .tools/ui-redesign/mobile.png (390 px de largura, viewport 390 × 844, captura da página inteira, DPR 1).
- Estado: sessão ADMIN, API simulada exclusivamente no teste; nenhum dado fictício inserido no banco ou produto.
- O pedido é adaptar a organização visual da referência, sem gráficos de BI, com contadores e computadores; não reproduzir vendas, receitas ou atividades comerciais.

## Comparação visual
- Visão completa: menu lateral à esquerda, cabeçalho, cartões claros com bordas discretas e lista abaixo. Remoção intencional dos três gráficos da referência.
- Regiões: marca original Uai vermelha/amarela, cabeçalho com identidade do usuário, cartões de total/online/offline, tabela com busca/filtros/paginação.
- Tipografia: Segoe UI/Arial local, sem carregamento externo. Hierarquia de título, descrição e tabela; pesos moderados. Não há evidência do arquivo de fonte exato da referência, portanto não se afirma igualdade tipográfica.
- Espaçamento: menu 218 px, conteúdo com 32 px de margem interna, cartões com 18 px de intervalo e tabela com 13–16 px de padding.
- Cores: fundo claro, bordas cinza, ação principal vermelha Uai e estados semânticos verde/cinza. Mantida a cor original da imagem da marca.
- Recursos: logo real fornecida, sem redesenho. Ícones Lucide já disponíveis no projeto. Nenhuma imagem comercial da referência é necessária ao fluxo.
- Mobile: navegação e tabela têm rolagem interna; página não transborda horizontalmente. A captura com filtros abertos mostra os controles acessíveis.

## Histórico de correções
1. P2: regras globais antigas deixavam marca e nome do usuário com contraste insuficiente. Corrigidas com cores escopadas ao painel. Captura desktop final confirma.
2. P2: rótulo acessível posicionado fora da tabela provocava overflow no documento móvel. Corrigidos posicionamento e clipping; teste documentElement.scrollWidth <= innerWidth passou. Captura final tem exatamente 390 px.
3. P2: margens herdadas dos labels criavam espaço excessivo na busca. Neutralizadas dentro do painel.

## Verificação funcional
29 verificações Playwright com API simulada passaram: paginação no backend, ausência de carregamento global antigo, logo, ausência de gráficos/requisições de séries na visão geral, detalhes, edição com CSRF, restrições de leitura, filtros, viewport móvel e ausência de pageerror.
Também passaram os testes de login web, interface desktop simulada, qualidade e viewer com transporte simulado.
Nenhuma alteração de autorização/backend ou installer foi necessária.

## Limites
A comparação visual foi feita no Chromium automatizado na VM. Não houve validação visual manual no Windows do usuário. As métricas e o acesso remoto real continuam com suas pendências já documentadas.


## Iteração: ações, monitoramento geral e temas
A nova orientação do usuário substitui a ausência de gráficos: dois painéis compactos na Visão geral (disponibilidade e CPU/RAM médias), sem gráficos individuais. Ativação somente na aba Computadores. Essa aba mostra a lista sem os cartões/gráficos da Visão geral.
Capturas comparadas: .tools/ui-redesign/light.png, desktop.png (tema escuro), actions.png (menu da seta), mobile.png. Viewports 1200 × 832 e 390 × 844, DPR 1, capturas integrais. Referência original continua a ser a organização lateral e a marca fornecidas; o tema escuro segue a nova solicitação.
P2 detectado: regra global de section aplicava fundo branco sob o monitoramento no tema escuro. Corrigido com estilo escopado; capturas finais confirmam texto legível e superfície consistente.
50 verificações de UI passaram com fixtures explícitas: ativação ausente da Visão geral, lista sem gráficos na aba Computadores, tema persistente, menu acessível via dialog/Escape, copiar código, permissões de conexão, recuperação apenas para dispositivo revogado com confirmação e CSRF, filtros, responsividade e ausência de pageerror.
Gráficos usam os endpoints existentes de série geral em produção; fixtures ficam apenas no teste. Sem novos dados fabricados no banco.
final result: passed
