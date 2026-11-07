# Falha de atualização 0.8.1 — 07/11/2026

## Evidência do Windows

O operador enviou o log do instalador. A atualização anterior para 0.8.0
concluiu em 05/11, com UPDATE_COMPLETE_IDENTITY_PRESERVED e INNO_INSTALL_OK.
Na tentativa nova, os eventos são, em UTC:

```
2026-11-07T12:12:31.1297542 INNO_INSTALL_BEGIN_0.8.1
2026-11-07T12:12:47.1616267 UPDATE_FAILED_ROLLBACK_BEGIN
2026-11-07T12:12:55.9633211 UPDATE_ROLLBACK_COMPLETE
2026-11-07T12:12:55.9641957 INNO_INSTALL_FAILED IOException:0x80131620
```

O fluxo de atualização foi selecionado. A falha ocorreu antes do registro
UPDATE_MESH_HASH_AND_SIGNATURE_OK e antes da troca dos arquivos da aplicação.
O log não distingue extração, cópia do instalador anterior, parada do serviço,
parada da interface, leitura protegida da configuração e validação do motor.
Não permite afirmar que o erro veio de uma instalação anterior incompatível.

O código 0x80070070 também enviado pertence a 03/11, não a esta tentativa.
Espaço insuficiente permanece uma hipótese, não uma causa confirmada para 07/11.
O pacote contém 955350719 bytes de aplicação descompactada; a atualização precisa
de espaço adicional para preparação e cópias do instalador, além do que a versão
existente já ocupa. Esse tamanho não é uma estimativa completa do pico em disco.

Consulta somente de leitura ao backend em 07/11 mostrou DESKTOP-0ON0ICK na
versão 0.8.0.0, não revogado, com último heartbeat às 13:43:25 UTC, cerca de
27 segundos antes da consulta. Isso corrobora a retomada da versão anterior;
não valida todos os arquivos locais ou um atendimento remoto.

## Defeito confirmado no diagnóstico

Installation.Upgrade capturava a falha sem guardar a exceção e lançava uma nova
IOException genérica após o rollback. O HRESULT original se perdia. Portanto,
0x80131620 nesse ponto não identifica a causa original.

O código agora registra etapas fixas da atualização, códigos da exceção original
antes do rollback e códigos de eventual falha do rollback. Mantém a exceção
original como InnerException para SetupAudit.ErrorCodes. Mensagens da exceção,
caminhos, configurações e credenciais não são incluídos no log sanitizado.
A sequência de atualização e os procedimentos de rollback não foram alterados.

66 verificações de Setup.Tests passaram, incluindo regressões com erro de disco,
acesso negado e falha criptográfica, com sentinelas de segredo. A compilação do
projeto Setup para Windows x64 passou sem avisos nem erros. Não houve execução
do instalador no Windows pela VM.

## Próximo passo

Consultar somente o espaço livre no volume do sistema do Windows acessado.
Preservar instalação, registro, credenciais DPAPI e diretórios transacionais.
Não recomendar desinstalação, exclusão manual ou reinstalação repetida sem
identificar a causa. Se o espaço não explicar a falha, a próxima investigação
deverá usar a instrumentação por etapa e manter o fluxo de recuperação.

O instalador 0.8.1 já entregue continua inalterado, com SHA-256
25013BDF33E2276C549B6BDE30B8CECE60927EB13A44B7C45228E04E0765E638.
Ele ainda não contém esta correção de diagnóstico. Nenhum novo pacote foi gerado
ou instalado nesta investigação.
