# Relatórios de impressoras — requisitos atualizados e teste local

O terminal de desenvolvimento está na VM, que não alcança a impressora. O teste deve ser executado no Windows do responsável, com acesso ao painel da Lexmark. Não exige instalação adicional nem acesso remoto.

## Relatórios aceitos por marca

Esta atualização substitui a coleta de Estatísticas do dispositivo. Não invalida nem converte os dados históricos já fornecidos.

| Marca/modelo | Documento solicitado | Campo exato e localização |
| --- | --- | --- |
| Lexmark MX511de | Relatório de ativo, uma página | Contags de imp. mono |
| RICOH SP 3710SF | Página de manutenção | Contador → Contador do total → Total de páginas, no topo |
| Ricoh 4510 — Varjão de Minas | Counter | Total; não usar Prints |
| Brother — Paracatu, modelo completo a confirmar (termina em L5652DN) | Configurações da Impressora | Status do Dispositivo → Contagem Total de páginas; página 3 de 5 na referência |

Identificar marca, modelo, IP e série antes da coleta do contador. Caso a série não esteja disponível, explicitar a ausência; não associar automaticamente a histórico anterior só pelo IP. Na Ricoh 3710, ignorar os totais das seções Impressora, Scanner e Copiador para essa finalidade.

### Referências fornecidas, não coletas atuais

| Equipamento | IP | Série | Valor de referência | Data interna exibida |
| --- | --- | --- | --- | --- |
| Lexmark MX511de (foto) | 192.168.100.210 | 701533HH0917C | Contags de imp. mono: 123.656 | 27/10/2026 08:25 |
| Lexmark MX511de (alvo do teste) | 192.168.30.200 | 701533HH09191 | **Pendente de validação no Relatório de ativo** | Relógio incorreto, indicando 2019 |
| RICOH SP 3710SF (foto) | 192.168.3.200 | Não fornecida | Contador do total / Total de páginas: 143.509 | 10/11/2026 14:03 |

As duas Lexmark são equipamentos diferentes. Não usar 123.656, os antigos contadores de 18/11/2026 ou o contador geral como valor do campo solicitado para 192.168.30.200 sem verificar a fonte correta. Datas internas das fotos não comprovam a data real de coleta.

Para a Ricoh 4510, a referência informa série **G156R730202**, “Total” **337.921**, data interna **29/10/2026 às 13:22**. “Prints” **187.286** é outro indicador e não deve ser utilizado como total.

Para a Brother de Paracatu, a referência informa “Contagem Total de páginas” **33.742**, sem data de leitura, IP ou série. O modelo termina em **L5652DN**, sem confirmação do nome completo. Não somar frente/verso nem substituir por cópias, impressões de PC, bandejas ou vida útil de componentes. Esses números são apenas referências transcritas, não novas leituras nem base de consumo mensal com data confirmada.

### Equipamentos adicionais informados

| Loja | Equipamento informado | Modelo completo | IP | Série | Relatório/campo exigido |
| --- | --- | --- | --- | --- | --- |
| Varjão de Minas | Ricoh 4510 | A confirmar | Não informado | G156R730202 (referência) | Counter → Total |
| Paracatu | Brother | Termina em L5652DN; confirmar nome completo | Não informado | Não informada | Configurações da Impressora → Status do Dispositivo → Contagem Total de páginas |

Há valores de referência para esses dois equipamentos, mas nenhuma coleta atual validada. Eles não devem ser fundidos com os exemplos anteriores. O cadastro deverá relacionar loja, impressora e coletor designado, permitindo o mesmo IP em redes de lojas distintas. Marca/modelo e identidade precisam ser validados antes da coleta; relatório ou campo desconhecido permanece pendente, sem PDF automático apresentado como leitura confirmada. O script atual continua sendo apenas diagnóstico Lexmark: não representa suporte implementado para Ricoh ou Brother.

### Endereços informados em 26/11/2026

| Loja (nome informado) | IP da impressora | Identificação |
| --- | --- | --- |
| Guima | 192.168.3.6 | Marca, modelo e série a confirmar |
| Carmo | 192.168.0.200 | Marca, modelo e série a confirmar |
| Cruzeiro | 192.168.0.119 | Marca, modelo e série a confirmar |
| PTU | A confirmar | Associação ao equipamento e identificação a confirmar |

Endereços fornecidos pelo responsável, ainda sem verificação de conectividade ou coleta. Não associar esses IPs aos modelos ou números de série das fotos por suposição. O endereço de referência 192.168.3.200 permanece histórico, sem substituição automática por 192.168.3.6. A sigla PTU foi preservada como informada; não confirma por si só a associação à Brother de Paracatu.

### Entrega e histórico mensal

Uma página por equipamento, preferencialmente selecionando do documento nativo a página que contém o contador solicitado. Na Brother, a página 3 de 5 é a posição na referência, não uma regra fixa: conferir seção e campo no documento real. Incluir marca/modelo, série quando disponível, nome exato do campo, valor acumulado e data/hora real da coleta. Decisão posterior ao teste das 14h: omitir o IP do relatório entregue; mantê-lo internamente para coleta e identificação. Separar a data interna, destacando a divergência conhecida da Lexmark do teste. Não afirmar que um PDF reconstruído é uma exportação nativa.

Guardar as leituras acumuladas por mês, cada uma com sua fonte e data real. Calcular consumo mensal somente com leituras inicial e final do período, do mesmo equipamento e mesmo indicador; sem isso, apresentar apenas acumulado. Leituras atrasadas mantêm sua data efetiva. Nenhuma alteração de configurações ou zeramento de contadores.

## Executar diagnóstico preliminar Lexmark

1. Confirme que a data, hora e fuso do Windows estão corretos.
2. Copie `scripts/Test-LexmarkReports.ps1` para o Windows.
3. No PowerShell, na pasta do arquivo, execute:

```powershell
powershell.exe -NoProfile -File .\Test-LexmarkReports.ps1
```

Se a política corporativa impedir a execução, registre o erro para ajustar a distribuição ou assinatura com a TI; este teste não modifica políticas.

O resultado fica em `Uai-Relatorios-Impressora`, na Área de Trabalho do usuário, em subpasta exclusiva e ZIP. Contém a página inicial do painel e a página conhecida de identificação (`deviceinfo`), metadados e hashes SHA-256. É um diagnóstico para validar a identidade e localizar o Relatório de ativo, não um pacote com o contador solicitado. Não envie esses arquivos para o Git. Forneça o ZIP para validar a estrutura real dos relatórios.

O script faz somente GET na página inicial e no caminho conhecido de identificação. Não busca mais `devicestatistics` e não presume um endereço para o Relatório de ativo. Não segue redirecionamentos, não envia credenciais, não executa o HTML e limita tempo e tamanho das respostas. HTTP 200 não comprova autenticidade do relatório: páginas de login e identidade precisam ser verificadas na etapa de interpretação. Downloads parciais não geram pacote de sucesso.

## Próximas etapas após obter os arquivos

- Localizar o Relatório de ativo no painel real, verificar sua URL e confirmar o campo solicitado para a série 701533HH09191. Não executar ações de impressão ou alteração para descobrir caminhos. Obter separadamente a Página de manutenção da Ricoh 3710, Counter da Ricoh 4510 e Configurações da Impressora da Brother antes de implementar cada adaptador.
- Construir interpretadores específicos por marca contra o HTML real, com testes de campos ausentes, números localizados, identificação divergente e resposta de login.
- Conferir os valores extraídos contra o relatório nativo e gerar uma página por equipamento com o relatório/campo específico aprovado. Não usar relógio da impressora como data da coleta.
- Integrar ao serviço Windows existente uma coleta independente do motor remoto, com falhas isoladas para não interromper suporte.
- Centralizar no servidor o armazenamento das leituras, o PDF e o e-mail; manter credenciais de envio fora dos computadores das lojas.
- Testar agendamento em horário próximo antes do calendário mensal. Definir horário e fuso, comportamento quando o PC está desligado e identificação de coleta atrasada. Nunca atribuir data passada a uma coleta tardia.
- Persistir execução e estado de entrega para evitar duplicações nas tentativas; distinguir relatório gerado, envio aceito pelo servidor de e-mail e entrega não confirmada. Timeout de envio pode ter resultado incerto e exige tratamento explícito.
- Validar com destinatário de teste informado pelo responsável antes do uso nas lojas.

## Limites desta entrega

Script de diagnóstico ajustado e revisado na VM; não há interpretador Lexmark, Ricoh ou Brother validado. Capturar uma página de identificação não equivale a validar sua identidade, nem a coletar o contador solicitado. PowerShell não está disponível neste ambiente; execução Windows e coleta real estão pendentes. Nenhum serviço foi instalado ou atualizado; nenhum agendamento ou e-mail foi ativado. Não foi feito push.

## Evidência local recebida em 26/11/2026

Pacote `Uai-Impressora-20261126-110405.zip`, SHA-256 `6924dec3c33eea9d67fc8e6b0b65e67d85f33f124655f936240a18ebc6aaba1f`, recebido do computador Windows do responsável. Inspeção estática dos arquivos, sem executar HTML.

- Metadados do coletor: IP 192.168.30.200; início 26/11/2026 11:04:05.526 −03:00; fim 11:04:06.586 −03:00. Horário informado pelo Windows, sem verificação independente de sincronização.
- `identificacao.html`, charset ISO-8859-1: modelo Lexmark MX511de; campo Número de série = 701533HH09191. Identidade no conteúdo recebido corresponde ao equipamento esperado.
- Campo `Contagem pág.` = 237327, apenas contador geral observado. **Não validado como “Contags de imp. mono” e não deve ser utilizado como tal.**
- `painel.html` contém frames; não contém o menu completo nem o Relatório de ativo. O frame de navegação aponta explicitamente para `/cgi-bin/dynamic/left_bar.html`. Próximo passo: obter esse HTML para localizar o link de relatórios, sem adivinhar endpoints ou executar comandos de impressão.
- O pacote não inclui Relatório de ativo nem seu contador solicitado. Não gerar relatório mensal confirmado a partir dele.

Menu `lexmark-menu.html` recebido em 26/11/2026: o link nativo com texto “Relatórios” aponta para `/cgi-bin/dynamic/reports_and_information.html`. O menu ainda não contém o link direto do Relatório de ativo. Próxima captura somente dessa página de navegação; não acessar ações de configuração, digitalização, impressão ou painel remoto presentes no mesmo menu.

Página `lexmark-relatorios.html` recebida em 26/11/2026: lista Estatísticas, Configurações e Informações do dispositivo, atalhos, logs e configuração do servidor de impressão, mas **não contém link para Relatório de ativo**. Não concluir impossibilidade de coleta eletrônica apenas por essa ausência. O manual oficial MX410/MX510 descreve Asset Report como relatório imprimível (https://publications.lexmark.com/publications/pdfs/2007/mx511de_mx511dhe/UG/EPS/MX511de_MX511dhe_UG_en.pdf); isso não comprova endpoint de download. Próximo diagnóstico: ler somente as páginas de navegação Configurações (`/cgi-bin/dynamic/config/config.html`) e Vínculos e índice (`/cgi-bin/dynamic/linksindex.html`), ambos caminhos presentes no menu recebido. Não submeter o formulário POST nem acionar impressão física.

Pasta `Lexmark-Navegacao-20261126-110908` recebida em 26/11/2026: inspeção de `configuracoes.html` e `indice.html` (incluindo as opções ocultas usadas para construir o índice) não encontrou Relatório de ativo, Asset Report ou o campo solicitado. Não há caminho de download validado entre os links recebidos. Não confundir isso com prova de inexistência de outra interface eletrônica. Encerrar a exploração indiscriminada de páginas de configuração: obter uma referência do Relatório de ativo do próprio equipamento 701533HH09191 para validar o campo; a foto da série 701533HH0917C não substitui essa prova. Uma eventual fonte eletrônica alternativa exigirá validação explícita do mesmo indicador, não apenas coincidência numérica com Contagem pág. Nenhuma alteração ou impressão foi acionada pela análise.

## Relatório de ativo fotografado — recebido em 26/11/2026

O responsável confirmou ter tirado a cópia e enviou a foto do próprio equipamento. Leitura visual do documento:

- Modelo: Lexmark MX511de.
- Série: 701533HH09191.
- Endereço IP: 192.168.30.200 (não confundir com o campo Nome DNS).
- Campo exato: **Contags de imp. mono = 237181**.
- Uso total de digit.: 71112, indicador distinto e fora do contador solicitado.
- Hora interna impressa: 11-05-2019 07:25, não confiável. Referência recebida em 26/11/2026; horário real de emissão não confirmado. Horário no nome do arquivo não é prova do horário da coleta.

Esta foto valida a identificação e a localização/valor visual do campo solicitado, não um método de coleta automática. O contador geral recebido às 11:04 do Windows foi 237327; a diferença aritmética de 146 não autoriza uma regra de subtração fixa nem comprova equivalência entre indicadores. Não calcular consumo mensal contra valores anteriores de outros campos. Próxima investigação: confrontar uma captura contemporânea de Estatísticas do dispositivo com o relatório nativo apenas para avaliar uma fonte eletrônica equivalente; não alterar o formato final exigido pela empresa nem declarar equivalência apenas por coincidência numérica.

## Comparação com Estatísticas do dispositivo — arquivo recebido às 11:39 em 26/11/2026

Arquivo `lexmark-estatisticas-validacao.html`, ISO-8859-1, analisado estaticamente. Identidade na seção Impressora: Lexmark MX511de, série 701533HH09191. O número CAS1714610EA pertence à unidade de imagem e não identifica a impressora. O nome da pasta de recebimento não é horário de coleta confirmado; este HTML não veio acompanhado do horário emitido pelo script.

| Caminho no relatório | Valor observado | Interpretação na investigação |
| --- | --- | --- |
| Cont. Lad. Impres. Mídia / Imprimir / Monocromática | 204913 | Indicador específico de impressão |
| Cont. Lad. Impres. Mídia / Cópia / Monocromática | 32269 | Indicador específico de cópia |
| Cont. Lad. Impres. Mídia / Total / Monocromática | 237182 | Total agregado, diferente da foto em uma página |
| Lados monocromáticos impressos / Total | 237181 | Coincide com Contags de imp. mono da foto; fonte candidata, equivalência semântica ainda não comprovada |
| Lados selecionados | 237328 | Indicador distinto, não usar como contador solicitado |
| Folhas impressas / Total | 177593 | Folhas, não páginas |
| Folhas de mídia impressas / Total | 177592 | Outro total, uma folha abaixo do agregado |

O total de uso de digitalização permanece 71112. A emissão do relatório físico pode explicar o incremento de uma página nos agregados, mas isso é hipótese; não foi observada de forma controlada. Não subtrair 1 ou 146 como regra e não rotular o agregado 237182 como Contags de imp. mono sem validação. O valor 237181 aparece em um campo nomeado e pertinente, mas coincidência numérica isolada não autoriza homologar a coleta automática. Próxima validação: repetição controlada das leituras eletrônicas, sem novas impressões entre elas, e verificação do significado do campo antes de decidir o adaptador e habilitar envio automático. Preservar separadamente a foto nativa e os campos eletrônicos, com suas origens.

## E-mail de teste — 26/11/2026

Endereço informado pelo responsável: `joaocaixeta@uaitelecom.com.br`, considerado destinatário dos testes. Conta remetente e provedor/servidor de envio ainda precisam ser confirmados; não presumir que o destinatário também seja o remetente. Nenhuma credencial foi solicitada no chat, nenhuma configuração de envio foi ativada e nenhum e-mail foi enviado. A rotina prevista é inteiramente digital, sem imprimir páginas físicas: coleta eletrônica validada, geração de PDF, armazenamento da leitura e envio agendado.

## Repetição da coleta — 26/11/2026 às 11:45

Pacote `Lexmark-Teste-20261126-114529.zip`: coleta iniciada às 11:45:29.5588017 −03:00 e concluída às 11:45:33.1042139 −03:00, conforme relógio Windows registrado em `coleta.json`. IP informado 192.168.30.200. Identidade coerente em deviceinfo e na seção Impressora de devicestatistics: Lexmark MX511de, série 701533HH09191.

- Lados monocromáticos impressos / Total: **237181**, estável em relação ao HTML anterior e coincidente com o valor fotografado em Contags de imp. mono.
- Total agregado monocromático: **237182**, também estável. A diferença de uma página entre esses dois campos persiste na segunda captura; não era apenas uma divergência eliminada ao repetir a leitura.
- Contagem pág. em deviceinfo: **237328**, separado dos demais indicadores.
- Uso de digitalização / Lados digit. / Total: **71112**.

Resultado: coleta HTTP real das duas páginas pelo PC Windows comprovada; identidade e repetibilidade dos valores verificadas nos arquivos recebidos. Não foi baixado o Relatório de ativo nativo, nem validado que ele possa ser exportado eletronicamente. Coincidência e estabilidade dão evidência local para a fonte candidata, mas não comprovam equivalência geral entre campos para outros estados/firmwares. Ainda sem integração ao aplicativo, PDF automatizado, agendamento ou envio de e-mail. Manter a investigação da equivalência separada do sucesso do download; nenhum ajuste numérico artificial.

### Atualização do destinatário de teste

O responsável definiu `hiago@uaitelecom.com.br` como destinatário do teste, substituindo o destinatário inicialmente considerado. Webmail informado: https://mx1.uaitelecom.com.br/ (interface pública identifica mailcow/SOGo). `joaocaixeta@uaitelecom.com.br` permanece candidato a remetente, a confirmar. Credenciais devem ser informadas localmente, nunca no chat ou repositório. Não houve autenticação nem envio durante a identificação do serviço.

### Teste SMTP com conta dedicada

Conta remetente definida pelo responsável: `uaisuporte@uaitelecom.com.br`. Conexão STARTTLS em mx1.uaitelecom.com.br:587 e autenticação concluídas. Servidor aceitou MAIL FROM (250), mas recusou RCPT TO para `hiago@uaitelecom.com.br` com 550 5.1.1, “User unknown in virtual mailbox table”. Mensagem não aceita para envio. Diagnóstico seguinte utilizou apenas MAIL/RCPT/RSET, sem transmissão do corpo. Confirmar destinatário existente ou alias antes de novo envio. Nenhuma senha foi persistida nos arquivos do projeto.

Destinatário corrigido pelo responsável para `joaocaixeta@uaitelecom.com.br`. Enviada uma mensagem de teste, sem anexo, assunto `[TESTE] Uai Suporte - envio de e-mail`, de `uaisuporte@uaitelecom.com.br`. Servidor SMTP aceitou a mensagem; Message-ID `<179570545573.826875.1615760990618038084@uaitelecom.com.br>`. Recebimento na caixa ainda depende de confirmação do destinatário; aceitação SMTP não comprova entrega na caixa de entrada. PDF automático e agendamento não foram testados nesta operação. Senha não persistida no projeto.

A pedido do responsável, enviado teste com PDF de uma página anexado para `joaocaixeta@uaitelecom.com.br`, remetente `uaisuporte@uaitelecom.com.br`. Assunto: `[TESTE] Relatório da impressora Lexmark MX511de - 26/11/2026`. Anexo: `Uai-Suporte-Lexmark-701533HH09191-2026-11-26.pdf`. SMTP aceitou a mensagem com Message-ID `<179570571676.828782.16164683568596754457@uaitelecom.com.br>`; entrega na caixa ainda não confirmada. PDF distingue transcrição da foto (237181), campo eletrônico correspondente numericamente, horário Windows, relógio interno incorreto e ausência de homologação da equivalência. Não representa exportação nativa nem execução mensal automática. PDF armazenado fora do repositório em `/home/agenda/relatorios-impressoras/`.

## Implementação LAB — teste único das 14h

Implementado o núcleo `desktop/UaiSuporte.Printers`, integrado ao executável do aplicativo pelo modo `--printer-lab` e menu de bandeja da nova compilação. PDF, coleta com identidade conferida, SMTP e estado persistido locais; credencial protegida por DPAPI do usuário e fornecida na tela, não no pacote. Agendamento único 26/11/2026 às 14h Brasília, com janela até 14h30, depende de ativação no PC. Não está instalado ou ativado remotamente. Ver `docs/impressoras-teste-20261126.md`.

Validação: build/publish Windows x64 concluídos; 20 verificações do núcleo de impressoras (incluindo os HTMLs reais), 210 verificações existentes de política do serviço e 67 de agendamento de monitoramento passaram. PDF gerado pelo núcleo verificado como uma página A4 e texto extraível. WinForms, DPAPI, SMTP pelo novo executável e execução no horário exigem teste no Windows real. Não houve envio adicional de e-mail durante esses testes de código.

### Confirmação do envio automático das 14h

Responsável confirmou recebimento automático do PDF: coleta em 26/11/2026 das 14:00:09 às 14:00:12 −03:00, série 701533HH09191, campo eletrônico 237181 e contador geral 237328. Caminho feliz validado por relato em Windows real para este teste único; ver `docs/impressoras-teste-20261126.md`. Não considerar homologados outros modelos, execução mensal ou equivalência semântica entre os indicadores.
