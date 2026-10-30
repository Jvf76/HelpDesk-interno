# MeshAgent e provisionamento — investigação de 28/10/2026

Atualização: assinatura LAB e cadeia válidas no Explorer do Windows, conforme
relato do operador após conferir o SHA256. Instalador integrado 0.5 implementado; execução Windows pendente (documento17).
Ver seção seguinte. O original upstream continua sem assinatura.

## Binário original identificado, NÃO aprovado para instalação

- Arquivo: MeshService64.exe, Windows x86-64, 3444736 bytes.
- Origem: https://github.com/Ylianst/MeshAgent/releases/download/legacy-1.2.6/MeshService64.exe
- Release: legacy-1.2.6 (arquivo preservado, não recompilado pelo release).
- Manifesto oficial agent-release.json aponta o snapshot de MeshCentral
  029b7338ecfeeacc65da3b5a1a4cc069baeb2f65.
- Metadado numérico PE: FileVersion e ProductVersion 0.0.0.0. Texto da versão:
  `2026-Feb-15 16:43:44-0800`. Não confundir com MeshCentral servidor 1.3.1.
- SHA-256: `cbf10a37fc01f74f2473aeca0a4b391dca6f9d0a8d0300aa7181dbce7bacc51e`.
- SHA-384: `319d3ad514173be85838bf7ba5995e11671d8f8e6df8e51b74c8304c3caf70e754e69db74b1baec1a6430ece213ab293`.
- Tamanho e SHA-384 conferem com agent-defaults.json do MeshCentral instalado.
  SHA-256 confere com digest do asset na API GitHub; nenhuma cópia de terceiro usada.
- Licença Apache-2.0, declarada em readme.md do tag legacy-1.2.6:
  https://github.com/Ylianst/MeshAgent/blob/legacy-1.2.6/readme.md#license
  Preservar licença/avisos e identificar modificações, inclusive assinatura LAB.
- Authenticode embutida: **AUSENTE**. osslsigncode retorna No signature found.
  Não existe editor Authenticode identificável nesse arquivo. ProductName não é
  assinatura. Get-AuthenticodeSignature/WinVerifyTrust no Windows não executados.
- Checksum PE é zero no binário oficial; isso não muda a confirmação do hash de
  origem. Não é justificativa para classificar a assinatura como válida.

Inventário legível por máquina: infra/mesh/agent-provenance.json, com
approvedForInstallation=false. O binário fica no cache privado de agentes da VM;
não está em instalador nem em diretório de distribuição. Não execute esse binário
sem a etapa de assinatura/aprovação e validação Windows.

## Causa do aviso ASN.1 e correção testada

A instância do laboratório usa a descrição `Uai Suporte — laboratório remoto`.
Em authenticode.js, duas rotas de assinatura convertem Buffer UTF-16LE com
`.toString()` (UTF-8 por padrão), e só então tentam inverter bytes para BMPString.
O travessão e os acentos são corrompidos; o DER gerado se torna inválido.

Reprodução com certificado efêmero de teste em memória (não a CA real): descrição
ASCII passa a leitura DER e alcança a rede; a descrição real com Unicode reproduz
Too few bytes to read ASN.1 value na linha1493, antes de contatar timestamp.
Isso separa o defeito local de um eventual erro do servidor de timestamp. O aviso
upstream #8199 também registra falhas de timestamp, mas não prova a mesma causa:
https://github.com/Ylianst/MeshCentral/issues/8199

patch-authenticode.mjs troca somente `.toString()` por `.toString('binary')` nessas
duas conversões. Não remove caracteres, assinatura, timestamp, ASN.1 strict ou
TLS. Postinstall e Dockerfile aplicam a correção com verificação de âncoras.

Teste novo executa o assinador real com o PE oficial e descrição Unicode, confirma
que a requisição alcança um servidor timestamp local de teste, e verifica que uma
resposta de timestamp inválida continua sendo rejeitada sem produzir executável.
14 testes do motor passaram, incluindo essa regressão. Testes de relay usam
transporte/quadros simulados, não captura de Windows.

A correção permanece no código/workspace; o assinador da instância ativa não foi
substituído. Na investigação inicial, antes da emissão LAB descrita abaixo, uma
tentativa de timestamp via https://timestamp.digicert.com:443 não conectou. Isso
não comprova bloqueio de firewall. A etapa seguinte usou Sectigo HTTPS/RFC3161
com sucesso, preservando a validação de TLS e timestamp.

## Assinatura LAB emitida em 28/10/2026 — Explorer Windows confirmado

A instrução posterior “Validar assinatura LAB do MeshAgent” selecionou a alternativa
LAB. Foi emitido certificado dedicado, pela CA LAB previamente aprovada, com EKU
codeSigning, digitalSignature, CA:false e chave RSA3072 privada fora do Git/pacote.
A chave TLS não foi reutilizada para assinatura de código.

- Editor: **Uai Telecom LAB - MeshAgent**, O=Uai Telecom Laboratory.
- Serial: `520A8B6872EBB95FBDBB1D14B7E56673`.
- SHA256 do certificado: `e563603b2b1533cae2273fa08b7493e9e4e4f73889620c7a3230e9cf9f8a0e4c`.
- Validade: 28/10/2026 15:03:33 UTC até 27/11/2026 15:03:33 UTC.
- Candidato: `/home/agenda/uai-entregas/validacao-meshagent/MeshService64-Uai-LAB.exe`.
- Tamanho: **3454728 bytes**.
- SHA256 FINAL: `4cb9aab0e6f9d90249f29bf15e46e66c702a282bc9f991bbb9b6ef0b78478019`.

Cópia do original verificado, assinada com osslsigncode2.8, SHA256 e timestamp
RFC3161 da Sectigo em HTTPS, com validação TLS habilitada. Nenhum código, recurso,
credencial ou configuração MSH foi incorporado. A assinatura atesta a cópia pela
Uai LAB, não pelo fornecedor. O hash original permanece separado no manifesto.
Fonte do serviço/protocolo: https://www.sectigo.com/resource-library/time-stamping-server

Verificação Linux: digest PE, cadeia LAB, assinatura, CRL e timestamp com cadeia
pública passaram, sem ignore-timestamp, ignore-cdp ou noverifypeer. Teste negativo
alterou um byte do PE em cópia descartável; verificação recusou o arquivo.
Evidência local: `.tools/mesh-audit/lab-signature-verify.txt` e
`tampered-rejected.txt`. Consulta RFC3161 separada também verificada pelo OpenSSL.

CRL pública assinada em `https://suporte.internal/pki/uai-lab-codesign.crl`, sob
mesma restrição de rede do laboratório. Não é distribuição de software nem página
nova. Conteúdo baixado via HTTPS/CA validada dentro da VM e conferido com OpenSSL.
CRL inicial válida até **04/11/2026 15:03:33 UTC**. Antes desse prazo, operador deve
renovar na VM com `python3 scripts/renew-lab-signing-crl.py` (chave permanece privada).
Ainda não há agendamento automático de renovação. Falha de revogação não deve ser
ignorada. Revogar esse editor exige registrar revogação no banco OpenSSL dedicado,
renovar/publicar a CRL e bloquear os hashes de execução; não remover a CA geral de
TLS para revogar um único editor. Teste nativo de revogação ainda pendente.

**Evidência Windows fornecida pelo operador:** hash final conferiu; em Propriedades
→ Assinaturas Digitais o editor Uai Telecom LAB - MeshAgent apresentou assinatura
válida. Caminho de Certificação mostrou a CA Uai Suporte LAB 131.0.112.23 2026-10-27
e o editor esperado; status da CA válido. O arquivo não foi executado nem instalado.
Isso confirma a verificação gráfica naquele usuário/máquina, não a execução da
política WinVerifyTrust do aplicativo, teste negativo de revogação ou recepção remota.
O candidato assinado foi liberado somente para a primeira prova LAB pelo instalador
0.5 integrado, que repete hash/WinVerifyTrust no destino. Não é liberação de produção.
A CA precisa ser confiável no contexto Windows correto e a CRL acessível; validar
por usuário não prova execução em conta de serviço. SmartScreen e Defender continuam
habilitados. Assinatura LAB não fornece reputação pública ou aprovação de produção.

O arquivo acima serve somente para inspeção de assinatura, não deve ser executado.
Nenhum agente foi instalado; apagar a cópia desfaz essa etapa. Pasta inclui README
curto e licença Apache. Nenhum instalador final novo foi produzido.

## Provisionamento implementado em código, sem novo instalador

- Cada código temporário vincula a um cadastro UUID existente; validade 10min.
  Código público (UUID) permanece estável e não concede acesso.
- Nova credencial aleatória de 256bits, exclusiva da instalação, gerada no app e
  salva com DPAPI CurrentUser antes do envio. API armazena somente seu SHA-256.
- Recibo hash de enrollment, com validade10min, permite repetir a MESMA operação
  com o mesmo código e credencial caso a resposta HTTPS se perca. Outro token
  não reutiliza o código. O servidor não cria uma segunda linha de dispositivo.
- GET /api/agent/identity confirma identidade/credencial antes de iniciar o motor.
  Revogação impede a confirmação. Cadastro não marca online antes de heartbeat.
- POST /api/devices/{id}/recovery exige ADMIN, preserva UUID, invalida credencial
  anterior, encerra autorizações existentes e emite novo código temporário. É
  uma ação explícita da TI, não recuperação por nome do PC, MAC ou código público.
- 30 tentativas de enrollment/minuto/IP observado. Limites de conexão entre
  usuários da versão0.4 continuam. No laboratório, o IP da API pode ser o proxy.
- Identidade válida preservada em reinstalação é reutilizada. Se removida ou
  inacessível (outro usuário Windows), TI deve recuperar o mesmo cadastro; nunca
  gerar automaticamente duplicata ou confiar só no código público.
- Escrever identidade/configuração usa arquivo temporário DPAPI e troca atômica.
  Código temporário e recibo local são removidos após confirmar o vínculo.
- Início local verifica SHA-256 E WinVerifyTrust antes de executar MeshAgent.
  Assinatura inválida impede inicialização, mesmo que o hash seja o esperado.
- Após vínculo e motor válidos, registra início INTERATIVO por usuário na pasta
  Startup. Não é serviço oculto nem recepção na tela de login. A janela continua
  visível. Falha no registro suspende novas conexões.
- Desinstalador remove atalhos de Startup apenas se apontarem para o executável
  desta instalação, em perfis locais registrados. Perfis redirecionados/roaming,
  UAC com outra conta e limpeza no Windows real ainda precisam de validação.

Migração V4 e backend atualizados no PostgreSQL do laboratório após 40 testes
automatizados passarem (2 testes opcionais de conexão real omitidos). Backup anterior
em `.tools/lab/backups/enrollment-v4-20261028T151925Z`. Nenhuma sessão ou dispositivo
estava cadastrado no momento da atualização. Login/logout, HTTPS, listagem e rejeição
de CA não confiada passaram após iniciar. Sem novo instalador, instalação Windows
ou ativação de agente.

Ainda falta automatizar e testar a preparação no contexto correto do funcionário,
configuração MSH e associação comprovada do Node ID Mesh ao cadastro API. A seleção
da assinatura não elimina esse trabalho. Não declarar provisionamento completo
por apenas gerar um token em teste.

## Antes de qualquer instalação em Windows A

Entregar arquivo LAB com hash FINAL e manifesto de componentes, editor e assinatura
verificados, procedimento de remoção validado e cadastro temporário individual.
A etapa seguinte produziu o pacote integrado LAB0.5, ainda pendente da primeira
instalação Windows; ver documento17 e o registro mais recente de resultados.

Rede de laboratório: https://suporte.internal e https://mesh.internal, TCP443,
ambos131.0.112.23; origem autorizada131.0.115.234/32. Banco/API interna permanecem
restritos. Novos Windows devem confiar na CA específica, sem desabilitar TLS.

Logs futuros a coletar, sem identidades/tokens: LocalAppData/UaiTelecom/UaiSuporte/
app.log e client.log; ProgramFiles/UaiTelecom/UaiSuporte/setup-audit.log; na VM,
journalctl --user das unidades uai-lab-backend e uai-lab-mesh. Não enviar
identity.bin, setup.bin, pending-enrollment.bin, MSH, banco Mesh ou chaves privadas.

Sequência posterior, aguardando resultado a cada passo: instalarA → cadastro/códigoA
→ instalarB → cadastro/códigoB → solicitar → aceitar → imagem → controle → parar
noA → confirmar corte de imagem/entrada e auditoria. Repetir recusa, VIEW, expiração,
revogação e desconexão. Nenhuma etapa real foi declarada validada por simulação.
