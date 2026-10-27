# Resultados e pendências — 26/10/2026

## Resultado honesto

**Base funcional de helpdesk entregue; acesso remoto em prova técnica, não homologado.** Não há evidência de uma sessão Windows real concluída. A interface não usa dados falsos para simular máquinas ou telas. O motor está desativado por padrão, sem modo de demonstração.

## Por etapa solicitada

| Etapa | Entregue | Executado/verificado | Falta |
|---|---|---|---|
| 1. Análise/arquitetura | Relatório de referência fixado por commit, MIT/Apache, stack definida e fronteiras do motor | Leitura estática do fonte, licenças, dependências e instruções | Auditoria exaustiva/licenças da distribuição final |
| 2. Prova remota | Perfil Mesh de laboratório, adaptador Java real, C# de consentimento, protocolo de teste A/B | Servidor Mesh iniciou; Java autenticou por WSS/TLS com CA confiada e hostname validado; credencial inválida rejeitada | Windows A/B, frames reais, mouse/teclado, recusa, corte local e expiração física |
| 3. Identidade/dispositivos | Login/logout/CSRF, três perfis, autorização backend, vínculo uso único, heartbeat, permissões e revogação | 19 testes de fluxos críticos com PostgreSQL e execução via navegador | MFA, endurecimento operacional, distribuição assinada |
| 4. Painel/remoto | Solicitação, consentimento C#, lançamento de janela Mesh, emissão limitada e encerramento | Testes com motor substituído e 4 testes de contrato da API Mesh | Viewer incorporado, eventos de consentimento final/primeiro frame/fim, vinculação a uma única conexão física |
| 5. Chamados | Cadastro, prioridades/estados, comentários, histórico, vínculos e filtros | Testes API e browser criando/comentando/resolvendo chamado real em banco de teste | Paginação completa e políticas avançadas |
| 6. Instalação/documentação | Migração, Compose, env, scripts Windows, documentação, roteiro de homologação | Build React; build/publish C# Windows x64; migração PostgreSQL; checagem de dependências | Docker Compose executado, instalação/desinstalação Windows e restauração de backup testadas |

## Testes automatizados executados

Ambiente Linux, Java 21.0.13, Spring Boot 3.5.16, PostgreSQL **16.15** em cluster descartável separado. Flyway V1 aplicado do zero. A primeira rodada usou H2 e também passou; a rodada final abaixo usou PostgreSQL real.

- `CriticalFlowsTest`: **19 passados**, zero falhas/erros. Inclui isolamento de chamados entre solicitantes, comentários não autorizados, criação de admin negada, controle sem permissão, VIEW não promovido a CONTROL, recusa sem emissão de link, solicitação pendente, expiração de pedido/login, revogação/encerramento local através da API do motor, falha de encerramento mantida como STOPPING, permissão retirada, offline, agente revogado, enrollment usado/expirado, CSRF/login/logout, rate limit, emissão única por login original, logout removendo compartilhamento, agente de outro dispositivo e histórico de chamado.
- `MeshContractTest`: **4 passados**. Desktop-only, consent=72, prazo 1 min, viewOnly; resposta de remoção como objeto; remoção sem confirmação recusada; origem do link validada.
- `MeshConnectionTest`: **2 passados**, contra MeshCentral **1.3.1 real**, em loopback com certificado gerado pelo motor e CA importada em truststore exclusivo. Leitura de inventário vazio via WSS autenticado e rejeição de credencial inválida. Não havia agente Windows e nenhuma tela foi transmitida.
- **Total: 25 testes, zero falhas/erros/pulados na rodada final.** Por padrão, os 2 testes WSS são pulados quando não há MESH_SMOKE_URL configurada; 23 rodam sem motor.
- React: `tsc -b && vite build` passou. Checagem `npm audit` do frontend incluindo ferramentas de desenvolvimento: **zero alertas** na resolução consultada.
- Navegador Chromium/Playwright, API e PostgreSQL reais: login; dashboard; criação de chamado explicitamente identificado como teste; comentário; resolução; lista vazia de dispositivos; viewport 1440×1000 e 390×844; logout e troca para solicitante sem reaproveitar dados da identidade anterior. **Passou, sem exceções JavaScript.** Corrigida sobreposição de texto da lateral no layout móvel encontrada na inspeção visual. Dados exclusivos de banco descartável, sem simular computadores/sessões reais.
- Agente: `dotnet build` passou com **0 warnings / 0 errors**. `dotnet publish -r win-x64 --self-contained true` gerou executável e runtime em `agent/publish` (artefato local ignorado). Executar no Windows continua pendente; não foi alegada validação de WinForms/DPAPI.
- Docker indisponível neste host: Compose e imagens **não executados**. Backend e frontend foram iniciados diretamente, e o Mesh via Node.

## Dependências do motor: bloqueio de produção

O MeshCentral 1.2.5 da referência resolvia cinco alertas, três altos e dois moderados. Atualizar o motor para 1.3.1 sozinho não eliminou esses alertas. Foram aplicados overrides exatos e documentados: compression 1.8.2, express 4.22.3 e qs 6.16.1. O bootstrap Mesh tentava reinstalar versões antigas; `infra/mesh/patch-bootstrap.mjs` ajusta duas entradas específicas, verifica versão/conteúdo e preserva avisos Apache. O servidor foi iniciado com essa configuração e o canal WSS testado.

Na resolução final, `npm audit` ainda reporta **2 entradas de severidade alta**: node-forge e o pacote MeshCentral afetado transitivamente pelo mesmo problema. **Não são duas vulnerabilidades independentes comprovadas na aplicação.**

- [GHSA-86w9-cpqp-85rv — node-forge RSA PKCS#1 v1.5 signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv). A versão disponível consultada, 1.4.0, permanece no intervalo afetado; não havia versão corrigida no npm consultado. Não foi implementado remendo criptográfico próprio nem determinada explorabilidade em cada caminho do MeshCentral.
- Remediados na resolução: [compression](https://github.com/advisories/GHSA-vc2v-76pw-4v95), [qs, array limit](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) e [qs, isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).

**Não liberar o motor em produção** antes de correção upstream ou avaliação técnica documentada de mitigação/aplicabilidade. `MESH_ENABLED=false` permanece padrão. Rede interna reduz exposição, mas não corrige a biblioteca. Não foi executada auditoria SCA completa do backend Java nem pentest; passar testes não prova ausência de vulnerabilidades.

O MeshCentral ainda emitiu `Failed to sign ... Too few bytes to read ASN.1 value` para MeshService/MeshCmd de múltiplas arquiteturas ao carregar os agentes padrão. O servidor WSS ficou operacional, mas os binários e seu processo de assinatura **não foram homologados**. Tratar isso como pendência antes de distribuir agentes, não ignorar nem desabilitar proteção Windows.

## Reproduzir WSS (opcional)

Inicie um MeshCentral exclusivo de teste, com conta própria e certificado cuja CA esteja no truststore Java. Não use credenciais de produção. Defina `MESH_SMOKE_URL`, `MESH_SMOKE_USER`, `MESH_SMOKE_PASSWORD`, além das variáveis UAI_TEST_DATABASE/USER/PASSWORD se quiser PostgreSQL. Rode:

```bash
mvn -f backend/pom.xml test \
  -Djavax.net.ssl.trustStore=/caminho/absoluto/truststore-de-teste \
  -Djavax.net.ssl.trustStorePassword=senha-do-truststore
```

Nenhum teste cria sessão de desktop real. O teste de conexão consulta inventário e tenta autenticação inválida. Para a parte decisiva, siga **03-prova-windows.md** e registre resultados observados. Sem essa evidência, o projeto não atende ao critério principal de conclusão definido pelo solicitante.
