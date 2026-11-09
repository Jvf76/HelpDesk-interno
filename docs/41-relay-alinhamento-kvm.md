# Correção candidata do observador KVM — 09/11/2026

Tentativa real: `f25aff99-4a3f-407a-9943-154cbdfc0b74`.
Criada às 13:45:33 UTC, consentimento nativo aceito às 13:45:45 UTC e
encerrada às 13:46:00 UTC. Auxiliar e motor na sessão Windows 1.
Relay: PROTOCOL_ERROR / KVM_LENGTH_BELOW_HEADER, consentimento e barra
confirmados, 1395 mensagens do agente e nenhum tile reconhecido pelo observador.
O resultado registrado pelo backend foi REQUESTER_STOP, após a desconexão.

## Evidência e correção limitada

O visualizador incorporado já descarta alinhamento após o tamanho declarado do
comando (agent-redir-ws-0.1.1.js). O observador do relay tratava o restante como
outro cabeçalho. Um pacote sintético de tamanho de tela com comprimento declarado
10 e seis bytes adicionais reproduz KVM_LENGTH_BELOW_HEADER no código anterior,
sem representar um frame. Um tile igualmente alinhado também falhava.

O observador agora descarta somente o sufixo exato de alinhamento para múltiplo
de oito, de um a sete bytes, no fim da mensagem recebida e após completar o
comprimento declarado. Não ignora cabeçalhos inválidos nem comprimentos acima
do limite. Fragmentos e comandos jumbo mantêm acompanhamento de comprimento;
apenas 12 bytes de cabeçalho são retidos. Nenhum conteúdo real de tela foi
capturado ou salvo.

A incompatibilidade foi comprovada em teste. A classificação do erro real é
compatível com ela, mas sem registrar os pacotes reais não é possível afirmar
que esse foi o único problema da tentativa. A próxima prova Windows deve
confirmar ou refutar a correção candidata.

## Validação e implantação

39 testes Node: 38 aprovados, 1 ignorado, zero falhas. Incluem centenas de
pontos de fragmentação em pacotes sintéticos, alinhamento de tamanho de tela,
tiles e jumbo, preservação de rejeição de tamanhos inválidos, consentimento,
restrições VIEW, encerramento e sockets de loopback. Regressão reproduzida
também carregando o código anterior do Git.

No servidor foi substituída somente a classe TileObserver do relay legado,
mantendo consent=72, leases, timeouts, autenticação, barra e fechamento.
Backup: .tools/relay-20261109/uai-session.pre-padding.cjs. Nenhuma sessão vigente
antes do reinício do MeshCentral. Não foi substituído backend ou frontend,
nem gerado instalador; LAB 0.8.2 permanece inalterado.

A duração ativa de 60 segundos e a máquina de estados novas do código-fonte
continuam pendentes de implantação coordenada. Esta correção não declara esses
comportamentos disponíveis no servidor legado, nem homologa controle/encerramento
entre Windows reais. Próxima ação: nova tentativa autorizada com consentimento.
