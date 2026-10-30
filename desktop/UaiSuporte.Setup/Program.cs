namespace UaiSuporte.Setup;

internal static class Program
{
    [STAThread] static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        try
        {
            using var mutex = new Mutex(true, @"Global\UaiSuporteSetupLAB", out bool first);
            if (!first) { Environment.ExitCode = 10; if (!InnoBridge.Handles(args)) MessageBox.Show("O assistente já está aberto."); return; }
            if (InnoBridge.Handles(args)) { Environment.ExitCode = InnoBridge.Run(args); return; }
            Application.Run(new SetupWindow(args.Contains("--uninstall")));
        }
        catch (Exception e) { Environment.ExitCode = 20; SetupAudit.Write("WIZARD_START_FAILED", e); if (InnoBridge.Handles(args)) return; MessageBox.Show("Não foi possível abrir o assistente. Solicite ajuda à TI.", "Uai Suporte"); }
    }
}
sealed class SetupWindow : Form
{
    enum Page { Welcome, Preparation, Ready, Working, Complete, Failure, Remove }
    readonly bool removing;
    Page page;
    bool busy;
    string errorDetails = "";
    string failureSummary = "";
    readonly FlowLayoutPanel content = new() { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, Padding = new(28, 24, 28, 20) };
    readonly Button next = new() { Text = "Avançar >", Width = 124, Height = 34 };
    readonly Button back = new() { Text = "< Voltar", Width = 104, Height = 34 };
    readonly Button cancel = new() { Text = "Cancelar", Width = 104, Height = 34 };
    readonly CheckBox approve = new() { Text = "Autorizo confiar na CA do laboratório neste computador.", AutoSize = true };
    readonly CheckBox hosts = new() { Text = "Configurar os nomes dos servidores neste computador.", Checked = true, AutoSize = true };
    readonly CheckBox terms = new() { Text = "Li e aceito os termos do Microsoft WebView2.", AutoSize = true };
    readonly CheckBox launch = new() { Text = "Iniciar o Uai Suporte", Checked = true, AutoSize = true };
    readonly CheckBox removeCa = new() { Text = "TI: confirmei que nenhum outro componente depende da CA.\nRemover somente o certificado adicionado por esta instalação.", AutoSize = true };
    readonly Label status = new() { AutoSize = true, MaximumSize = new(490, 0) };
    readonly ProgressBar progress = new() { Width = 480, Height = 20, Style = ProgressBarStyle.Marquee, MarqueeAnimationSpeed = 30 };

    public SetupWindow(bool removing)
    {
        this.removing = removing;
        Text = "Uai Suporte"; Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        ClientSize = new(800, 590); FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.Dpi; Font = new("Segoe UI", 10); BackColor = Color.White;
        var root = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 2, Margin = Padding.Empty };
        root.ColumnStyles.Add(new(SizeType.Absolute, 210)); root.ColumnStyles.Add(new(SizeType.Percent, 100));
        root.RowStyles.Add(new(SizeType.Percent, 100)); root.RowStyles.Add(new(SizeType.Absolute, 66));
        var brand = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(17, 35, 53), Margin = Padding.Empty };
        brand.Controls.Add(new Label { Text = "uai•", ForeColor = Color.FromArgb(255, 172, 124), Font = new("Segoe UI", 42, FontStyle.Bold), AutoSize = true, Location = new(24, 40) });
        brand.Controls.Add(new Label { Text = "Suporte", ForeColor = Color.White, Font = new("Segoe UI", 22), AutoSize = true, Location = new(28, 120) });
        brand.Controls.Add(new Label { Text = "Acesso remoto\ncom sua autorização.", ForeColor = Color.FromArgb(182, 202, 220), AutoSize = true, Location = new(28, 190) });
        brand.Controls.Add(new Label { Text = "LAB 0.6.1 • uso autorizado\nInstalador não assinado", ForeColor = Color.FromArgb(182, 202, 220), Dock = DockStyle.Bottom, Height = 70, Padding = new(24, 12, 0, 0) });
        root.Controls.Add(brand, 0, 0); root.Controls.Add(content, 1, 0);
        var footer = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft, Padding = new(14), BackColor = Color.FromArgb(245, 246, 248), Margin = Padding.Empty };
        footer.Controls.Add(cancel); footer.Controls.Add(next); footer.Controls.Add(back);
        root.Controls.Add(footer, 0, 1); root.SetColumnSpan(footer, 2); Controls.Add(root);
        next.Click += async (_, _) => await Next();
        back.Click += (_, _) => Show(page == Page.Ready ? Page.Preparation : Page.Welcome);
        cancel.Click += (_, _) => Close();
        AcceptButton = next; CancelButton = cancel;
        FormClosing += (_, e) => { if (busy) e.Cancel = true;  };
        Show(removing ? Page.Remove : Page.Welcome);
    }
    void Add(Control control)
    {
        control.MaximumSize = new(490, 0); control.Margin = new(0, 0, 0, 14); content.Controls.Add(control);
    }
    void TextLine(string text, bool title = false) => Add(new Label { Text = text, AutoSize = true, Font = new("Segoe UI", title ? 18 : 10, title ? FontStyle.Bold : FontStyle.Regular) });
    void Link(string text, Action action)
    {
        var link = new LinkLabel { Text = text, AutoSize = true }; link.LinkClicked += (_, _) => action(); Add(link);
    }
    string CertificateDetails => "Certificado: " + LabPolicy.CaName + "\nSHA-256: " + LabPolicy.CaHash + "\nValidade: 27/10/2026 a 27/10/2027.\nSomente esta CA será adicionada às Raízes Confiáveis do computador, se ausente. Nenhuma chave privada é incluída.\n\nNomes: suporte.internal e mesh.internal → " + LabPolicy.Ip + " (HTTPS, porta 443). Entradas existentes serão preservadas; conflitos bloqueiam alterações.";
    void Details(string title, string text)
    {
        using var dialog = new Form { Text = title, Size = new(720, 520), StartPosition = FormStartPosition.CenterParent, Padding = new(20), Font = Font };
        dialog.Controls.Add(new TextBox { Multiline = true, ReadOnly = true, Dock = DockStyle.Fill, ScrollBars = ScrollBars.Vertical, Text = text.Replace("\n", Environment.NewLine) });
        dialog.ShowDialog(this);
    }
    void Show(Page value)
    {
        page = value; content.SuspendLayout();
        // Detach reusable controls before disposing the labels/links from the previous page.
        foreach (var control in new Control[] { approve, hosts, terms, launch, removeCa, status, progress }) content.Controls.Remove(control);
        foreach (var control in content.Controls.Cast<Control>().ToArray()) control.Dispose();
        status.Text = "";
        back.Visible = value is Page.Preparation or Page.Ready;
        back.Enabled = !busy; next.Enabled = !busy; cancel.Enabled = !busy;
        cancel.Visible = value != Page.Complete;
        next.Text = value switch { Page.Ready => "Instalar", Page.Complete => "Concluir", Page.Failure => "Tentar novamente", Page.Remove => "Desinstalar", _ => "Avançar >" };
        if (value == Page.Welcome)
        {
            TextLine("Bem-vindo ao Assistente de Instalação do Uai Suporte", true);
            TextLine("O assistente instalará o Uai Suporte neste computador.");
            TextLine("Você poderá compartilhar seu código ou solicitar conexão com outro computador. O acesso depende da autorização de quem recebe a solicitação.");
            TextLine("Depois da instalação, abra o aplicativo e use o token de ativação fornecido pela administração.");
        }
        else if (value == Page.Preparation)
        {
            TextLine("Preparar este computador", true);
            TextLine("O computador será cadastrado automaticamente após você entrar no aplicativo.");
            TextLine("Este laboratório requer um certificado de confiança e os nomes dos servidores.");
            Link("Conferir certificado e configuração do laboratório", () => { Details("Configuração do laboratório", CertificateDetails); approve.Enabled = true; });
            // Explicit review of the exact CA identity remains required before machine-wide trust changes.
            approve.Enabled = approve.Checked;
            Add(approve); Add(hosts);
            Link("Ler termos do Microsoft WebView2", () => Details("Termos Microsoft WebView2", Installation.License));
            Add(terms); Add(status);
        }
        else if (value == Page.Ready)
        {
            TextLine("Pronto para instalar o Uai Suporte", true);
            TextLine("Serão instalados o aplicativo e os componentes necessários para o atendimento remoto.");
            TextLine("O computador será cadastrado com uma identidade própria. O aplicativo iniciará com o Windows; nenhuma conexão será aceita sem consentimento.");
            TextLine("Clique em Instalar para continuar ou em Voltar para revisar a autorização.");
            Link("Ver componentes e configurações", () => Details("Detalhes da instalação", "Aplicativo com interface local, .NET, WebView2 privado, componente assinado de acesso remoto, atalhos e desinstalador.\n\nDestino: " + Installation.Root + "\n\n" + CertificateDetails));
        }
        else if (value == Page.Working)
        {
            TextLine(removing ? "Desinstalando o Uai Suporte" : "Instalando o Uai Suporte", true);
            TextLine("Aguarde enquanto o assistente conclui as alterações. Não desligue o computador.");
            Add(progress); Add(status); status.Text = "Preparando arquivos…";
        }
        else if (value == Page.Complete)
        {
            TextLine(removing ? "Desinstalação concluída" : "Concluindo o Assistente de Instalação do Uai Suporte", true);
            TextLine(removing ? "O Uai Suporte foi removido. Reinicie o computador para concluir a exclusão dos arquivos do desinstalador." : "O Uai Suporte foi instalado com sucesso neste computador.");
            if (!removing) Add(launch);
            Add(status);
        }
        else if (value == Page.Remove)
        {
            TextLine("Desinstalar o Uai Suporte", true);
            TextLine("Feche o aplicativo. A credencial será revogada e os componentes desta instalação serão removidos. É necessário acesso ao servidor e a mesma conta Windows.");
            TextLine("O histórico no servidor e os certificados preexistentes serão preservados.");
            Link("Conferir certificado", () => Details("Certificado do laboratório", CertificateDetails));
            Add(removeCa);
        }
        else
        {
            TextLine(removing ? "Não foi possível concluir a desinstalação" : "Não foi possível concluir a instalação do Uai Suporte", true);
            TextLine(failureSummary);
            TextLine("Confira os detalhes antes de tentar novamente. Não reinstale sobre um cadastro existente.");
            Link("Ver detalhes", () => Details("Diagnóstico", errorDetails + "\n\nLog do assistente: " + SetupAudit.Path + "\nLog da instalação: " + Installation.Root + "\\setup-audit.log"));
        }
        content.ResumeLayout(true);
    }
    async Task Next()
    {
        if (busy) return;
        if (page == Page.Welcome) Show(Page.Preparation);
        else if (page == Page.Preparation)
        {
            if (!approve.Checked || !terms.Checked) { status.Text = "Confira o certificado e aceite as autorizações para continuar."; return; }
            Show(Page.Ready);
        }
        else if (page is Page.Ready or Page.Remove) await Execute();
        else if (page == Page.Failure) Show(removing ? Page.Remove : Page.Preparation);
        else if (page == Page.Complete)
        {
            if (!removing && launch.Checked)
            {
                try { NormalUserLaunch.Start(); SetupAudit.Write("APPLICATION_LAUNCH_OK"); }
                catch (Exception e) { SetupAudit.Write("APPLICATION_LAUNCH_FAILED", e); status.Text = "O aplicativo foi instalado, mas não pôde ser aberto. Abra Uai Suporte pelo menu Iniciar."; launch.Checked = false; return; }
            }
            Close();
        }
    }
    void Report(string message)
    {
        // Engine callbacks contain no secret values. Only a fixed public vocabulary is rendered.
        string text = message.StartsWith("Revertendo") ? "Desfazendo as alterações…" : message.StartsWith("Cadastrando") ? "Registrando dispositivo…" : message.StartsWith("Confirmando") ? "Confirmando o vínculo seguro…" : message.StartsWith("Cadastro e") ? "Finalizando instalação…" : message.StartsWith("Conferindo") ? "Configurando componentes…" : "Instalando Uai Suporte…";
        SetupAudit.Write("PROGRESS_" + (message.StartsWith("Revertendo") ? "ROLLBACK" : message.StartsWith("Cadastrando") ? "ENROLLMENT" : message.StartsWith("Confirmando") ? "MESH_BINDING" : message.StartsWith("Cadastro e") ? "BINDING_OK" : message.StartsWith("Conferindo") ? "RUNTIME" : "FILES"));
        if (!IsDisposed) BeginInvoke((Action)(() => { if (page == Page.Working) status.Text = text; }));
    }
    static Task Worker(Action work)
    {
        var done = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() => { try { work(); done.SetResult(); } catch (Exception e) { done.SetException(e); } });
        thread.SetApartmentState(ApartmentState.STA); thread.Start(); return done.Task;
    }
    async Task Execute()
    {
        bool editHosts = hosts.Checked, deleteCa = removeCa.Checked;
        busy = true; Show(Page.Working);
        SetupAudit.Write(removing ? "UNINSTALL_START" : "INSTALL_START_VERSION_0.6.1_WIZARD");
        try
        {
            await Worker(() => { if (removing) Installation.Remove(deleteCa); else Installation.Install(editHosts, Report); });
            SetupAudit.Write(removing ? "UNINSTALL_OK" : "INSTALL_OK");
            busy = false; Show(Page.Complete);
        }
        catch (Exception e)
        {
            SetupAudit.Write(removing ? "UNINSTALL_FAILED" : "INSTALL_FAILED", e);
            // Never render arbitrary exception messages (which could contain server response data).
            errorDetails = $"Operação: {(removing ? "remoção" : "instalação")}\nCategoria: {e.GetType().Name}\nCódigo: 0x{e.HResult:X8}\n" + SetupAudit.Explain(e);
            failureSummary = "Não foi possível confirmar uma instalação completa. Consulte os detalhes e peça ajuda à TI antes de continuar.";
            try
            {
                if (File.Exists(Installation.StateFile))
                {
                    var state = System.Text.Json.JsonSerializer.Deserialize<InstallState>(File.ReadAllText(Installation.StateFile));
                    failureSummary = state?.RollbackPending == true
                        ? "A limpeza ainda está pendente. Reconecte ao servidor e use o desinstalador para concluir a reversão. O aplicativo permanece bloqueado."
                        : state?.Removed == true
                            ? "As alterações foram revertidas. Reinicie para concluir a exclusão dos arquivos do instalador antes de tentar novamente."
                            : "Existe um registro de instalação neste computador. Consulte a TI antes de tentar novamente; nenhum cadastro será sobrescrito.";
                }
            }
            catch { /* An unreadable journal cannot prove successful cleanup. */ }
            errorDetails += "\n\n" + failureSummary;
            busy = false; Show(Page.Failure);
        }
        finally { }
    }
}
