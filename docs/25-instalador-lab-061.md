# Instalador integrado LAB 0.6.1

Entrega Windows x64: `UaiSuporte-Setup-0.6.1-Lab.exe`. O instalador 0.6.0 não é sobrescrito. Artefato e SHA-256 definitivo ficam em `/home/agenda/uai-entregas` após a verificação do pacote.

## Componentes

- Assistente Inno Setup com UAC e uma entrada de desinstalação **Uai Suporte**.
- Aplicativo C#/.NET 10 autocontido com React incorporado e WebView2 privado, sem download de componentes na instalação.
- MeshAgent LAB incorporado, sem console ou atalho separado. Hash fixado e Authenticode verificados antes de executar. Mantém processo separado, controlado pelo aplicativo; não é um novo serviço Windows de sistema. Inicializa com a sessão do usuário Windows autorizado.
- Ativação por token administrativo de uso único; credencial individual protegida por DPAPI e ACL; vínculo Mesh comprovado antes de receber acesso. Código público não é credencial.
- Coletor de CPU, memória e discos; presença com jitter e reconexão com backoff. Envio agrupado ao backend V8.
- CA LAB específica, configuração explícita de nomes, licenças e desinstalador integrado com revogação/rollback e bloqueio quando a limpeza fica pendente.
- Painel administrativo continua somente na web, em https://suporte.internal. Não há login administrativo, gráficos ou inventário administrativo na navegação Windows.

O motor aprovado mantém SHA-256 `4cb9aab0e6f9d90249f29bf15e46e66c702a282bc9f991bbb9b6ef0b78478019` e editor `Uai Telecom LAB - MeshAgent`. O PE assinado não foi modificado. A assinatura criptográfica e CRL foram verificadas na VM; WinVerifyTrust e revogação são novamente exigidos no Windows. O instalador externo LAB ainda não tem Authenticode; isso é identificado no assistente. Não é distribuição homologada para funcionários.

Nenhuma senha, token de ativação fixo ou credencial administrativa foi adicionada ao instalador. O token é emitido pelo painel web após login administrativo e informado somente no aplicativo. Não deve ser enviado em comando, URL ou log.

## Instalação e atualização

Não executar o MeshAgent separadamente. Não copiar arquivos manualmente para dentro de uma instalação existente.

Esta versão LAB ainda não implementa atualização transacional no lugar: ela recusa sobrescrever uma instalação/cadastro existente. A migração suportada exige desinstalação com confirmação de revogação, reinício quando solicitado e nova ativação. Para preservar o código público, o administrador deve emitir um token de recuperação do cadastro revogado. Esse procedimento será conduzido passo a passo; apenas copiar o instalador não altera o Windows.

A desinstalação remove os componentes, credenciais locais e inicialização pertencentes ao produto; preserva entradas hosts/CA preexistentes e histórico no servidor. Revogação indisponível mantém limpeza pendente e aplicativo bloqueado. Não prometer atualização sem interrupção ou reinstalação já validada para 0.6.1.

## Testes e limites

Resultados desta rodada em `.tools/release-061` (fora do Git): backend H2 e PostgreSQL isolado; políticas de instalação, transporte e agendamento; React e viewer com ponte/transporte simulados; hash/assinatura Mesh; recursos incorporados, versão dos assemblies e correspondência do payload ao build. O teste de assinatura nativa Windows, UAC, DPAPI, início automático, coleta de contadores e atendimento real entre duas máquinas continua pendente.

Presença padrão ~30 s; métricas ~60–90 s; nada é coletado de documentos, navegação, teclado ou telas fora da sessão autorizada. O painel recebe dados reais, sem fabricar valores quando o computador não envia métricas.

Rede: HTTPS/WSS em suporte.internal e mesh.internal, porta 443, restrita à origem autorizada Uai/VPN. A CA e seu hash são apresentados explicitamente no assistente. Não ignorar alertas de TLS/assinatura nem desativar proteções Windows.

Logs de instalação: `%LOCALAPPDATA%\UaiTelecom\SetupLogs\setup-wizard.log`. Logs e estados de rollback são sanitizados; não enviar arquivos de identidade DPAPI ou tokens como diagnóstico.

## Artefato conferido

- Caminho: /home/agenda/uai-entregas/UaiSuporte-Setup-0.6.1-Lab.exe
- Tamanho: 483.730.987 bytes (aproximadamente 461,3 MiB).
- SHA-256: 61E5E3C1CAB271F48958A5864DA811A14AE26A0CEFBAD14CC1EAF1A4BB9CF484
- Inno compilou o engine 0.6.1.0. Recursos incorporados foram comparados por hash com o payload desta compilação; assemblies de aplicativo/coletor são 0.6.1.0. Bundle .NET conferido (255 entradas).
- 68 testes backend passaram em H2 e PostgreSQL; dois testes Java WSS opcionais não executados nessa bateria. WSS/HTTPS verificados separadamente contra o laboratório.
- 48 verificações de políticas de setup, 37 de transporte e 67 de agendamento passaram; Node Mesh: 16 passaram e um opcional ficou sem execução.
- Frontend: 23 verificações desktop simuladas, 14 de login web, 19 de monitoramento e duas de qualidade; visualizador testado com transporte simulado nas integrações desktop e web.
- Assinatura e CRL do MeshAgent passaram na VM. A assinatura do binário não foi alterada. Instalador 0.6.0 anterior conferido e preservado.
- Marca do consentimento e barra do motor configurada como Uai Suporte no laboratório, com backup; nenhuma sessão estava aberta. Exibição nativa real ainda exige prova em Windows.

Esta entrega não comprova execução, atualização, DPAPI, coleta nativa ou atendimento remoto em Windows 0.6.1. Copiar e verificar o hash não instala o produto. A primeira ação combinada é somente essa cópia.
