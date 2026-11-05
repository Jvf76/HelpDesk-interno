# Serviço corporativo e interface interativa — implementação em validação

Candidato LAB 0.7.0, revisão de 30/10/2026. Substitui a arquitetura de processo único do LAB 0.6.2. Nenhum Windows foi alterado. Os instaladores entregues anteriormente continuam imutáveis; não contêm esta revisão. O pacote integrado desta revisão é somente para laboratório, não uma versão definitiva homologada.

## Componentes e limites

`desktop/UaiSuporte.Service` é um serviço SCM automático LocalSystem, sem console, Form ou WebView instanciados. Possui identidade, cliente HTTPS, presença, métricas, vínculo e supervisão do motor integrado. Usa a biblioteca Receiving para reaproveitar provisionamento, validação Authenticode, coleta e Job Object. O processo do motor é criado suspenso, associado ao Job Object e só então liberado; fechar o job encerra seus descendentes.

`desktop/UaiSuporte.App` continua sendo a interface React incorporada, sem login humano e sem função de controlar outros computadores. Recebe apenas estado/código/histórico sanitizado pelo canal local. A interface não lê o cofre nem recebe o bearer. A ativação envia o token uma vez ao serviço pelo pipe, nunca pela linha de comando. A janela fecha para a bandeja. O menu oferece abrir, copiar código, estado, versão e sair da interface. Sair durante atendimento exige confirmação e interrompe o acesso; o serviço continua presença e métricas. Sem interface saudável não há acesso remoto.

O serviço inicia no boot. A interface é registrada em HKLM/Run e inicia na sessão do usuário com `--background`. Sem cadastro, abre a ativação; com cadastro, permanece na bandeja. O WebView só é inicializado ao abrir a janela. A recuperação administrativa permanece necessária para revogação/cadastro corrompido. Queda de internet conserva identidade e mostra indisponibilidade, não exige outro token.

A enumeração WTS aceita exatamente uma sessão interativa ativa; ambiguidade, ausência de usuário, bloqueio, logout ou troca de sessão interrompem o motor. Não anunciar suporte homologado a RDP, fast user switching, UAC, tela de login ou captura em sessão 0. O motor agora será executado pelo serviço; captura/entrada nesse contexto são uma prova obrigatória em Windows antes de distribuir esta revisão.

## Canal local

`LocalChannel.cs` e `ServiceProtocol.cs` usam named pipes locais com ACL: SYSTEM pode criar instâncias, INTERACTIVE tem leitura/escrita explícitas, NETWORK é negado. O cliente não solicita GENERIC_WRITE nem direito de criar instância. Ambas as pontas verificam a identidade do processo: servidor confirma PID, sessão ativa, caminho fixo em Program Files e hashes das assemblies; cliente compara o PID do pipe com o PID do serviço retornado pelo SCM antes de enviar o token.

Operações são enumeradas, sem proxy HTTP arbitrário, shell ou leitura de arquivos. Frames têm até 32 KiB; há timeouts, concorrência limitada, restrição de tentativas de ativação, logs por códigos e descarte dos buffers de serialização. Uma aprovação exige solicitação pendente e não expirada e confirmação do indicador para aquele ID e PID.

O canal de emergência `.stop` é independente do canal de consultas, para não aguardar histórico ou HTTP. Ele mata o motor local antes de qualquer registro de rede. Confirmação visual renova uma concessão de 5 segundos; supervisor verifica a cada 500 ms. O indicador verifica também IsWindowVisible e DWMWA_CLOAKED (janelas ocultadas pelo shell/desktop virtual); ausência de confirmação encerra o acesso. A interface também verifica OpenInputDesktop e suspende o acesso quando o desktop de entrada não é Default (por exemplo UAC); isso ainda depende de validação Windows. Processo encerrado/troca de sessão causa parada na próxima verificação; travamento da interface tem limite nominal de 5,5 segundos, além do escalonamento do Windows. Não chamar esse limite de instantâneo. Botão local usa o canal prioritário, sem depender da internet.

As checagens não constituem proteção contra administrador local/SYSTEM comprometido nem uma prova de resistência a injeção em processo da mesma sessão. Testes negativos reais de ACL, impersonação, PID, sessão e adulteração dos arquivos são obrigatórios; não foram executados na VM Linux.

Referências usadas: [serviços interativos e isolamento da sessão 0](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services), [identificação do cliente do pipe](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getnamedpipeclientprocessid), [construtor com direitos explícitos](https://learn.microsoft.com/en-us/dotnet/api/system.io.pipes.namedpipeclientstream.-ctor?view=net-10.0).

## Identidade e instalação

`DeviceStore.cs` guarda dados em `%ProgramData%\UaiTelecom\UaiSuporte\Service`, protegido por ACL apenas SYSTEM/Administradores, DPAPI LocalMachine e entropia ligada ao MachineGuid. Segredos não são enviados à interface. O código público permanece separado do bearer. A ativação idempotente e os hashes de token no servidor são reaproveitados.

A migração do LAB anterior exige elevação na mesma conta que possui a identidade DPAPI CurrentUser. Ela decifra nessa conta, protege no novo escopo e copia o estado do motor para a pasta restrita. Preserva ID/código/credencial; não faz novo cadastro HTTP. A origem fica disponível para rollback e é removida após commit. O modelo de elevação LAB não foi ampliado para uso de credenciais de outra conta.

`CorporateInstallation.cs` registra/remove SCM, inicialização e manifesto de integridade. `ApplicationSwap.cs` troca pastas preparadas e restaura a aplicação antiga em falha. `Installation.cs` mantém a identidade fora dessa troca, preserva desinstalador anterior até commit e restaura serviço anterior em rollback. Uma interrupção abrupta com `.next`/`.previous` pendentes bloqueia continuação para recuperação administrativa; ainda não há recuperação automática homologada após queda de energia.

Dados transitórios da interface ficam em `%LocalAppData%\UaiTelecom\UaiSuporte\Ui\<Id da instalação>`; a desinstalação remove somente esse diretório nos perfis Windows, sem apagar perfis de outro ID.

Desinstalação: parar motor/serviço/interfaces, revogar usando credencial protegida, remover serviço/Run/aplicação/dados próprios; CA e hosts seguem as regras de propriedade existentes. Sem confirmação de revogação, a limpeza não apaga a única credencial nem anuncia sucesso. O desinstalador novo não deve apagar cadastro legado não migrado: usar o original ou concluir a migração. O instalador LAB 0.6.0 foi preservado.

## Backend e painel

Migration `V9__corporate_service.sql`: `device.service_state`, `device.collected_at`, `fleet_metric.silent` e `fleet_metric.high_usage`.

- Novo `POST /api/agent/stop-access`: somente credencial do próprio dispositivo, motivos enumerados, encerra suas sessões e audita sem apagar a presença corporativa. Marca motor STOPPED até próxima comunicação de disponibilidade.
- `POST /api/agent/presence`: mantém autenticação/limites/retencão existentes; aceita estado do serviço e horário da coleta; recusa `deviceId` fornecido pelo cliente, datas mais de 30 s no futuro ou 2 min antigas, e corpo acima de 32 KiB inclusive sem Content-Length. CPU 0–100, memória/disco não negativos e disponíveis não maiores que total.
- Endpoints de inventário/histórico/configuração reaproveitados. Séries da frota incluem computadores sem comunicação e com recursos elevados. Detalhe tem gráficos de CPU, RAM e menor espaço livre entre discos; inventário continua mostrando discos individuais e metadados editáveis.
- Login, CSRF e permissões da web mantidos. Interface Windows não inicia conexão.

## Frequência e estimativas

Heartbeat 30 s e métricas 60 s por padrão, configuráveis com limites existentes e jitter ±10%. Cada relatório agrupa dados. CPU usa delta GetSystemTimes; RAM usa GlobalMemoryStatusEx; somente discos locais. Não há coleta de tela fora da sessão, arquivos, teclado, histórico de navegação ou lista de processos para inventário.

Amostra representativa serializada na VM: heartbeat 299 bytes; relatório com CPU/RAM/um disco 446 bytes. Aproximadamente 1,1 MB/dia de corpos JSON de presença por computador, excluindo HTTP/TLS, respostas, motor e sessão remota. Varia com tamanho dos nomes e número de discos. Solicitações são consultadas a cada 5 s quando o motor está disponível (até 17.280 consultas/dia); o canal de controle é adicional ao heartbeat. UI/serviço usam pulsos locais de 1 s, não transmitidos ao servidor.

Fila de métricas: zero amostras persistentes, apenas uma coleta em andamento; após falha é coletada amostra atual. Backoff 5/10/20/40/80/160/300 s, com jitter, inclusive antes de repetir confirmação de parada. Logs locais rotacionam em aproximadamente 1 MiB por arquivo.

Não há medição Windows de CPU/RAM/disco/rede. Para planejamento apenas, reservar inicialmente 50–150 MiB para o serviço .NET, além de motor e interface, e usar CPU ociosa abaixo de 1% como meta de teste, não como resultado garantido. Medir working set/private bytes e CPU por 15 min com e sem interface, contabilizando os processos separados. Nenhuma capacidade de frota foi certificada.

## Provas obrigatórias antes de liberar instalador

Compilação Linux não comprova SCM, inicialização, DPAPI, ACL, tray, foco, indicadores, captura ou entrada. Testar no Windows autorizado: atualização com código igual → boot sem janela → serviço online antes de abrir interface → copiar código → fechar janela mantendo métricas → consentimento → indicador em todos os monitores → parada local sem rede → matar/travar interface e medir parada → sair da interface preservando monitoramento → revogar → atualizar sem token novo → falhar atualização e conferir rollback → desinstalar e conferir resíduos. Não executar MeshAgent isoladamente.

## Testes executados na VM

- PostgreSQL 16 isolado: 73 casos de fluxos críticos e 4 contratos Mesh aprovados; 2 testes opcionais de conexão Mesh ignorados. Inclui cinco repetições da disputa pelo mesmo token, perda de resposta, idempotência, revogação, login web, permissões, retenção, envio concorrente, limites, horário, payload excessivo e parada de acesso preservando presença.
- Foi encontrada e corrigida uma disputa na criação da linha do limitador: a transação do limitador agora termina dentro de seu bloqueio, independente da ativação externa. Não foi certificado backend com múltiplas instâncias.
- Políticas do serviço/protocolo/troca de arquivos: 131 verificações; 67 de agendamento/backoff; 38 de transporte; 48 de política do instalador. A troca de arquivos foi executada em diretórios temporários Linux; não representa update de serviço/DPAPI no Windows.
- React: 34 verificações desktop com ponte simulada, 14 de login web, 56 de inventário/gráficos, 2 de adaptação de qualidade e visualizador desktop/web com transporte simulado.
- Aplicativo, serviço e código do instalador compilados sem erros/avisos. Serviço publicado autocontido Windows x64 em diretório de teste da VM. Build do pacote não executa o serviço nem o motor.
- Backend V9 e painel atualizados no laboratório após backup, sem sessões abertas e sem mudar identidades cadastradas. HTTPS, login/logout, histórico privado e rejeição de CA não confiada passaram.
- Pendente: toda a integração real de SCM/DPAPI/ACL/pipe, migração de Mesh em sessão 0, bandeja, boot, consentimento, UAC, bordas, encerramento, instalação/atualização/desinstalação. Não há prova entre dois Windows para esta revisão.

## Arquivos principais

Serviço: `desktop/UaiSuporte.Service/Program.cs`, `ServiceRuntime.cs`. Armazenamento e canal: `desktop/UaiSuporte.Receiving/DeviceStore.cs`, `LocalChannel.cs`, `ServiceProtocol.cs`, `InteractiveDesktop.cs`. Interface e supervisão: `desktop/UaiSuporte.App/Program.cs`, `desktop/UaiSuporte.Receiving/Program.cs`, `SessionIndicator.cs`, `ManagedMesh.cs`. Instalador: `CorporateInstallation.cs`, `ApplicationSwap.cs`, `Installation.cs`, projetos e scripts de build. Backend: `MonitoringService.java`, `MonitoringController.java`, `DeviceController.java`, `PresenceBody.java`, `Security.java`, `SessionService.java`, V9. React: `DeviceApp.tsx`, `DeviceMetricHistory.tsx`, `FleetOverview.tsx`, `MonitoringPanel.tsx`. Testes: `Service.Tests`, `CriticalFlowsTest.java`, `frontend/tests/desktop.mjs`, `frontend/tests/monitoring.mjs`.

## Artefato LAB integrado

- Versão: 0.7.0 LAB Windows x64, destinado apenas a teste manual.
- Arquivo: `/home/agenda/uai-entregas/UaiSuporte-Setup-0.7.0-Lab.exe`.
- Tamanho: 533944657 bytes (509.21 MiB).
- SHA-256: `13F064985DEF3F20442472CF569D37B7E456D3AF92DF78CAF1ADC2388FA8444A`.
- Executável externo LAB sem Authenticode; componente MeshAgent assinado, com hash e assinatura verificados pelo instalador. Não contornar bloqueios do Windows.
- Conferência automática do bundle confirmou assemblies 0.7.0, assistente, React incorporado, serviço autocontido, runtime privado, CA e motor contra os arquivos deste build. A rotina de proteção recursiva dos arquivos migrados foi confirmada no assembly empacotado; execução das ACLs depende de Windows.
- LAB 0.6.0 preservado: `DD00D4B91BBE7835137167B80C3DFE86B3EAA78805D2944F675E43C743564CC4`. Nenhuma instalação Windows realizada.
