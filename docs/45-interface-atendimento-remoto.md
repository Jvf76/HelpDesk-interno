# Interface de atendimento remoto — laboratório, 09/11/2026

Alteração restrita ao controlador remoto e ao cartão React que o contém. Não foram alterados dashboard, inventário, autenticação, transporte, consentimento, prazos, permissões ou serviço Windows.

A interface substitui o fundo azul por grafite neutro, organiza identificação/estado e ações de tela cheia/encerramento no cabeçalho, agrupa monitores/qualidade em barra própria e mantém RTT em rodapé. A área compartilhada ocupa o espaço restante com rolagem; em telas estreitas os grupos se reorganizam sem ultrapassar a largura. Os IDs e handlers existentes foram preservados. CSS React limitado à classe remote-session.

Validação: build React aprovado; teste Playwright do visualizador aprovado (JPEG, VIEW/CONTROL, tela cheia, monitores, qualidade, encerramento com WSS simulado); 69 verificações de interface com API simulada aprovadas após atualização do seletor de teste para o novo cartão. Capturas do estado aguardando sessão inspecionadas em 1280x800 e 390x844, sem overflow horizontal. Não constituem nova validação de acesso remoto Windows.

Publicado HTML/CSS do visualizador e assets React no laboratório. Adaptador JavaScript legado em execução preservado, sem copiar o adaptador fonte que depende de outro contrato de backend. Backup: .tools/relay-20261109/www-before-viewer-design. Nenhum instalador gerado e nenhum computador Windows alterado.
