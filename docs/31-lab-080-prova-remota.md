# LAB 0.8.0 — candidato para diagnóstico, não homologado

O instalador único atualiza a instalação completa 0.6.0 sem desinstalar.
A migração legada deve ocorrer sob a mesma conta Windows que ativou o computador
(elevação UAC normal). Código público, ID e credencial são preservados.
A migração lê DPAPI CurrentUser, reprotege com DPAPI LocalMachine e ACL
SYSTEM/Administradores, confere igualdade do conteúdo e só remove a fonte
depois do commit. Isso é caminho implementado, não prova de DPAPI no Windows.
Se houver recuperação ou rollback pendente, o instalador bloqueia a atualização.
Não apagar arquivos de identidade ou usar outro token para contornar um erro.

## Tempo da prova
- Solicitação/notificação/consentimento Uai: 60 s, sem renovar ao notificar.
- Após aceite, abertura pelo controlador: 15 s.
- Autorização do motor: 20 s (comandos individuais limitados a 8 s).
- Transporte: 15 s.
- Consentimento nativo: 35 s no supervisor; política nativa de resposta: 30 s.
- Primeiro frame: 15 s; confirmação de renderização no relay: 10 s.
- Encerramento confirmado: 10 s.
- Teto de estabelecimento no relay: 120 s desde emissão da autorização.
- **Uso ativo: 60 s a partir do primeiro frame renderizado, consentimento
  nativo e indicador confirmados (VIEWING ou CONTROLLING).**
- Cookie do motor tem teto de 180 s desde emissão, permitindo estabelecimento
  até 120 s + uso ativo 60 s. Não dá direito a 180 s de controle.
- Backend e relay fixam active_until uma só vez. Duplicatas não estendem.
  Expiração, recusa, revogação e encerramento são terminais.
- Lease do relay: 12 s sem renovação. Falha de rede não permite retomar
  o mesmo UUID; exige outra tentativa e novo consentimento.

O relay mede a entrada real no estado ativo; o backend pode observá-la até
o próximo polling. O relógio não é reiniciado quando o painel a recebe.

## Diagnóstico do consentimento nativo
Não há autoaceite. A prova mantém consentimento Uai seguido de consentimento
nativo. O core MeshCentral 1.3.1 recebe somente hooks de diagnóstico:
REQUESTED, HELPER_CREATED, HELPER_READY, RESPONSE_ACCEPTED/REJECTED.
São registrados UUID, sessão solicitada (−1 = seleção automática), sessão
do motor, sessão console, PID/sessão do helper quando disponíveis.

O serviço em sessão 0 é esperado e não prova que o diálogo está nela.
DIALOG_SESSION_ZERO e DIALOG_WRONG_SESSION referem-se ao alvo/helper;
o serviço interrompe a tentativa nessas situações.
A interface enumera apenas janelas visíveis do PID indicado, sem títulos
ou conteúdo, e reporta WINDOW_VISIBLE_REPORTED por IPC autenticado.
O serviço confere novamente caminho do processo e sessão interativa ativa.
Esse evento comprova janela visível observada, não leitura pelo funcionário.

As APIs internas do helper variam no agente legado: campos ausentes permanecem
−1, sem inventar exibição. Se não houver evento de visibilidade, parar a prova
e investigar o UUID. HELPER_READY nunca significa diálogo efetivamente exibido.
A execução dessas APIs no agente assinado ainda depende do Windows.

## Componentes e segurança
Aplicativo receptor e serviço .NET 10 autocontidos, React local, WebView2 privado,
MeshAgent LAB assinado já aprovado (hash inalterado), CA específica, hosts,
licenças, desinstalador e rollback. Hash e Authenticode são conferidos antes de
iniciar o motor, inclusive no upgrade. Instalador LAB não tem Authenticode.
Nenhuma credencial permanente compartilhada é incorporada. TLS permanece validado.
Upgrade não chama ativação nem cria dispositivo. Falha anterior ao commit restaura
aplicativo e instalador, preservando cadastro original; falha na reversão bloqueia.

## Coordenação do laboratório
Este candidato requer backend com migrations V10/V11, relay capability v3,
patch-consent-diagnostics.mjs e controlador web desta revisão.
Não misturar servidor antigo e aplicativo novo para tirar conclusões.
Artefatos do servidor são preparados separadamente; sua preparação não implanta
serviços nem empurra o core para agentes conectados. Uma implantação posterior
deve ser coordenada antes da solicitação de acesso.

Windows A: controlador via https://suporte.internal (login web).
Windows B: receptor atualizado, https://suporte.internal e https://mesh.internal,
ambos TCP 443, rede autorizada/VPN e CA LAB confiável. Sem novas portas abertas.
A primeira ação entregue ao usuário é somente copiar e verificar o instalador.

## Roteiro interno de condução — executar uma ação por vez
Conferir arquivo → atualizar B → conferir mesmo código/ID e um só registro →
solicitar VIEW → observar consentimento Uai → observar consentimento nativo →
registrar último estado do UUID → somente após frame, nova tentativa CONTROL →
encerrar localmente → repetir com backend indisponível.
Parar no primeiro erro, sem reinstalar ou reativar para mascarar falha.
Não orientar execução isolada do MeshAgent.

Logs de serviço: %ProgramData%\UaiTelecom\UaiSuporte\Service\service.log
(acesso administrativo). Não enviar arquivos .bin, configuração ou logs brutos.
No servidor, usar GET /api/sessions/{UUID}/trace com autenticação autorizada.
Exportar somente eventos do UUID usando scripts/sanitize-remote-diagnostics.py
com --session UUID, que aplica uma lista de campos/valores permitidos.
Recusa e expiração sem frame não autorizam passar ao teste de controle.

## Validação
Testes Linux usam estados simulados, transporte WebSocket local e imagens de teste.
Não comprovam sessão real do Windows, diálogo nativo, DPAPI, atualização SCM,
bandeja, captura, mouse/teclado reais nem parada efetiva do desktop.
A prova entre Windows A/B continua obrigatória. Nenhum Windows foi alterado
durante esta preparação. Não é instalador definitivo.
