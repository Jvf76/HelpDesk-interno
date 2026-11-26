using System.Diagnostics;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using UaiSuporte.Printers;

namespace UaiSuporte.App;

// Isolated, opt-in LAB. No enrollment, remote motor, service or browser session access.
sealed class PrinterLab : Form {
    static readonly string Root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"UaiTelecom","UaiSuporte","PrinterLab-20261126");
    static readonly string StatePath=Path.Combine(Root,"state.json");
    readonly Label status=new(){AutoSize=true,MaximumSize=new(650,0),Margin=new(0,12,0,12)};
    readonly TextBox password=new(){UseSystemPasswordChar=true,Width=400};
    readonly Button arm=new(){Text="Ativar teste de hoje às 14h",AutoSize=true};
    readonly Button cancel=new(){Text="Cancelar agendamento",AutoSize=true};
    readonly Button preview=new(){Text="Validar coleta e gerar PDF agora (sem e-mail)",AutoSize=true};
    readonly System.Windows.Forms.Timer timer=new(){Interval=10000};
    readonly NotifyIcon tray=new();
    readonly CancellationTokenSource stop=new();
    bool busy,exit;
    sealed record State(string Status="DISABLED",int Attempts=0,DateTimeOffset? NextAttempt=null,string? Folder=null,string? MessageId=null);
    State state=new();
    public PrinterLab() {
        Text="Uai Suporte • Impressoras LAB";Font=new Font("Segoe UI",10);ClientSize=new(720,590);MinimumSize=new(650,560);AutoScaleMode=AutoScaleMode.Dpi;
        var panel=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new(24)};
        void Label(string text){panel.Controls.Add(new Label{Text=text,AutoSize=true,MaximumSize=new(650,0),Margin=new(0,0,0,12)});}
        Label("Teste único: 26/11/2026 às 14h (Brasília)");
        Label("Lexmark MX511de • 192.168.30.200 • Série 701533HH09191\nRemetente: uaisuporte@uaitelecom.com.br\nDestino: joaocaixeta@uaitelecom.com.br");
        Label("O PDF será de teste, com o campo eletrônico Lados monocromáticos impressos / Total. Equivalência ao Relatório de ativo ainda não homologada. Nenhuma impressão física será solicitada.");
        Label("Deixe este aplicativo na bandeja, com o Windows ligado e conectado. Se voltar até 14h30, o teste pode executar atrasado, registrando a hora real. Após 14h30, expira. Não repete em outro dia.");
        Label("Senha SMTP (protegida pelo Windows para este usuário, não exibida depois de salvar):");
        panel.Controls.Add(password);panel.Controls.Add(arm);panel.Controls.Add(preview);panel.Controls.Add(cancel);panel.Controls.Add(status);
        var files=new Button{Text="Abrir pasta dos resultados",AutoSize=true};panel.Controls.Add(files);
        files.Click+=(_,_)=>{Directory.CreateDirectory(Root);Process.Start(new ProcessStartInfo(Root){UseShellExecute=true});};
        Controls.Add(panel);
        using var iconStream=System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream("app.ico");
        Icon=iconStream==null?SystemIcons.Application:new Icon(iconStream);tray.Icon=Icon;tray.Text="Uai Suporte • Impressoras LAB";tray.Visible=true;
        var menu=new ContextMenuStrip();menu.Items.Add("Abrir teste de impressoras",null,(_,_)=>{Show();WindowState=FormWindowState.Normal;Activate();});
        menu.Items.Add("Sair (interrompe o agendamento local)",null,(_,_)=>{if(busy){MessageBox.Show(this,"Aguarde a operação em andamento.");return;}exit=true;Close();});
        tray.ContextMenuStrip=menu;tray.DoubleClick+=(_,_)=>{Show();WindowState=FormWindowState.Normal;Activate();};
        Directory.CreateDirectory(Root);
        try {using var gate=Lock();state=Read();var recovered=PrinterSchedule.Recover(state.Status);if(recovered=="ARMED" && state.Attempts>=3)recovered="COLLECTION_FAILED";if(recovered!=state.Status){state=state with{Status=recovered};Save();}}
        catch{state=new("STATE_ERROR");}
        arm.Click+=(_,_)=>Arm();cancel.Click+=(_,_)=>Cancel();preview.Click+=async(_,_)=>await Preview();
        timer.Tick+=async(_,_)=>await Tick();timer.Start();RefreshStatus();
        Shown+=async(_,_)=>await Tick();
        FormClosing+=(_,e)=>{if(!exit && e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();return;}stop.Cancel();};
        FormClosed+=(_,_)=>{timer.Dispose();tray.Dispose();stop.Dispose();};
    }
    static FileStream Lock()=>new(Path.Combine(Root,"run.lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None);
    static State Read()=>File.Exists(StatePath)?JsonSerializer.Deserialize<State>(File.ReadAllText(StatePath))??throw new InvalidDataException():new();
    void Save(){File.WriteAllText(StatePath+".new",JsonSerializer.Serialize(state));File.Move(StatePath+".new",StatePath,true);}
    void Arm(){
        if(busy)return;
        try {
            using var gate=Lock();state=Read();
            if(state.Status is "SENT" or "SENDING" or "DELIVERY_UNCONFIRMED" or "COLLECTING")throw new InvalidOperationException("Execução já enviada ou com resultado incerto; não será repetida.");
            if(DateTimeOffset.Now>=PrinterSchedule.Due)throw new InvalidOperationException("O horário das 14h já passou. O teste não será agendado retroativamente.");
            if(string.IsNullOrWhiteSpace(password.Text))throw new InvalidOperationException("Informe a senha SMTP localmente.");
            byte[] clear=Encoding.UTF8.GetBytes(password.Text);
            try {File.WriteAllBytes(Path.Combine(Root,"smtp.dpapi"),ProtectedData.Protect(clear,null,DataProtectionScope.CurrentUser));}
            finally {CryptographicOperations.ZeroMemory(clear);password.Clear();}
            state=new("ARMED");Save();RefreshStatus();
        } catch(InvalidOperationException e){MessageBox.Show(this,e.Message);}
        catch{MessageBox.Show(this,"Não foi possível salvar. Verifique se outro teste está aberto.");}
    }
    void Cancel(){if(busy)return;try{using var gate=Lock();state=Read();if(state.Status=="ARMED"){state=state with{Status="CANCELLED"};Save();}RefreshStatus();}catch{MessageBox.Show(this,"Não foi possível cancelar agora.");}}
    static string Folder()=>Path.Combine(Root,DateTimeOffset.Now.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N")[..8]);
    static async Task<string> Collect(string folder,CancellationToken ct){
        var reading=await LexmarkReport.Collect(folder,ct);
        await File.WriteAllTextAsync(Path.Combine(folder,"reading.json"),JsonSerializer.Serialize(new{reading,sourceField=LexmarkReport.Field,validation="LAB_CANDIDATE_NOT_HOMOLOGATED",infoSha256=Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(Path.Combine(folder,"deviceinfo.html"),ct))),statisticsSha256=Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(Path.Combine(folder,"devicestatistics.html"),ct))),clockSource="Windows",printerClockIncorrect=true}),ct);
        var pdf=Path.Combine(folder,"Uai-Suporte-Lexmark-LAB.pdf");await File.WriteAllBytesAsync(pdf,LexmarkReport.Pdf(reading),ct);return pdf;
    }
    async Task Preview(){
        if(busy)return;busy=true;SetBusy();
        try{using var gate=Lock();var folder=Folder();await Collect(folder,stop.Token);status.Text="Coleta validada e PDF gerado (sem envio): "+folder;}
        catch{status.Text="Falha de coleta/identificação. Nenhum e-mail foi enviado. Verifique acesso à impressora; dados incompletos não são enviados.";}
        finally{busy=false;SetBusy();}
    }
    async Task Tick(){
        if(busy)return;busy=true;SetBusy();
        try {
            using var gate=Lock();state=Read();
            if(state.Status=="ARMED" && DateTimeOffset.Now>PrinterSchedule.Expires){state=state with{Status="EXPIRED"};Save();}
            if(!PrinterSchedule.CanRun(state.Status,DateTimeOffset.Now,state.NextAttempt)){RefreshStatus();return;}
            var folder=Folder();state=state with{Status="COLLECTING",Attempts=state.Attempts+1,Folder=folder};Save();RefreshStatus();
            string pdf;
            try{pdf=await Collect(folder,stop.Token);}
            catch{state=state with{Status=state.Attempts<3?"ARMED":"COLLECTION_FAILED",NextAttempt=DateTimeOffset.Now.AddMinutes(1)};Save();RefreshStatus();return;}
            // After this durable fence, NEVER resend automatically: SMTP acceptance can be uncertain.
            state=state with{Status="SENDING",MessageId=Guid.NewGuid().ToString("N")+"@uaitelecom.com.br"};Save();RefreshStatus();
            try {
                byte[] clear=ProtectedData.Unprotect(File.ReadAllBytes(Path.Combine(Root,"smtp.dpapi")),null,DataProtectionScope.CurrentUser);
                try {
                    using var smtp=new SmtpClient("mx1.uaitelecom.com.br",587){EnableSsl=true,UseDefaultCredentials=false,Credentials=new NetworkCredential("uaisuporte@uaitelecom.com.br",Encoding.UTF8.GetString(clear)),Timeout=30000};
                    using var mail=new MailMessage("uaisuporte@uaitelecom.com.br","joaocaixeta@uaitelecom.com.br") {
                        Subject="[LAB automático] Relatório Lexmark - teste 26/11/2026 14h",
                        Body="Segue o PDF gerado com uma nova coleta automática pelo PC da loja. Fonte eletrônica em validação, não exportação nativa do Relatório de ativo. Sem impressão física e sem consumo mensal calculado. Confira no anexo a data real da coleta.",
                        SubjectEncoding=Encoding.UTF8,BodyEncoding=Encoding.UTF8};
                    mail.Headers.Add("Message-ID","<"+state.MessageId+">");mail.Attachments.Add(new Attachment(pdf,"application/pdf"));
                    using var deadline=CancellationTokenSource.CreateLinkedTokenSource(stop.Token);deadline.CancelAfter(TimeSpan.FromSeconds(45));
                    await smtp.SendMailAsync(mail,deadline.Token);
                } finally{CryptographicOperations.ZeroMemory(clear);}
                state=state with{Status="SENT"};Save();
            } catch {state=state with{Status="DELIVERY_UNCONFIRMED"};Save();}
            RefreshStatus();tray.ShowBalloonTip(5000,"Uai Suporte • teste de impressoras",status.Text,ToolTipIcon.Info);
        }catch(IOException){/* Another instance owns the lock, or state storage is unavailable. */}
        catch{status.Text="Erro de estado local. O teste não foi confirmado; revise a pasta dos resultados.";}
        finally{busy=false;SetBusy();}
    }
    void SetBusy(){arm.Enabled=cancel.Enabled=preview.Enabled=!busy;}
    void RefreshStatus(){status.Text=state.Status switch{
        "ARMED"=>"Agendado: 26/11/2026 14h Brasília. Tentativas de coleta: "+state.Attempts,
        "COLLECTING"=>"Coletando dados da impressora…",
        "SENDING"=>"Enviando PDF…",
        "SENT"=>"Servidor SMTP aceitou o PDF. Confira o recebimento; não haverá reenvio automático.",
        "DELIVERY_UNCONFIRMED"=>"Resultado do envio não confirmado. Confira a caixa de e-mail antes de qualquer reenvio manual.",
        "EXPIRED"=>"Teste expirado: não executado dentro da janela até 14h30.",
        "CANCELLED"=>"Agendamento cancelado.",
        "COLLECTION_FAILED"=>"Coleta falhou após três tentativas. Nenhum e-mail enviado.",
        "STATE_ERROR"=>"Estado local inválido ou ocupado. Não foi possível recuperar o agendamento.",
        _=>"Não agendado. Informe a senha e clique em Ativar teste."};}
}
