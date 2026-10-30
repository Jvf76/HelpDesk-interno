#ifndef EnginePath
  #error EnginePath is required
#endif
#ifndef EngineHash
  #error EngineHash is required
#endif
#ifndef OutputPath
  #define OutputPath "..\..\dist"
#endif
[Setup]
AppId=UaiSuporte-LAB-Inno
AppName=Uai Suporte
AppVersion=0.6.1
AppPublisher=Uai Telecom
VersionInfoVersion=0.6.1.0
DefaultDirName={autopf}\UaiTelecom\UaiSuporte
CreateAppDir=no
Uninstallable=no
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=classic light
DisableWelcomePage=no
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=no
CloseApplications=no
RestartApplications=no
SetupIconFile=..\UaiSuporte.App\app.ico
WizardImageFile=assets\wizard.bmp
WizardSmallImageFile=assets\small.bmp
LicenseFile=..\..\.tools\setup-deps\webview2-license.txt
OutputDir={#OutputPath}
OutputBaseFilename=UaiSuporte-Setup-0.6.1-Lab
Compression=none
SolidCompression=no
SetupLogging=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Messages]
WelcomeLabel1=Bem-vindo ao Assistente de Instalação do Uai Suporte
WelcomeLabel2=O assistente instalará o Uai Suporte neste computador.%n%nClique em Avançar para continuar.%n%nVersão LAB 0.6.1 — uso autorizado em laboratório. Instalador não assinado.
FinishedHeadingLabel=Concluindo o Assistente de Instalação do Uai Suporte
FinishedLabel=O Uai Suporte foi instalado com sucesso neste computador.%n%nAbra o aplicativo e use um token de ativação fornecido pela administração.
ReadyLabel1=Pronto para instalar o Uai Suporte.
ReadyLabel2a=Serão instalados os componentes necessários para o funcionamento e atendimento remoto. Clique em Instalar para continuar.

[Files]
Source: "{#EnginePath}"; DestName: "UaiSuporte.Engine.exe"; Flags: dontcopy

[Code]
var
  ConsentPage: TInputOptionWizardPage;
  StartApp: TNewCheckBox;
  WorkDirectory: String;
  Prepared, Installed, Busy, Preview: Boolean;
  Progress: TOutputMarqueeProgressWizardPage;

function InitializeSetup: Boolean;
begin
  Preview := ExpandConstant('{param:VISUAL|0}') = '1';
  Result := not WizardSilent;
end;

procedure InitializeWizard;
begin
  ConsentPage := CreateInputOptionPage(wpLicense, 'Configuração do laboratório',
    'Confira antes de autorizar',
    'CA: Uai Suporte LAB 131.0.112.23 2026-10-27' + #13#10 +
    'SHA-256:' + #13#10 +
    'A1FFB98EB2364BB6EF0B30F5FD5AE61F1689FFFBA1CA6F1510641EAD624D7138' + #13#10#13#10 +
    'Somente esta CA será instalada em Raízes Confiáveis, se ausente. Nomes locais: suporte.internal e mesh.internal em 131.0.112.23. Entradas existentes serão preservadas.', False, False);
  ConsentPage.Add('Autorizo confiar neste certificado do laboratório.');
  ConsentPage.Add('Configurar os nomes dos servidores neste computador.');
  ConsentPage.Values[1] := True;
  Progress := CreateOutputMarqueeProgressPage('Instalando o Uai Suporte',
    'Preparando o Uai Suporte...');
  StartApp := TNewCheckBox.Create(WizardForm);
  StartApp.Parent := WizardForm.FinishedPage;
  StartApp.Left := WizardForm.FinishedLabel.Left;
  StartApp.Top := WizardForm.FinishedLabel.Top + WizardForm.FinishedLabel.Height + ScaleY(12);
  StartApp.Width := ScaleX(280);
  StartApp.Caption := 'Iniciar o Uai Suporte'; StartApp.Checked := True;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := Preview and ((PageID = wpLicense) or (PageID = ConsentPage.ID));
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if not Preview and (CurPageID = ConsentPage.ID) and not ConsentPage.Values[0] then begin
    MsgBox('Confirme a autorização do certificado antes de continuar.', mbError, MB_OK); Result := False;
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if Preview then begin
    if CurPageID = wpWelcome then
      WizardForm.WelcomeLabel2.Caption := 'PRÉVIA VISUAL — nenhuma instalação será realizada.' + #13#10#13#10 + 'Avance para conferir o formato do assistente. O cadastro e os componentes não serão executados.';
    if CurPageID = wpReady then begin
      WizardForm.ReadyLabel.Caption := 'PRÉVIA VISUAL — clique para conferir a tela final. Nenhuma instalação será realizada.';
      WizardForm.NextButton.Caption := 'Ver conclusão';
    end;
    if CurPageID = wpFinished then begin
      WizardForm.FinishedLabel.Caption := 'Prévia concluída. Nenhuma instalação ou cadastro foi realizado.';
      StartApp.Visible := False;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var ExitCode: Integer; Names, Request: String;
begin
  Result := '';
  if Preview or Installed then Exit;
  Busy := True;
  Progress.Show;
  try
   try
    Progress.SetText('Validando componentes...', 'Mantenha a conexão com o servidor.');
    Progress.Animate;
    ExtractTemporaryFile('UaiSuporte.Engine.exe');
    if GetSHA256OfFile(ExpandConstant('{tmp}\UaiSuporte.Engine.exe')) <> '{#EngineHash}' then
      RaiseException('O componente de instalação falhou na verificação de integridade.');
    if not Prepared then begin
      WorkDirectory := ExpandConstant('{tmp}\uai-authorization');
      if not Exec(ExpandConstant('{tmp}\UaiSuporte.Engine.exe'), '--inno-prepare "' + WorkDirectory + '"', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
        RaiseException('Não foi possível preparar a instalação.');
      if ExitCode <> 0 then RaiseException('Preparação recusada. Confira a mesma conta Windows e os logs com a TI.');
      Prepared := True;
    end;
    if ConsentPage.Values[1] then Names := 'HOSTS_YES' else Names := 'HOSTS_NO';
    Request := WorkDirectory + '\settings.txt';
    if not SaveStringToFile(Request, 'CA_ACCEPTED' + #13#10 + 'TERMS_ACCEPTED' + #13#10 + Names, False) then
      RaiseException('Não foi possível preparar a configuração.');
    Progress.SetText('Instalando o aplicativo...', 'Após instalar, entre no aplicativo para cadastrar este computador.');
    try
      if not Exec(ExpandConstant('{tmp}\UaiSuporte.Engine.exe'), '--inno-install "' + WorkDirectory + '"', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
        RaiseException('Não foi possível iniciar a instalação.');
      if ExitCode <> 0 then RaiseException('Não foi possível concluir a instalação. Consulte os logs com a TI. Se a limpeza ficou pendente, reconecte ao servidor e use o desinstalador. O aplicativo permanece bloqueado enquanto a reversão estiver pendente.');
      Installed := True;
    finally
      DeleteFile(Request);
    end;
  except
    Result := GetExceptionMessage;
   end;
  finally
    Progress.Hide;
    Busy := False;
  end;
end;

procedure CancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  if Busy or Installed then Cancel := False;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var ExitCode: Integer;
begin
  if (CurStep = ssDone) and Installed and StartApp.Checked and not Preview then
    if not Exec(ExpandConstant('{tmp}\UaiSuporte.Engine.exe'), '--inno-launch', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or (ExitCode <> 0) then
      MsgBox('Abra o Uai Suporte pelo menu Iniciar.', mbInformation, MB_OK);
end;

procedure DeinitializeSetup;
begin
  if WorkDirectory <> '' then DeleteFile(WorkDirectory + '\settings.txt');
end;
