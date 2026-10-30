# LAB 0.5.3 — instalação sem código de cadastro

O Inno não pede código temporário nem autorização de uso único. A instalação
prepara o aplicativo, runtimes, certificado, nomes locais, MeshAgent verificado e
atalhos. A instalação termina sem criar uma identidade no servidor nem executar
o MeshAgent. A autorização explícita da CA e os termos continuam necessários.

Ao abrir o aplicativo e entrar com uma conta ativa, a ponte nativa gera uma
credencial individual e uma identificação privada de instalação, persistidas
com DPAPI antes de qualquer requisição. Ela chama `POST /api/devices/register`
com a sessão autenticada e CSRF. O código público UUID retornado é separado da
credencial. O cadastro fica offline até a confirmação da identidade Mesh e o
heartbeat; a assinatura/hash do motor continua obrigatória antes de executá-lo.
A senha não é persistida pelo fluxo de cadastro nem enviada ao MeshAgent.

O endpoint aceita qualquer conta ativa, limita cinco novos computadores por
hora/conta e é idempotente para a mesma instalação, conta e credencial. Recusa
reutilização da credencial, tentativa de assumir instalação de outra conta e
reutilização após revogação. Nunca retorna credencial no JSON de resposta.
Os identificadores privados e hashes não aparecem na lista pública de dispositivos.

Falhas de rede podem ser retomadas ao entrar novamente. A identidade pendente
persistida evita duplicação quando a resposta se perde e permite revogação ao
desinstalar. Fechar/sair durante o vínculo cancela a tarefa; o processo Mesh
dedicado é encerrado. Antes do vínculo/heartbeat, nenhum recebimento é habilitado.
A recuperação de uma identidade apagada por desinstalação/reinstalação limpa
não é automática nesta versão; não reinstalar sobre o Windows A para testar UI.
Cadastros/recovery antigos por código permanecem na API para compatibilidade,
mas nenhum campo desse tipo existe no instalador 0.5.3.

## Servidor

Migração V6 adiciona `registration_id` e `registration_hash`. Dados existentes
não são substituídos. API atualizada após backup validado em
`.tools/lab/backups/account-registration-20261029T141610Z`, sem sessões abertas.
Cadastro A `083cf71b-3d84-4232-9a9a-da0cdfc334d6` preservado, não revogado,
com credencial e identidade Mesh existentes. Não houve instalação remota.

## Testes e limites

47 testes backend passaram; dois opcionais de conexão pulados. Quatro testes
novos cobrem autenticação/CSRF/conta inativa, idempotência/offline, roubo/revogação
e limites/reutilização/validação. 48 verificações Setup passaram, incluindo
rejeição do formato antigo com código e exigência das autorizações CA/licença.
Builds C# passaram. React/qualidade/viewer e 28 verificações de transporte
reexecutados; transporte do viewer simulado, sem Windows.

Na VM, HTTPS/login/logout/TLS da API e motor verificados com validação de CA.
Falta validar no Windows real o ciclo instalar → login → identidade → Mesh →
online, cancelamento/remoção e atendimento entre duas máquinas. Este documento
substitui as instruções antigas de código de cadastro para o instalador 0.5.3.

## Artefato

`/home/agenda/uai-entregas/UaiSuporte-Setup-0.5.3-Lab.exe`, 483649578 bytes.
SHA-256: `d751cd077758ccaa52f4859d779ec880bac208dffadfe73d94dc011e20638161`.
Build Inno/C# sem erros/avisos. Aplicativo e Receiving do payload conferidos
contra os assemblies recém-publicados. Proteções e dependências verificadas pelo
build integrado, instalador externo LAB ainda sem assinatura própria.

Na VM/Wine, executado o fluxo NORMAL (sem /VISUAL), somente até o resumo:
boas-vindas → licença → configuração CA/hosts → pronto para instalar.
Não apareceu página/campo de código. Cancelado e fechado sem clicar Instalar.
Captura: `/home/agenda/uai-entregas/previa-instalador-0.5.3-sem-codigo.png`.
A versão 0.5.2 não foi alterada e ainda contém o fluxo antigo.
