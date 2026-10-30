# Arquitetura confirmada: Windows receptor e controladores Windows/web

Este adendo prevalece sobre a restrição anterior de controlador exclusivamente
Windows. Não altera stack, contas, consentimento obrigatório nem isolamento da rede.

## Responsabilidades

**Acessar outro computador:** aplicativo Windows ou navegador autenticado, em
computadores, notebooks, tablets e celulares. Ambos usam a mesma base React, API
HTTPS, códigos públicos, autorização, auditoria e ciclo de vida. A integração
Windows usa WebView2/ponte C#; a web usa API HTTPS/CSRF e WSS no navegador.
O React do aplicativo permanece incorporado, atualizado por versão assinada;
o navegador recebe o build web do servidor interno. Não duplicar telas de produto.

**Permitir acesso a este computador:** aplicativo/agente Windows obrigatório,
instalado e executando com o Windows. Captura, compressão, entrada nativa,
consentimento, indicador e parada local pertencem ao receptor instalado. O navegador
nunca torna a máquina disponível para recepção, nem substitui o agente.

Inicialização atual é interativa por usuário após vínculo válido. Recepção antes
do login, troca de usuário, área segura/UAC e serviço não estão homologados. O
provisionamento deve associar de forma comprovada o Node ID Mesh ao cadastro API.

A web permanece restrita à rede Uai/VPN. Nenhuma ampliação de firewall, CORS ou
origens curinga é autorizada por este requisito. TLS permanece validado. Adaptador
web ainda será implementado depois da prova Windows, com tokens curtos somente em
memória e sem URLs externas, logs ou armazenamento persistente de credenciais.

## Indicador obrigatório no receptor (a implementar após imagem/controle)

Contorno azul por monitor, com bordas transparentes a cliques e etiqueta superior
interativa contendo identidade autenticada do solicitante, VIEW/CONTROL, duração
e Encerrar acesso. Não depende de qual controlador iniciou a conexão.
O aceite precede o indicador, e sua confirmação de funcionamento precede a liberação
da transmissão/entrada. Permanece até encerrar, expirar ou perder conexão.

O receptor deve monitorar o componente visual; falha ou impossibilidade de manter
a indicação encerra o motor dedicado. Stop local corta primeiro captura e entrada,
fecha viewer/autorizações e registra motivo no backend. Em queda de rede, o corte
local não espera HTTP; auditoria posterior precisa de confirmação/reenvio seguro.

TopMost sozinho não garante inviolabilidade contra entrada remota. Deve-se testar
proteção da etiqueta, mudanças de monitores/DPI, janelas maximizadas e tela cheia;
não prometer sobreposição à área segura do Windows. Não contornar UAC. A barra
atual do aplicativo NÃO satisfaz o requisito de contorno em todos os monitores.

## Qualidade e resposta

O SDK Mesh existente fornece JPEG, escala, intervalo de quadros e RTT de transporte.
O controlador ajusta parâmetros; captura e compressão continuam no Windows remoto.
Nenhum codec, criptografia ou protocolo próprio foi introduzido.

Implementação em `desktop/UaiSuporte.App/Viewer/quality.js`, reutilizável pelo futuro
adaptador web, sem dependência WebView2. Integração atual no viewer incorporado:

| Perfil | JPEG | Escala Mesh (1024 = original) | Intervalo solicitado |
|---|---:|---:|---:|
| Economia | 30 | 640 | 200 ms |
| Equilibrada | 50 | 1024 | 100 ms |
| Nitidez | 75 | 1024 | 100 ms |

Automático inicia equilibrado. Duas amostras ruins (RTT >=250 ms, fila de saída
>=64 KiB ou >=8 operações de imagem pendentes) reduzem qualidade; três boas
(RTT <120 ms, fila <8 KiB, imagens <2) recuperam equilibrada. Intervalo mínimo
de 20s entre mudanças evita oscilação. Perfil manual não é sobrescrito pelo automático.
Valores são premissas LAB, não resultados medidos entre Windows.

RTT vem do canal existente do SDK. Não é medida do tempo clique→imagem nem prova
de velocidade da rede. Após 25s sem amostra, exibir sem medição recente. Tela estática
não é desconexão por ausência de quadros. Estado, RTT e perfil aparecem no viewer;
a interface web os reutilizará quando habilitada. FPS solicitado não é FPS medido.

Entrada continua enviada imediatamente pelo SDK, fora de timers de atualização
da interface. A redução de imagem limita disputa por banda. **Prioridade real de
transporte não está implementada:** WSS/TCP tem entrega ordenada; não é possível
ultrapassar bytes já enviados. Não enfileirar teclas/cliques para retransmissão após
queda. Próxima validação medirá tempo de resposta sob congestionamento antes de
considerar consolidação de movimento ou outras otimizações compatíveis com Mesh.

## Reconexão segura

Perda de transporte interrompe imagem/entrada e invalida a sessão. Recuperar a rede
deve reconectar sinalização com tentativas limitadas e atraso progressivo, consultando
o backend novamente. NÃO reabrir socket com cookie antigo nem recuperar consentimento
encerrado. Novo acesso exige nova autorização e consentimento local; Stop, recusa,
expiração e revogação nunca iniciam reconexão automática. Automação de recuperação
da sinalização ainda pendente; fechamento e limpeza atuais permanecem.

## Web responsiva e toque (etapa posterior)

Toque simples = esquerdo; duplo toque = duplo clique; longo = direito; arraste =
cursor/itens. Pinça muda zoom local e não envia cliques. Prever teclado virtual,
tela cheia, orientação horizontal e ajuste à tela, conforme capacidades do navegador.
VIEW não registra handlers de entrada. Teclado móvel/IME, DPI e mapeamento após
zoom/rotação exigem testes reais em celular/tablet; não declarar suporte por CSS.

## Ordem e evidências

1. Assinatura LAB: verificada na VM; assinatura e cadeia confirmadas no Explorer
   Windows pelo operador, com hash correspondente. Agente ainda não executado.
2. Cadastro de dois Windows e códigos reais.
3. Solicitar/aceitar; comprovar captura e mouse/teclado.
4. Implementar/validar indicador e encerramento local.
5. Fluxo completo entre dois aplicativos Windows, inclusive falhas.
6. Habilitar controlador web compartilhado e validar navegador desktop.
7. Validar responsividade e gestos em celular/tablet.

Nenhum novo instalador final antes da prova principal. Testes automáticos de
adaptação e viewer usam transporte simulado e não substituem estas etapas.
