# Uai Suporte

<!-- impeccable:product-schema 1 -->

Escopo e regras confirmados pelo responsável pelo produto em 10/11/2026.
Este documento define o comportamento desejado. Não atesta implementação, implantação ou homologação. Em divergências com documentos históricos, estas decisões orientam o trabalho futuro; mudanças no software exigem implementação e validação próprias.

## Platform

web

O painel é web; o receptor instalado no Windows utiliza interface React incorporada em WebView2 e componentes nativos de consentimento e indicação de sessão. Isso não implica uma linguagem visual adaptativa iOS/Android.

## Users

- Equipe de TI autorizada da Uai Telecom: administra computadores corporativos, acompanha inventário e métricas e inicia suporte remoto exclusivamente pelo painel web.
- Colaboradores: ativam o próprio computador na primeira instalação, recebem solicitações, concedem consentimento por aceite explícito e podem encerrar imediatamente o acesso.

## Product Purpose

Plataforma interna On-Premises de acesso remoto autorizado, inventário, monitoramento e administração dos computadores corporativos da Uai Telecom. Não terá módulo de chamados.

O sucesso depende de permitir suporte com consentimento explícito, mostrar o estado verdadeiro das sessões e preservar o controle local do colaborador e a identidade dos equipamentos.

## Operating Context

- Somente integrantes autorizados da TI iniciam conexões, exclusivamente pelo painel web.
- O técnico localiza o computador pela lista de dispositivos cadastrados ou pelo código individual do equipamento.
- O aplicativo Windows é exclusivamente receptor: não inicia conexões e não permite acessar outros computadores.
- Fora da ativação, do consentimento e de uma sessão ativa, o aplicativo fica totalmente oculto em segundo plano.
- Na primeira instalação, o próprio colaborador informa um token temporário de uso único para cadastrar o computador. Após a ativação, essa tela não reaparece, salvo em reativação autorizada.

## Capabilities and Constraints

### Conta, autorização e auditoria

- Haverá apenas um perfil funcional no painel: equipe de TI.
- Todos os usuários da equipe de TI poderão acessar todos os computadores cadastrados, sempre sujeitos ao consentimento local.
- O painel utilizará uma conta compartilhada da equipe de TI, protegida por senha forte.
- O histórico atribuirá as ações à equipe de TI, sem identificar individualmente o técnico que utilizou a conta. A interface e a auditoria não devem prometer identificação individual inexistente.
- O painel concentra inventário, identificação do colaborador, cidade, setor, monitoramento de CPU, memória e armazenamento, administração, auditoria e histórico das sessões.

### Consentimento e permissões por sessão

- Toda sessão exige consentimento local explícito. Acesso não supervisionado é proibido.
- O aplicativo deve aparecer para solicitar consentimento e informar quem solicita acesso. A tela terá apenas um botão de ação, “Aceitar”, sem botão de recusa ou seletor de modalidade; o texto explicativo das permissões continua obrigatório. Com a conta compartilhada, a identidade autenticada disponível é a equipe de TI.
- A tela deve informar claramente, antes do aceite, todas as permissões concedidas naquela sessão: visualização, controle de teclado e mouse, área de transferência e transferência de arquivos.
- Não implementar autoaceite nem contornar consentimento local ou nativo do motor.
- **Decisão confirmada:** haverá um único aceite. Ao clicar em “Aceitar”, o colaborador autoriza, exclusivamente durante aquela sessão, visualização da tela, controle de teclado e mouse, uso da área de transferência e transferência de arquivos. Não haverá modalidade separada de somente visualização. Ausência de aceite não autoriza acesso; expiração não equivale a consentimento.

### Sessão ativa e encerramento

- O atendimento ativo pode continuar enquanto o login que o iniciou estiver válido, houver comunicação e o consentimento permanecer vigente. O atendimento não possui um limite próprio de duração.

- O computador acessado deve mostrar uma indicação visual clara da sessão ativa, incluindo contorno azul e barra de encerramento.
- O colaborador deve conseguir encerrar o acesso imediatamente.
- Encerramento local interrompe imagem, teclado, mouse, área de transferência e transferência de arquivos.
- Uma sessão recusada, expirada, revogada ou encerrada não pode ser retomada.
- O painel deve distinguir os estados reais de solicitação, consentimento, conexão, primeiro frame, visualização, controle e encerramento. Consentimento ou conexão de transporte não comprovam recebimento de imagem nem controle ativo.
- O conteúdo da tela e da sessão não será gravado em vídeo.

### Privacidade e credenciais

- Podem ser coletadas métricas de CPU, memória e armazenamento.
- O monitoramento não coleta conteúdo de arquivos, teclas digitadas, histórico de navegação ou capturas fora de sessão autorizada. A transferência explicitamente autorizada durante uma sessão não constitui coleta de conteúdo para monitoramento.
- Tokens, senhas, credenciais e outros segredos não podem aparecer em logs nem ser expostos na interface. Os campos necessários para informar senha e token devem permitir entrada protegida, sem reexibir valores armazenados ou divulgá-los em diagnósticos.
- Preservar cadastros, códigos públicos e credenciais dos computadores durante atualizações.

### Evidência e entrega

- Separar claramente funcionalidades simuladas, testadas automaticamente, validadas em laboratório e homologadas em Windows real.
- Não apresentar funcionalidade como concluída sem validação proporcional.
- Versões LAB devem ser claramente distintas de versões de produção.
- Este registro de requisitos não altera permissões, contas, consentimento, serviços ou instalações existentes.

## Brand Commitments

- Nome do produto: Uai Suporte. Identidade institucional: Uai Telecom.
- Usar somente a logo oficial da Uai fornecida pelo usuário e sua identidade oficial. Não utilizar imagens, logotipos ou identidade visual de outras empresas.
- A disponibilidade e a procedência do arquivo oficial devem ser verificadas antes de criar referências visuais. Se ele não estiver disponível, solicitá-lo novamente; não inventar nem substituir a logo.

## Evidence on Hand

- `frontend/`: implementação React/TypeScript, painel de monitoramento, ativação, receptor e visualizador; `frontend/package.json` descreve build e verificações.
- `backend/`: backend Java/Spring Boot; `desktop/`: aplicativo e componentes Windows; `infra/mesh/`: integração do motor remoto.
- `README.md` e `docs/`: histórico de arquitetura, versões LAB, testes e pendências. Trechos antigos descrevem papéis distintos, permissões por dispositivo e proibições de clipboard/arquivos; não devem substituir as decisões de produto confirmadas aqui.
- O README registra pendências de prova do motor, primeiro frame e controle em Windows real. A existência de código ou testes simulados não equivale à homologação.
- Logo da Uai presente na interface: `frontend/public/brand/uai-logo.png`; reutilizar o arquivo sem redesenhar a marca.

## Product Principles

1. Consentimento explícito e controle local do colaborador durante todo o atendimento.
2. Operação centralizada na equipe de TI pelo painel web, com receptor Windows sem capacidade de iniciar acessos.
3. Estados e promessas sustentados por evidência real, com limites de validação visíveis.
4. Preservação da identidade dos equipamentos e proteção de dados e credenciais.
5. Foco em suporte remoto, inventário e monitoramento, sem módulo de chamados.

## Accessibility & Inclusion

Preservar responsividade, acessibilidade e bom funcionamento. Consentimento, permissões concedidas, estado ativo e encerramento devem ser claros e utilizáveis. Nenhum padrão normativo específico foi definido nesta inicialização.

## Terminologia e expansão prevista

Usar “equipamentos” em vez de “frota” nos textos do produto. O responsável prevê adicionar uma área de impressoras. Essa intenção não atesta suporte já implementado nem define ainda as funcionalidades dessa área. Indicadores e ações específicos de computadores continuam identificados como tal.

### Relatórios de impressoras — decisão de 19/11/2026

- Testar primeiro no computador Windows do responsável, que possui o Uai Suporte e acesso local à Lexmark MX511de. Validar antes de distribuir às lojas.
- Um computador designado por loja deverá coletar os relatórios nativos das impressoras pela rede local, por meio do aplicativo existente. Essa coleta administrativa não inicia sessão de acesso remoto nem altera suas regras de consentimento.
- Automatizar relatório em PDF e envio mensal por e-mail, com dia configurável; dia 20 é a referência inicial para testes. Horário, computador coletor e configuração de e-mail ainda precisam ser definidos.
- **Atualização de escopo:** substituir a solicitação anterior de Estatísticas do dispositivo e resumo completo pelo relatório específico exigido por marca. Não apagar leituras históricas nem reinterpretar seus indicadores.
- Identificar marca, modelo, IP e número de série antes de coletar e atribuir o contador. Número de série indisponível deve ser explicitado; IP sozinho não prova continuidade entre equipamentos.
- **Lexmark:** uma página do “Relatório de ativo”, campo exato “Contags de imp. mono” (contagem de impressão monocromática). Localizar e validar esse relatório para a Lexmark 192.168.30.200, série 701533HH09191. Não substituir por contagem geral, impressão ou outros valores de Estatísticas do dispositivo.
- **Ricoh SP 3710SF:** “Página de manutenção”, seção “Contador → Contador do total”, campo “Total de páginas” no topo. Não usar os contadores das seções Impressora, Scanner ou Copiador.
- **Ricoh 4510 — Varjão de Minas:** relatório “Counter”, campo “Total”. Série informada G156R730202; modelo completo e IP a confirmar. O campo “Prints” é outro indicador e não deve substituir “Total”. Não aplicar a regra da SP 3710SF.
- **Brother — Paracatu:** relatório “Configurações da Impressora”, seção “Status do Dispositivo”, campo “Contagem Total de páginas”; na referência, página 3 de 5. Modelo parcialmente visível termina em L5652DN; confirmar nome completo, IP e série no equipamento. Não somar frente/verso nem substituir por contadores de cópias, impressões de PC, bandejas ou vida útil dos componentes.
- Associar cada impressora à loja e ao computador coletor designado. Validar a identidade no contexto da loja; endereços IP podem se repetir em redes diferentes. Modelo desconhecido ou campo não validado impede emissão automática como leitura confirmada.
- Entregar uma página por equipamento, preferencialmente o relatório nativo solicitado, com marca, modelo, série quando disponível, nome exato do campo, valor acumulado e data real da coleta. Não exibir o IP no relatório entregue; mantê-lo apenas no cadastro e nos dados internos de coleta. Ao usar o relatório nativo, selecionar a página que contém o contador solicitado, sem presumir que a paginação seja igual em todas as versões. Separar a data interna do equipamento. Valor não validado permanece pendente, nunca zero ou estimativa.
- As fotos fornecidas são referências, não leituras atuais. A Lexmark 192.168.100.210, série 701533HH0917C, é diferente da Lexmark 192.168.30.200, série 701533HH09191. Não misturar históricos. Os exemplos e suas datas constam em `docs/relatorios-impressoras-lab.md`.
- Registrar modelo, IP, número de série e horário real da coleta, separando-o da data interna da impressora. Validar identidade antes de atribuir uma leitura ao equipamento.
- Guardar as leituras acumuladas por mês, com data real e fonte. Calcular consumo somente entre leituras inicial e final do período, do mesmo equipamento e contador, com datas confirmadas. Sem leitura anterior válida, apresentar leitura acumulada; queda de contador exige revisão, não consumo negativo.
- Não alterar configurações da impressora nem zerar contadores. Não tratar transcrição ou dados simulados como coleta automática validada.
- Manter total de computadores separado de futuro total de impressoras.
- Endereços informados em 26/11/2026: Guima — 192.168.3.6; Carmo — 192.168.0.200; Cruzeiro — 192.168.0.119; PTU — IP a confirmar. Identificar os equipamentos antes de associar esses endereços aos modelos, séries e históricos existentes. Esses dados não comprovam conectividade ou coleta.
- Teste autorizado em 26/11/2026: execução única às 14h de Brasília no PC do responsável. Modo LAB no aplicativo com leitura eletrônica, PDF e SMTP local; só ativa após configuração explícita no Windows. Janela de recuperação até 14h30, com hora real, sem repetição em outro dia. Credencial protegida com DPAPI do usuário apenas neste teste; centralização no servidor permanece necessária para as lojas.
- Estado atual: modo de impressoras LAB implementado no aplicativo, com interpretador específico dos HTMLs observados da Lexmark e envio do PDF. Campo eletrônico candidato identificado, mas equivalência geral ao Relatório de ativo não homologada. Agendamento mensal, demais marcas e integração central ao servidor ainda pendentes. Testes locais não comprovam instalação nem ativação no Windows do responsável. Ver `docs/impressoras-teste-20261126.md`.
- Evidência posterior do teste de 26/11/2026: responsável confirmou recebimento automático do PDF, com coleta no Windows das 14:00:09 às 14:00:12 −03:00. Validação do caminho feliz neste PC e nesta Lexmark; não implica homologação de todas as marcas, da equivalência do contador ou de agendamento mensal. Integração à instalação principal permanece como próxima etapa.

O menu da equipe de TI inclui Impressoras. A solicitação conjunta identifica o resultado por equipamento e oferece um ZIP dos PDFs disponíveis. Na versão LAB, a Lexmark MX511de de série 701533HH09191 usa o computador coletor escolhido pela equipe. Os demais modelos aguardam integração com seus relatórios nativos.
