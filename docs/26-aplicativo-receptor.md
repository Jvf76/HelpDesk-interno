# Aplicativo Windows receptor — LAB 0.6.2

A partir desta revisão, o aplicativo Windows recebe suporte e não inicia conexões. O painel web é o único controlador: administrador ou operador/técnico com permissão para o dispositivo. Perfis de leitura e solicitante não iniciam sessões. Consentimento local continua obrigatório.

## Windows

- Primeira abertura continua mostrando ativação por token, sem login humano.
- Depois da ativação, mostra código, estado, histórico de acessos recebidos e controles locais.
- Atalho de inicialização do usuário usa --background. Ao entrar no Windows com cadastro existente, inicia na bandeja. Não há serviço novo que capture tela antes do login.
- Fechar a janela mantém o aplicativo no ícone junto ao relógio. Abrir pelo ícone restaura a janela.
- Menu da bandeja: Abrir Uai Suporte; Encerrar acesso e pausar; Sair e ficar indisponível.
- Sair encerra o motor local. Pausar interrompe imagem e entrada e confirma o encerramento no servidor quando a rede está disponível.
- Solicitação de consentimento traz a janela local à frente. O contorno azul e a barra de encerramento são janelas independentes e permanecem visíveis durante o atendimento, mesmo com a janela principal minimizada.
- Nenhuma janela de visualização remota ou botão Conectar é oferecido no aplicativo. Ponte nativa de dispositivo permite somente leitura de identidade e histórico recebido; não permite criação ou lançamento de sessão.

## Backend

POST /api/desktop/connections e POST /api/desktop/sessions/{id}/launch são negados, inclusive para clientes antigos autenticados. Sessões com dispositivo solicitante deixam de ser válidas. GET /api/desktop/connections retorna somente sessões recebidas pelo próprio dispositivo.

POST /api/connections exige conta de painel e autorização por dispositivo. A autorização é reavaliada durante a sessão. Identidade/heartbeat, ativação, revogação, métricas e encerramento local usam os fluxos existentes.

## Limites e migração

Não altera nenhum Windows instalado automaticamente. O LAB anterior não foi sobrescrito. A atualização no lugar ainda não é suportada: uma instalação existente é preservada e recusada pelo novo instalador; a migração deve ser conduzida com desinstalação/revogação e recuperação autorizada. O problema de desinstalação informado pelo usuário continua exigindo diagnóstico antes de executar outro instalador.

Compilação e testes simulados na VM não comprovam tray, foco do consentimento, reinicialização, UAC, DPAPI ou atendimento real. Testar em Windows: ativar → fechar janela → confirmar ícone → solicitar pelo painel → conferir consentimento visível → aceitar → encerrar localmente → reiniciar e confirmar início na bandeja → Sair e confirmar indisponibilidade. Não executar MeshAgent isoladamente.

## Verificação na VM — 30/10/2026

- Backend: 65 testes de fluxos críticos e 4 de contrato Mesh passaram, sem falhas; 2 testes opcionais de conexão Mesh ficaram ignorados. Suíte executada também com PostgreSQL isolado, resultado 0.
- Transporte nativo: 38 verificações passaram, incluindo bloqueio de solicitação e lançamento de visualizador por dispositivo antes de contatar a API.
- Instalador: 48 verificações de política passaram com a CA do laboratório.
- Interface: 34 verificações desktop, 14 de login web, 50 de monitoramento, 2 de qualidade adaptável e visualizador nas variantes desktop/web passaram. Essas verificações usam ponte/API/transporte simulados.
- Aplicativo Windows x64 compilado sem erros ou avisos. MeshAgent LAB aprovado manteve o hash e passou pela verificação de assinatura com a CA/CRL na VM; isso não substitui WinVerifyTrust no Windows.
- Backend e painel do laboratório atualizados após backup, sem sessões abertas e sem alteração das identidades de dispositivos existentes. HTTPS, login/logout e histórico privado passaram na verificação do laboratório; CA não confiada foi rejeitada sem bypass.
- Nenhum componente instalado nos computadores Windows durante esta alteração. Bandeja, inicialização na sessão do usuário, foco do consentimento e interrupção real de imagem/controle ainda dependem de Windows real.

## Artefato integrado

- Arquivo: `/home/agenda/uai-entregas/UaiSuporte-Setup-0.6.2-Lab.exe`
- Tamanho: 483805232 bytes.
- SHA-256: `161b80692d4575c34d04e3cc8c5c8e2d83f833adcae92b775c2cf259d57192d3`.
- Inno Setup compilou a versão 0.6.2. Recursos incorporados e assemblies do bundle conferidos por hash contra este build; textos da bandeja e argumento de início automático presentes.
- Instalador externo LAB sem Authenticode; MeshAgent interno permanece assinado. Validação Windows de assinatura/hash antes da execução mantida.
