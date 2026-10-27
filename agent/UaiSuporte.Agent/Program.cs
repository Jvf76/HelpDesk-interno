using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Win32;
namespace UaiSuporte.Agent;

internal static class Program
{
    [STAThread] static void Main() { ApplicationConfiguration.Initialize(); using var mutex = new Mutex(true, "Local\\UaiSuporteAgent-" + Environment.UserName, out bool first); if (!first) { MessageBox.Show("O Uai Suporte já está aberto."); return; } Application.Run(new AgentWindow()); }
}
record Identity(string Server, string Token, string DeviceId);
record Enrollment(string DeviceId, string Token);
record Request(Guid Id, string Mode, string Status, DateTimeOffset Expires_At, string Technician);
record Heartbeat(List<Request> Requests);
sealed class AgentWindow : Form
{
    static readonly string Storage = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "UaiTelecom", "Suporte");
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };
    readonly HttpClient http = new(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(12) };
    readonly System.Windows.Forms.Timer timer = new() { Interval = 5000 };
    readonly Label status = new() { AutoSize = true, MaximumSize = new Size(580, 0), Text = "Vincule este computador ao suporte." };
    readonly TextBox server = new() { Width = 540, PlaceholderText = "https://suporte.interno" };
    readonly TextBox code = new() { Width = 540, PlaceholderText = "Código de vínculo fornecido pelo administrador", UseSystemPasswordChar = true };
    readonly Button enroll = new() { Text = "Vincular computador", AutoSize = true };
    readonly Button stop = new() { Text = "Encerrar solicitação remota", AutoSize = true, Enabled = false };
    readonly ListBox requests = new() { Width = 540, Height = 110 };
    readonly HashSet<Guid> prompted = [];
    Identity? identity; List<Request> current = []; bool polling, closing, locked;
    public AgentWindow()
    {
        Text = "Uai Suporte • Uai Telecom"; Size = new Size(620, 520); MinimumSize = new Size(620, 520); StartPosition = FormStartPosition.CenterScreen; BackColor = Color.White; Font = new Font("Segoe UI", 10);
        var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(24), AutoScroll = true };
        layout.Controls.Add(new Label { Text = "Uai Suporte", AutoSize = true, Font = new Font("Segoe UI", 22, FontStyle.Bold) });
        layout.Controls.Add(new Label { Text = "Agente identificado • acesso somente com sua autorização", AutoSize = true, Margin = new Padding(3, 3, 3, 16) });
        layout.Controls.Add(server); layout.Controls.Add(code); layout.Controls.Add(enroll); layout.Controls.Add(status); layout.Controls.Add(requests); layout.Controls.Add(stop);
        layout.Controls.Add(new Label { Text = "A tela remota é operada pelo MeshAgent, instalado separadamente.\nUse o X da barra de privacidade do MeshAgent para interromper\na transmissão imediatamente. Este aplicativo não captura sua tela.", AutoSize = true, Margin = new Padding(3, 18, 3, 3) }); Controls.Add(layout);
        try { var path = Path.Combine(Storage, "identity.bin"); if (File.Exists(path)) { identity = JsonSerializer.Deserialize<Identity>(ProtectedData.Unprotect(File.ReadAllBytes(path), null, DataProtectionScope.CurrentUser), Json); Configure(); } } catch { status.Text = "Não foi possível ler o vínculo protegido. Solicite novo cadastro ao administrador."; }
        enroll.Click += async (_, _) => await Enroll(); stop.Click += async (_, _) => await StopAll(); timer.Tick += async (_, _) => await Poll(); Shown += async (_, _) => await Poll();
        SystemEvents.SessionSwitch += SessionChanged; FormClosing += CloseAsync; timer.Start();
    }
    void Configure() { if (identity == null) return; http.BaseAddress = new Uri(identity.Server.TrimEnd('/') + "/"); http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", identity.Token); server.Visible = code.Visible = enroll.Visible = false; status.Text = "Vinculado. Aguardando contato com o servidor."; }
    async Task Enroll()
    {
        enroll.Enabled = false;
        try
        {
            if (!Uri.TryCreate(server.Text.Trim(), UriKind.Absolute, out var uri) || uri.Scheme != "https" || !string.IsNullOrEmpty(uri.UserInfo) || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query)) throw new InvalidOperationException("Informe somente a origem HTTPS do servidor, sem caminho, usuário ou parâmetros.");
            using var response = await http.PostAsJsonAsync(new Uri(uri, "api/agent/enroll"), new { code = code.Text.Trim(), os = Environment.OSVersion.VersionString }); if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Vínculo recusado. Confira código, validade e certificado.");
            var result = await response.Content.ReadFromJsonAsync<Enrollment>(Json) ?? throw new InvalidOperationException("Resposta inválida."); identity = new Identity(uri.ToString(), result.Token, result.DeviceId); Directory.CreateDirectory(Storage); File.WriteAllBytes(Path.Combine(Storage, "identity.bin"), ProtectedData.Protect(JsonSerializer.SerializeToUtf8Bytes(identity), null, DataProtectionScope.CurrentUser)); code.Clear(); Configure(); await Poll();
        }
        catch (Exception e) { MessageBox.Show(this, e is HttpRequestException ? "Servidor inacessível ou certificado não confiável. Não desative a validação TLS." : e.Message, "Falha no vínculo", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        finally { enroll.Enabled = true; }
    }
    async Task Poll()
    {
        if (identity == null || polling || closing || locked) return; polling = true;
        try
        {
            using var response = await http.PostAsJsonAsync("api/agent/heartbeat", new { os = Environment.OSVersion.VersionString });
            if (response.StatusCode == HttpStatusCode.Unauthorized) { status.Text = "Credencial revogada. O agente não está disponível para atendimento."; timer.Stop(); return; }
            response.EnsureSuccessStatusCode(); var beat = await response.Content.ReadFromJsonAsync<Heartbeat>(Json) ?? throw new InvalidOperationException(); current = beat.Requests;
            requests.Items.Clear(); foreach (var r in current) requests.Items.Add($"{r.Technician} • {(r.Mode == "VIEW" ? "Visualização" : "Controle")} • {r.Status}"); stop.Enabled = current.Count > 0;
            status.Text = current.Count == 0 ? "Online • nenhuma solicitação de atendimento." : "Solicitação de suporte em andamento. Confira a janela do MeshAgent.";
            foreach (var r in current.Where(x => x.Status == "PENDING" && x.Expires_At > DateTimeOffset.UtcNow))
            {
                if (!prompted.Add(r.Id)) continue;
                if (prompted.Count > 500) prompted.RemoveWhere(id => !current.Any(x => x.Id == id));
                Activate(); var result = MessageBox.Show(this, $"{r.Technician}, da equipe de suporte, solicita {(r.Mode == "VIEW" ? "visualizar sua tela" : "visualizar sua tela e controlar mouse e teclado")}.\n\nPermitir esta solicitação por até 60 segundos?\nO MeshAgent pedirá uma confirmação adicional antes da transmissão.", "Uai Telecom • Autorizar atendimento", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2);
                await Decide(r.Id, result == DialogResult.Yes && !locked ? "accept" : "reject");
            }
        }
        catch { status.Text = "Sem contato com o servidor. Não aceite novas conexões. Para parar a tela, use o X da barra do MeshAgent."; }
        finally { polling = false; }
    }
    async Task Decide(Guid id, string decision) { using var response = await http.PostAsJsonAsync($"api/agent/sessions/{id}/{decision}", new { }); if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Decisão recusada ou solicitação expirada."); }
    async Task StopAll() { stop.Enabled = false; status.Text = "Solicitando encerramento ao servidor…"; try { foreach (var r in current) await Decide(r.Id, "stop"); status.Text = "Encerramento solicitado. Use também o X da barra do MeshAgent; confirmação pendente do próximo contato."; } catch { status.Text = "Servidor indisponível. Encerre imediatamente pelo X da barra do MeshAgent."; } finally { stop.Enabled = current.Count > 0; } }
    void SessionChanged(object? sender, SessionSwitchEventArgs e) { if (IsDisposed) return; BeginInvoke((Action)(async () => { if (e.Reason == SessionSwitchReason.SessionLock) { locked = true; await StopAll(); } else if (e.Reason == SessionSwitchReason.SessionUnlock) { locked = false; await Poll(); } })); }
    async void CloseAsync(object? sender, FormClosingEventArgs e) { if (closing) return; e.Cancel = true; closing = true; timer.Stop(); await StopAll(); SystemEvents.SessionSwitch -= SessionChanged; http.Dispose(); timer.Dispose(); Close(); }
}
