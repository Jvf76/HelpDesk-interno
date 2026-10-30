# Inno Setup — LAB 0.5.2

O frontend do instalador agora usa Inno Setup 7.1.1 x64, estilo `classic light`,
idioma português do Brasil, painel lateral com identidade Uai Suporte nas telas
inicial/final e cabeçalho compacto nas intermediárias. O desenho é o assistente
nativo do Inno, não uma imitação em WinForms.

## Integração

`desktop/installer-inno/UaiSuporte.iss` incorpora o motor C# autocontido. O Inno
verifica seu SHA-256 e chama `InnoBridge` somente após clicar em Instalar. O motor
continua responsável por instalar, registrar a desinstalação, criar atalhos,
verificar certificados/assinatura/hash, vincular o dispositivo e reverter falhas.
`Uninstallable=no` e `CreateAppDir=no` evitam um segundo desinstalador concorrente;
o desinstalador seguro existente continua registrado e preserva a revogação antes
da exclusão. Sua interface permanece WinForms nesta versão.

A autorização temporária é transmitida em arquivo de uso único, em diretório
criado atomicamente pelo motor com ACL protegida para usuário atual, SYSTEM e
Administradores. Nunca é argumento de processo. O motor confere proprietário,
ACL, caminho, redirecionamentos, tamanho, formato e consentimentos; apaga o
arquivo antes do cadastro. O Inno também remove o arquivo ao sair. Não há credencial
permanente no pacote. Logs são os mesmos de `docs/18-assistente-windows.md`.

**O cadastro real ainda exige autorização de uso único.** A substituição por um
vínculo automático autorizado é trabalho pendente; mudar de framework visual não
remove a proteção. O aplicativo incorporado é o 0.5.1 já verificado, com .NET,
React local e WebView2 privado. Motor e invólucro Inno são 0.5.2. Não foi alterado
backend, infraestrutura, cadastro do Windows A ou acesso remoto.

## Prévia sem instalação

Argumento `/VISUAL=1`: permite percorrer boas-vindas, resumo e conclusão, sem
código, sem extrair/chamar o motor, sem cadastro ou alteração de CA/hosts.
As telas identificam explicitamente PRÉVIA VISUAL; a conclusão não afirma ter
instalado e não oferece iniciar o aplicativo. Nenhum recurso remoto é acionado.
O mecanismo de UAC do Inno continua normal; não há bypass de proteção.

Sem esse argumento o executável é um instalador real, não uma demonstração.
Não instalar sobre o Windows A já cadastrado. As versões 0.5.0 e 0.5.1 permanecem.

## Build

```
UAI_INNO_PAYLOAD="$PWD/dist/setup-051-lf0fke/payload" \
UAI_INNO_ISCC="$PWD/.tools/inno/wine/drive_c/InnoSetup/ISCC.exe" \
UAI_INNO_WINEPREFIX="$PWD/.tools/inno/wine" \
bash scripts/build-inno.sh
```

O diretório payload deve ser o integrado e verificado (app.zip, MeshAgent, CA,
manifesto e licença). O script recusa sobrescrever o artefato final existente.
Compilador oficial:
https://github.com/jrsoftware/issrc/releases/download/is-7_1_1/innosetup-7.1.1-x64.exe
SHA-256 `8a5a6711c3766a6e5fb74f280ba0e3551e719ce94538d901fdbd1f8f9920b3f0`.
Assinatura do compilador Pyrsys B.V. verificada com osslsigncode; evidência em
`.tools/inno/verified.log`. A cadeia pública usada nessa verificação foi obtida
no bundle Certifi 2024.08.30 (AAA Certificate Services); nenhum certificado foi
adicionado ao sistema. Prefixo Wine exclusivo em `.tools/inno/wine`.
Licença do Inno permite uso comercial preservando créditos:
https://github.com/jrsoftware/issrc/blob/is-7_1_1/license.txt
Não foram modificados binários do Inno nem removidos seus avisos de copyright.
Documentação do estilo: https://jrsoftware.org/ishelp/topic_setup_wizardstyle.htm

## Entrega e evidências

- `/home/agenda/uai-entregas/UaiSuporte-Setup-0.5.2-Lab.exe`
- 483637030 bytes.
- SHA-256 `b388fb29800cc2067d9070f1f2e04d9d7b0cc487541837449a250fdfeee03872`.
- Instalador externo LAB sem Authenticode própria. MeshAgent interno mantém a
  assinatura LAB e verificação nativa antes da execução.
- Compilação C# e Inno sem erros/avisos. 49 verificações Setup e 28 de transporte
  passaram; dez novas verificações cobrem a autorização de comunicação Inno/motor.
- Prévia executada em Wine na VM: boas-vindas → resumo → conclusão sem código
  ou instalação. Capturas `.tools/inno/inno-welcome.png`, `inno-ready.png`,
  `inno-finished.png`. Isso não representa validação em Windows real.
- Pendente: fluxo real Inno → ACL/request → motor, cadastro/rollback/revogação,
  desinstalação e abertura ao Concluir em Windows. O novo modo não é homologado
  para distribuição aos funcionários.
