# Fluxo de trabalho do Uai Suporte

## Preferência atual — substitui o fluxo anterior de imagens

- Construir o design diretamente no código e avaliá-lo em funcionamento.
- Implementar incrementalmente, uma tela por vez, aguardando aprovação antes de avançar para outra tela.
- Não utilizar geração de imagem como substituto da implementação visual. As referências estáticas anteriores são histórico de exploração, não contratos de implementação.
- Usar a identidade e a logo oficial da Uai em `frontend/public/brand/uai-logo.png`. Não usar marcas ou componentes copiados de outros produtos.
- Validar a interface real em tema claro/escuro, desktop e resolução menor; verificar teclado, foco, contraste, estados vazios, carregamento, erros e recuperação; gerar capturas reais quando o ambiente permitir e informar limites de validação.

## Etapa autorizada

Implementar somente o dashboard “Visão geral”. Preservar as demais telas e contratos existentes. Não alterar monitoramento completo, histórico de acessos, visualizador remoto, consentimento Windows, backend, banco, motor remoto ou regras de autenticação.

Menu inicial: Visão geral, Computadores, Monitoramento e Histórico de acessos. Não apresentar como funcionais destinos ainda não implementados. Auditoria não terá item separado; sua visualização futura pertencerá ao histórico. Não criar Configurações sem funções reais aprovadas.

Dashboard sem pesquisa e sem “Localizar computador”; pesquisa por nome/código fica em Computadores. Identificação “Equipe de TI”. Contabilizar sessões separadamente da disponibilidade; tabelas do dashboard usam Online/Offline com texto e ícone e acesso aos detalhes pela linha, com alternativa de teclado. Preservar temas, recursos, alertas de armazenamento e estados reais de dados.

## Segurança do trabalho

Verificar Git antes de editar, preservar alterações anteriores, trabalhar em branch isolada quando possível. Não apagar nem reverter trabalho existente. Reutilizar componentes e contratos, sem endpoints fictícios. Não fazer push sem autorização. Não implantar em produção implicitamente.

Não repetir downloads do motor Impeccable nem contornar sua indisponibilidade. Aplicar instruções locais e registrar limitações específicas. A indisponibilidade do Live não impede implementação convencional e validação por navegador permitido.

## Histórico de decisão

A preferência inicial por imagens, as duas propostas estáticas e a aprovação de direção com ajustes foram substituídas pela solicitação de avaliar o dashboard implementado. A aprovação das imagens não representa aprovação do código nem autoriza avançar para outras telas.
