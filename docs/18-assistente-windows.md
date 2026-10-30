# Assistente Windows — Uai Suporte

Implementação sobre o motor de instalação LAB 0.5.0, sem novo pacote final
publicado e sem alterações no Windows A ou nos serviços da VM.

## Fluxo

1. Boas-vindas, identidade Uai Suporte e identificação LAB não assinada.
2. Código temporário mascarado, revisão explícita da CA (nome, SHA-256 e validade
   em detalhes), autorização de confiança, nomes locais e licença WebView2.
3. Resumo e confirmação em Instalar. Voltar preserva os dados; Cancelar fecha
   antes de qualquer alteração.
4. Instalação com progresso indeterminado e mensagens de etapas reais. Não há
   porcentagem inventada. Cancelamento/fechamento bloqueados durante a transação.
5. Conclusão apenas após retorno bem-sucedido do motor e confirmação no journal.
   Opção Iniciar o Uai Suporte marcada por padrão.

O código é verificado sintaticamente na preparação e consumido somente pelo
cadastro transacional após Instalar. Validá-lo no servidor antes de configurar
CA/hosts e verificar os binários mudaria indevidamente a ordem do LAB.
A janela é WinForms nativa, tamanho lógico fixo de 800 × 590, escalável por DPI,
com área rolável quando necessária e rodapé de navegação permanente.

## Segurança preservada

Mesmos payloads, código de uso único, credencial individual DPAPI, identidade
pública separada, verificação de hash/Authenticode, TLS, WebView2 privado,
provisionamento Mesh, rollback, revogação e desinstalador. O manifesto continua
requireAdministrator. Não foi adicionado segredo nem dependência baixada.

O laboratório inicia um processo MeshAgent dedicado para comprovar o vínculo,
encerra esse processo e configura inicialização do aplicativo com o Windows.
Não se anuncia instalação de um serviço Windows inexistente nessa arquitetura.

A abertura após Concluir verifica instalação concluída, mesma conta interativa
e token do desktop não elevado; usa caminho absoluto fixo e ambiente do usuário.
Falha nessa abertura mantém a instalação e orienta usar o menu Iniciar; não há
fallback elevado. Base Win32:
[CreateProcessWithTokenW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createprocesswithtokenw).
A criação do processo não comprova que a interface terminou de inicializar.

## Falhas e logs

Mensagem principal curta, Ver detalhes e Tentar novamente (retorna à preparação,
sem repetir automaticamente o código consumido). O journal diferencia reversão
pendente e remoção confirmada. Não se promete ausência de resíduos: a exclusão
do próprio instalador pode precisar de reinício. O bloqueio do aplicativo com
journal pendente permanece. Não existe atualização sobre instalação existente.

Logs:

- `%LOCALAPPDATA%\UaiTelecom\SetupLogs\setup-wizard.log`: início/versão,
  etapas, resultado, rollback, categoria de erro, HRESULT, código Win32/HTTP.
  Sobrevive à remoção para diagnóstico; limite de 1 MiB com uma rotação.
  Pode ser apagado manualmente após a análise.
- `%ProgramFiles%\UaiTelecom\UaiSuporte\setup-audit.log`: journal técnico
  existente, disponível até a limpeza/reinício.

Não se registram mensagens arbitrárias de exceção, respostas do servidor,
argumentos de cadastro, senhas, tokens, telas ou credenciais. Categorias e códigos
permitem correlacionar falhas às etapas. Logs adicionais do assistente não podem
impedir rollback se sua gravação falhar.

## Validação

Na VM: compilação C# do Setup; 39 verificações das políticas e diagnósticos
(incluindo seis verificações novas de não exposição de segredos/código Win32);
28 verificações de transporte existentes. O build usa o payload 0.5.0 existente
apenas para validar compilação; não é um instalador novo para distribuição.

Pendente em Windows: visual a 100/125/150/200% DPI, navegação por teclado,
boas-vindas/preparação/voltar, autorização de CA, código inválido/expirado,
instalação completa, rollback com/sem rede, revogação, remoção/reinício,
Iniciar marcado/desmarcado e processo iniciado sem elevação. Usar máquina de
laboratório limpa; não reinstalar sobre o Windows A já cadastrado.
A conexão real entre dois Windows continua pendente.

## Publicação LAB 0.5.1 — 29/10/2026

Após autorização do usuário, foi gerada a publicação x64 completa com o novo
assistente. Esta seção atualiza o estado anterior de implementação sem pacote.

- Arquivo: `/home/agenda/uai-entregas/UaiSuporte-Setup-0.5.1-Lab.exe`.
- Tamanho: 481471457 bytes (459,17 MiB).
- SHA-256: `f5306a5112ba55e781ac188f7e100d5af52a39f85f4f93cc04556f101f8a3b2c`.
- Stage: `dist/setup-051-lf0fke`. Pacote 0.5.0 anterior preservado e hash conferido.
- Versão dos assemblies App/Setup 0.5.1.0; interface e registro DisplayVersion
  atualizados. Identificador `UaiSuporte-LAB-0.5.0` do journal permanece estável
  como formato compatível; não significa que o executável seja o anterior.
- Inspeção do bundle final (255 entradas): assemblies Setup/Receiving idênticos
  aos publicados; metadados contêm as cinco telas novas. Recursos app.zip,
  MeshAgent, CA, manifesto e licença comparados byte a byte via SHA-256. React
  incorporado coincide com o frontend recém-compilado; .NET autocontido presente.
  Todos os 257 arquivos do WebView2 conferidos contra manifesto fixado.
- MeshAgent com assinatura/cadeia/CRL verificados novamente por osslsigncode na VM;
  verificação nativa WinVerifyTrust continua exigida no Windows na instalação.
- Testes repetidos: 39 Setup, 28 Transport, 43 backend passaram (2 testes opcionais
  MeshConnection pulados); 17 Mesh passaram sem skips; 2 qualidade, 14 verificações
  React e teste do viewer passaram com transporte simulado. Builds sem erros.
- Evidência local: `.tools/mesh-audit/wizard-051-*` e
  `.tools/mesh-audit/build-wizard-051.log`.
- Sem implantação/instalação remota, sem alteração do Windows A. Instalador LAB
  continua sem Authenticode própria; o MeshAgent interno mantém sua assinatura.
  Ainda não validado: navegação WinForms, instalação, abertura após Concluir e
  fluxo remoto entre dois Windows. Primeira ação autorizada é somente copiar e
  verificar hash, sem executar. Não atualizar sobre a instalação existente.
