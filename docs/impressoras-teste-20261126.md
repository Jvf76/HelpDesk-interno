# Uai Suporte — teste automático de impressora, 26/11/2026

## Escopo implementado

Modo opt-in `--printer-lab` no próprio executável do Uai Suporte e entrada “Impressoras • teste LAB” no menu da bandeja da nova compilação. O pacote portátil permite testar esse modo sem substituir o aplicativo instalado ou alterar serviço, cadastro, motor remoto, backend ou autenticação.

Este é um agendamento **único**, para **26/11/2026 às 14h, Brasília (17h UTC)**. Não é o agendamento mensal das lojas. O processo verifica o horário a cada 10 segundos. Para recuperar interrupção breve, aceita coleta atrasada até 14h30, registrando sempre o horário real. Após isso, expira e não é movido para outro dia. A ativação inicial precisa ocorrer antes das 14h.

## Executar no computador Windows que alcança a impressora

1. Extraia o ZIP `UaiSuporte-Impressoras-LAB-20261126.zip` em uma pasta do seu usuário. Não sobrescreva a instalação atual.
2. Execute `Abrir-Teste-Impressora.cmd`. Ele inicia `UaiSuporte.exe --printer-lab`.
3. Confira a data e hora do Windows. O horário solicitado é 14h de Brasília, independentemente do fuso configurado.
4. Clique em **Validar coleta e gerar PDF agora (sem e-mail)**. Abra a pasta dos resultados para conferir o PDF e os arquivos. Essa ação não ativa o agendamento.
5. Informe a senha SMTP localmente e clique em **Ativar teste de hoje às 14h**. A confirmação deve mostrar **Agendado**.
6. Deixe o Windows ligado, conectado à rede da impressora e com este processo aberto na bandeja. O X da janela apenas a oculta; “Sair” no menu interrompe o processo. Não há inicialização automática no login nem tarefa externa instalada. Se reiniciar, reabra o modo LAB para recuperar o agendamento salvo antes do fim da janela.
7. O PDF será enviado de `uaisuporte@uaitelecom.com.br` para `joaocaixeta@uaitelecom.com.br`. Confirme o recebimento e informe o resultado.

Pacote LAB compilado para Windows x64, com .NET incluído. A execução desse modo não depende do WebView2; o aplicativo completo segue exigindo sua instalação normal. O pacote portátil não foi assinado ou homologado em Windows real nesta VM; se a política da empresa bloquear, não contornar o bloqueio: usar a distribuição assinada pela TI.

## Dados e comportamento

- Impressora fixa neste teste: Lexmark MX511de, IP 192.168.30.200, série 701533HH09191. Não aplicar o adaptador às demais lojas ou marcas.
- GET de deviceinfo; validar modelo/série; GET de devicestatistics; validar novamente a identidade na seção Impressora (não confundir série de consumível).
- Interpretar a seção exata “Lados monocromáticos impressos”, campo “Total”; exigir valor inteiro não negativo e soma coerente dos itens de mídia. Campo ausente, repetido, identidade divergente, login, redirecionamento ou codificação desconhecida impedem o envio.
- Não converter esse campo em “Contags de imp. mono” sem homologação. O PDF distingue a fonte eletrônica candidata do relatório exigido pela empresa; a coincidência observada com a foto é evidência de teste, não equivalência geral garantida.
- HTMLs e leitura JSON preservados junto ao PDF de uma página em `%LOCALAPPDATA%\UaiTelecom\UaiSuporte\PrinterLab-20261126`. Horários reais vêm do Windows; relógio da impressora conhecido como incorreto. Não há consumo mensal calculado.
- Credencial SMTP é digitada localmente, protegida com DPAPI CurrentUser em `smtp.dpapi` e nunca embutida no ZIP, fonte ou log. Exceção de arquitetura limitada ao LAB local: a distribuição às lojas continuará exigindo servidor central e credenciais de envio fora dos PCs.
- SMTP 587 com STARTTLS obrigatório e certificado padrão validado, sem alteração de confiança. Apenas PDF anexado, sem HTMLs brutos ou credenciais.
- Lock exclusivo em arquivo evita duas execuções concorrentes. Estado persistido atomicamente antes do envio. Reinício durante SENDING vira DELIVERY_UNCONFIRMED e não tenta reenviar automaticamente. SENT indica aceitação SMTP, não confirmação de caixa de entrada.
- Falha de coleta tenta novamente após um minuto, no máximo três vezes, dentro da janela. Falha de envio exige revisão manual, pois a aceitação pode ser ambígua.
- Nenhuma impressão física é solicitada. Não altera configuração da impressora, consentimento ou motor remoto.

## Validação

Build do aplicativo e testes do núcleo executáveis no Linux. Testes incluem HTML real recebido do PC do responsável, campos de outras seções, identidade, duplicidade, valores fracionários, soma inconsistente, resposta de login, horário e recuperação do agendamento. PDF verificado como A4 de uma página, com texto extraível. Não foi possível executar a interface WinForms, DPAPI ou o agendamento no Windows do responsável a partir da VM. O usuário precisa abrir e ativar o pacote; preparar código não instala nem arma o teste remotamente.

## Resultado em Windows real — confirmado pelo responsável

O responsável confirmou no chat o recebimento automático do e-mail com PDF do teste de 26/11/2026 e transcreveu seu conteúdo:

- Modelo Lexmark MX511de; série 701533HH09191; IP 192.168.30.200.
- Coleta iniciada em 26/11/2026 às 14:00:09 −03:00, concluída às 14:00:12 −03:00, conforme horário Windows registrado no PDF.
- Campo eletrônico Lados monocromáticos impressos / Total: 237181.
- Contador geral separado: 237328.
- PDF manteve a identificação LAB, as fontes, o relógio interno incorreto e a ausência de consumo mensal.

Evidência: relato do usuário e transcrição do PDF recebido; não inspeção direta da caixa, do estado local ou dos logs Windows. Valida o caminho feliz do teste único neste PC: agendamento, coleta, geração do PDF e recebimento do e-mail. Não comprova cenários de reinício/falha, agendamento mensal, outras impressoras ou equivalência geral ao campo Contags de imp. mono. A integração à instalação principal ficou para a próxima etapa, conforme orientação do responsável. Este teste não se repetirá mensalmente.
