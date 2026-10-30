# Resultado da implementação LAB 0.6.0 — 30/10/2026

Artefato: `/home/agenda/uai-entregas/UaiSuporte-Setup-0.6.0-Lab.exe`
Tamanho: 483670564 bytes
SHA-256: `dd00d4b91bbe7835137167b80c3dfe86b3eaa78805d2944f675e43c743564cc4`

Instalador Inno Setup x64, aplicativo único, React incorporado, .NET autocontido,
WebView2 privado, MeshAgent assinado LAB, CA/configuração LAB, rollback e desinstalador.
O instalador continua sem assinatura Authenticode própria (LAB). O MeshAgent mantém
assinatura e hash verificados antes de executar. Nenhum token foi incluído no pacote.

## Verificações executadas

- Backend: 52 testes de fluxos críticos + 4 contratos Mesh passaram, tanto em H2
  quanto em PostgreSQL 16 isolado. Dois testes opcionais de conexão Mesh foram
  ignorados porque dependem de ambiente externo.
- Ativação: validade, token inválido/expirado/revogado/usado, limitação, consumo
  simultâneo, repetição após resposta perdida, ausência de duplicata e recuperação
  direcionada com substituição da credencial e preservação do código.
- Autorização: credencial revogada, cabeçalho com identidade divergente, isolamento
  entre usuário web e dispositivo, bloqueio da rota antiga de cadastro por login,
  consentimento obrigatório e revogação do solicitante durante uma sessão.
- Transporte: 37 verificações base; 38 incluindo recursos incorporados e, numa
  execução separada, rejeição TLS real na VM por CA não confiada. Erros de TLS e
  indisponibilidade também cobertos por transporte simulado.
- React: 23 verificações sem login Windows com ponte simulada; 14 regressões de
  login/logout web com API simulada; 2 testes de qualidade. Visualizador decodifica
  JPEG, bloqueia entrada VIEW, envia entrada CONTROL e limpa canvas/socket ao parar,
  usando transporte de teste.
- Instalador: 48 verificações de política passaram. NÃO são instalação/rollback
  reais no Windows.
- Motor: 16 testes passaram, incluindo sockets de teste e recusa/encerramento;
  1 teste de fixture do binário original não foi executado.
- Assinatura/CRL MeshAgent: osslsigncode na VM retornou sucesso. A validação real
  anterior do mesmo hash no Windows foi relatada pelo usuário; esta versão do
  instalador ainda não foi executada no Windows.
- Pacote: versão dos assemblies 0.6.0.0, recursos React coincidentes com o build,
  payloads incorporados coincidentes, CRC do ZIP interno, .NET/WebView2 presentes,
  hash MeshAgent e compilação do Inno confirmados.

## Laboratório em execução

Backend V7 e painel web atualizados. Os quatro serviços continuam ativos.
HTTPS, login/logout web, rejeição de CA desconhecida, emissão/revogação de token
administrativo e rejeição de cookie de usuário nas rotas de dispositivo passaram
em chamadas reais dentro da VM. Nenhum dispositivo fictício foi cadastrado no banco
operacional. As identidades, hashes de credenciais e vínculos Mesh dos dispositivos
existentes foram comparados antes/depois e preservados.

Backup anterior à migração:
`.tools/lab/backups/device-activation-20261030T112328Z`.
Relatórios detalhados: `.tools/activation-060-results/` (local, fora do Git).
A tentativa inicial de testes em outro banco do PostgreSQL do laboratório foi
recusada pelo pg_hba existente. Não alteramos essa política: os testes passaram
em instância PostgreSQL temporária, restrita a loopback com senha, encerrada e
removida ao final.

## Ainda não comprovado

- Instalação 0.6.0, DPAPI/ACL, cópia de arquivos para outro Windows, startup,
  rollback/desinstalação e reativação nativos.
- Vínculo completo do novo fluxo com MeshAgent em Windows real.
- Contorno azul em todos os monitores, falha do indicador, tela cheia e interrupção
  efetiva de imagem/mouse/teclado por encerramento local.
- Fluxo completo entre dois Windows e comportamento sob desconexão/expiração reais.
- Controlador remoto web e controles de toque: pendentes de implementação, como
  já estavam antes desta mudança. Login e administração web foram preservados.

A credencial é preparada por CSPRNG no aplicativo antes do envio e atribuída pelo
servidor ao cadastro individual, preservando a recuperação e revogação após perda
de resposta. A rotação disponível é a recuperação administrativa autorizada por
novo token; não há rotação automática periódica. DPAPI é por usuário e máquina;
não equivale a atestação TPM nem suporta clonagem integral do Windows.

Nenhum instalador foi executado remotamente e nenhum Windows foi alterado.
O acesso remoto NÃO está homologado.
