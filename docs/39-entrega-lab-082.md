# Entrega candidata LAB 0.8.2 — 09/11/2026

## Artefato

- Arquivo: `UaiSuporte-Setup-0.8.2-Lab.exe`.
- Local na VM: `/home/agenda/uai-entregas/UaiSuporte-Setup-0.8.2-Lab.exe`.
- Tamanho: 533996392 bytes (509,26 MiB).
- SHA-256: `3BA0C5E6CBE5BF9A19C8C67159A5CDC8915CDDF687FFC8A5C63BBEF8F8ED1B68`.
- Versão PE do instalador e assemblies conferidos: `0.8.2.0`.
- Instalador LAB sem Authenticode próprio. Não é distribuição homologada.
- Aplicação e serviço autocontidos Windows x64; o bootstrap Inno é x86 e instala
  os componentes x64. O instalador não foi executado nesta VM.

O [diagnóstico 38](38-lab-082-token-windows.md) distingue a falha real comprovada
em TOKEN_SESSION_SET da correção candidata de direitos e ordem de preparação.
O erro ocorreu após DEVICE_ACTIVATED, antes de iniciar o motor. Não justifica
apagar a identidade, desinstalar ou solicitar outra ativação.

## Conteúdo e verificações do pacote

Aplicativo, serviço, React incorporado, .NET autocontido, WebView2 privado,
MeshAgent LAB, CA específica, configuração do laboratório, licenças,
desinstalador e atualização com rollback permanecem integrados.

Conferidos na VM:

- Compilação do frontend, aplicação, serviço e instalador Inno concluída.
- Metadados da DLL Receiving publicada contêm InteractiveTokenPolicy,
  NativeOperations e máscara explícita 0x1AB.
- 24 recursos locais do aplicativo, incluindo React, visualizador e ícone,
  comparados por SHA-256 com os arquivos atuais.
- Cinco recursos do mecanismo do instalador comparados por SHA-256 com o
  payload: app.zip, meshagent.exe, lab-ca.cer, dependencies.json e licença.
- CRC de todas as 842 entradas de app.zip verificado. Aplicação descompactada:
  955364541 bytes. Esse valor não representa o pico de espaço da atualização.
- Credenciais locais, estado de instalação e arquivos de recuperação de
  ativação ausentes do pacote; nenhuma credencial compartilhada adicionada.
- Mesmo MeshAgent autorizado anteriormente, sem modificar seus bytes ou sua
  assinatura: SHA-256
  `4CB9AAB0E6F9D90249F29BF15E46E66C702A282BC9F991BBB9B6EF0B78478019`.
  Validação Windows da assinatura/cadeia foi relatada pelo operador em etapa
  anterior. Não foi repetida no Windows nesta entrega. A instalação e execução
  continuam exigindo validação de hash e Authenticode.
- CA específica: SHA-256
  `A1FFB98EB2364BB6EF0B30F5FD5AE61F1689FFFBA1CA6F1510641EAD624D7138`.
  TLS continua obrigatório, sem exceção de certificado.
- Instaladores 0.6.0, 0.8.0 e 0.8.1 preservados com tamanho e SHA-256 anteriores.

## Testes automatizados

| Suíte | Verificações aprovadas | Limite |
| --- | ---: | --- |
| Service.Tests | 210 | Política de lançamento, privilégios modelados, supervisão, IPC e bloqueio local; não chama APIs Windows |
| Setup.Tests | 66 | Políticas e diagnóstico/rollback, sem instalação real |
| Transport.Tests | 38 | Origens, ponte, credenciais e bloqueios; sem WebView2 em execução |
| Monitoring.Tests | 67 | Agendamento, fila/backoff; sem coletor Windows real |
| Diagnóstico de consentimento nativo | 7 | Patch, sanitização e preservação dos callbacks; sem diálogo Windows |

Total: 388 verificações. Build e testes de política não comprovam que o Windows
concedeu os direitos do token, iniciou o motor ou mostrou o consentimento.
O teste de regressão de acesso negado usa um modelo explícito; não reproduz o
kernel Windows na VM Linux.

Evidências locais, sem credenciais: `.tools/lab-082/` (logs das suítes, builds,
metadados e hashes dos recursos). Não incluir arquivos protegidos `.bin`, cookies,
tokens ou configurações privadas ao solicitar diagnóstico do Windows.

## Validação que falta

O candidato deve atualizar a instalação 0.8.1 já ativada, preservando código
público, identidade e credencial DPAPI. Esse comportamento, o rollback e a
execução do motor ainda precisam de confirmação no Windows real.

Não houve instalação nos computadores, mudança de banco, publicação de página
de download ou implantação dos serviços do servidor. O servidor ainda usa o
relay legado com diagnóstico v3. A máquina de estados e a contagem de 60 segundos
ativos do código-fonte precisam de implantação coordenada antes da prova remota
completa; não atribuir esses comportamentos ao ambiente atual.

## Condução do próximo teste

Primeira ação: copiar o executável por SCP e comparar o SHA-256 acima. Não
executar ainda. Aguardar o resultado antes de conferir espaço livre e identidade,
autorizar a atualização manual e verificar MOTOR_PLACEMENT/MOTOR_START_FAILED.
Não desinstalar, executar MeshAgent isoladamente ou desativar proteções.

Se o motor iniciar, prosseguir uma ação por vez para o consentimento, primeiro
frame e encerramento local. Parar no primeiro erro e coletar somente o diagnóstico
sanitizado correspondente. Nenhuma sessão remota foi homologada nesta entrega.
