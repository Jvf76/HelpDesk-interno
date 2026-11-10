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
