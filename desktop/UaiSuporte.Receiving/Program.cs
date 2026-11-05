using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Win32;
namespace UaiSuporte.Agent;
record Setup(string Server,string MeshExe,string MeshSha256,string? EnrollmentCode);
record Identity(string Server,string Token,string DeviceId,string? Code=null);
record Enrollment(string DeviceId,string Token);
record PendingEnrollment(string CodeHash,string Credential);
record Request(Guid Id,string Mode,string Status,DateTimeOffset Expires_At,string Technician,string? Native_Diagnostic=null);
record Heartbeat(List<Request> Requests);
public sealed class ReceiverWindow:Form {
 readonly Label status=new(){AutoSize=true,MaximumSize=new(570,0),Text="Conectando ao serviço…"};
 readonly Button stop=new(){Text="ENCERRAR ACESSO",AutoSize=true};
 readonly System.Windows.Forms.Timer timer=new(){Interval=1000};
 readonly System.Windows.Forms.Timer leaseTimer=new(){Interval=1000};bool leasing;
 SessionIndicator? indicator;Guid? displayed;readonly HashSet<Guid> prompted=[];
 readonly HashSet<string> nativeSeen=[];
 bool polling,closing,locked,faultShown,stopping;long stopNoticeUntil;string stopNotice="";public bool Registered{get;private set;}
 public event Action? AttentionRequested;
 public string? DeviceCode{get;private set;}
 public bool SessionActive{get;private set;}
 public string ConnectionState=>status.Text;
 public bool NeedsRegistration=>!Registered;
 public string ActivationError{get;private set;}="";
 internal static T? Read<T>(string file)=>DeviceStore.Read<T>(file);
 internal static void Save<T>(string file,T value)=>DeviceStore.Save(file,value);
 public ReceiverWindow(){
  var layout=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,Padding=new(24)};
  layout.Controls.Add(status);layout.Controls.Add(stop);Controls.Add(layout);
  stop.Click+=async(_,_)=>await StopLocal();timer.Tick+=async(_,_)=>await Poll();
  leaseTimer.Tick+=async(_,_)=>{if(leasing||closing)return;leasing=true;try{await LocalChannel.Send(new("pulse",RequestId:displayed,Indicator:indicator?.Healthy==true,Unlocked:!locked&&InteractiveDesktop.Available()));}catch{displayed=null;}finally{leasing=false;}};
  leaseTimer.Start();SystemEvents.SessionSwitch+=SessionChanged;
 }
 public async Task Initialize(){await Poll();timer.Start();}
 public void PreparationStatus(string message)=>status.Text=message;
 async Task Pulse(){
  var result=await LocalChannel.Send(new("status"));
  if(result.Status!=200)throw new IOException();
  using var doc=JsonDocument.Parse(result.Body);var d=doc.RootElement;
  ActivationError=d.GetProperty("error").GetString()??"";
  if(d.GetProperty("blocked").GetBoolean()&&!faultShown){faultShown=true;AttentionRequested?.Invoke();}else if(!d.GetProperty("blocked").GetBoolean())faultShown=false;
  Registered=d.GetProperty("registered").GetBoolean();DeviceCode=d.GetProperty("code").GetString();status.Text=Environment.TickCount64<stopNoticeUntil?stopNotice:d.GetProperty("state").GetString()??"Offline";
  var active=d.GetProperty("active");SessionActive=active.ValueKind!=JsonValueKind.Null;
  var requests=d.GetProperty("requests").Deserialize<Request[]>(ServiceProtocol.Json)??[];
  if(!SessionActive&&indicator!=null&&!displayed.HasValue&&!stopping){indicator.Dispose();indicator=null;}
  if(!SessionActive&&displayed.HasValue&&!requests.Any(r=>r.Id==displayed.Value)){indicator?.Dispose();indicator=null;displayed=null;}
  foreach(var r in requests.Where(r=>r.Id==displayed)){
   var native=NativeConsentDiagnostic.Parse(r.Native_Diagnostic);
   if(native is {HelperPid:>0}&&NativeConsentWindow.Visible(native.HelperPid)&&nativeSeen.Add(r.Id+":"+native.HelperPid)){
    await LocalChannel.Send(new("native-dialog",RequestId:r.Id,DialogPid:native.HelperPid));
   }
  }
  foreach(var r in requests.Where(r=>r.Status=="PENDING"&&r.Expires_At>DateTimeOffset.UtcNow)){
   if(stopping||!prompted.Add(r.Id)||locked)continue;
   AttentionRequested?.Invoke();using var dialog=new ConsentDialog(r);dialog.ShowDialog(this);
   string decision=locked||!InteractiveDesktop.Available()?"reject":dialog.Decision;
   if(decision!="reject"){
    indicator?.Dispose();indicator=new SessionIndicator(r.Technician,decision=="accept-view"?"VIEW":r.Mode,()=>{if(!IsDisposed)BeginInvoke((Action)(async()=>await StopLocal()));});displayed=r.Id;
    var ack=await LocalChannel.Send(new("pulse",RequestId:displayed,Indicator:indicator.Healthy,Unlocked:!locked&&InteractiveDesktop.Available()));if(ack.Status!=200)throw new IOException();
   }
   var answer=await LocalChannel.Send(new("consent",RequestId:r.Id,Decision:decision));
   if(answer.Status!=200){await StopLocal();throw new IOException();}
  }
 }
 async Task Poll(){if(polling||closing)return;polling=true;try{await Pulse();}catch{status.Text="Serviço indisponível • acesso remoto bloqueado";if(indicator!=null){displayed=null;try{var stopped=await LocalChannel.Send(new("stop"));if(stopped.Status==200){indicator.Dispose();indicator=null;}}catch{/* Keep the warning visible until a local stop is confirmed. */}}}finally{polling=false;}}
 public async Task StopLocal(){
  if(stopping)return;stopping=true;stop.Enabled=false;
  // Withdraw the presentation acknowledgment immediately, before waiting on IPC.
  displayed=null;stopNotice="Encerrando acesso…";stopNoticeUntil=Environment.TickCount64+8000;status.Text=stopNotice;
  try{var response=await LocalChannel.Send(new("stop"));if(response.Status!=200)throw new IOException();indicator?.Dispose();indicator=null;SessionActive=false;stopNotice="Acesso interrompido neste computador. Monitoramento mantido.";}
  catch{stopNotice="Não foi possível confirmar a parada. A confirmação do indicador foi retirada. Solicite verificação à TI.";}
  finally{stopNoticeUntil=Environment.TickCount64+10000;status.Text=stopNotice;stopping=false;stop.Enabled=true;}
 }
 public async Task Shutdown(){if(closing)return;closing=true;timer.Stop();leaseTimer.Stop();leaseTimer.Dispose();await StopLocal();indicator?.Dispose();SystemEvents.SessionSwitch-=SessionChanged;timer.Dispose();}
 void SessionChanged(object? sender,SessionSwitchEventArgs e){if(IsDisposed)return;BeginInvoke((Action)(async()=>{if(e.Reason==SessionSwitchReason.SessionLock){locked=true;await StopLocal();}else if(e.Reason==SessionSwitchReason.SessionUnlock)locked=false;}));}
}
sealed class ConsentDialog:Form {
 public string Decision{get;private set;}="reject";
 public ConsentDialog(Request r){Text="Uai Telecom • consentimento local";Size=new(550,280);StartPosition=FormStartPosition.CenterParent;TopMost=true;ControlBox=true;
 var panel=new FlowLayoutPanel{Dock=DockStyle.Fill,Padding=new(20),FlowDirection=FlowDirection.TopDown};
 panel.Controls.Add(new Label{Text=$"{r.Technician} solicita {(r.Mode=="VIEW"?"visualizar sua tela":"visualização e controle")}.\nOrigem: painel web autenticado.\nLaboratório: 60 segundos a partir da imagem ativa.\nApós esta escolha, confirme também a janela de autorização do motor. Sem essa confirmação nenhuma imagem será transmitida.",AutoSize=true,MaximumSize=new(480,0)});
 void Add(string text,string value){var button=new Button{Text=text,AutoSize=true};button.Click+=(_,_)=>{Decision=value;Close();};panel.Controls.Add(button);}
 Add("Recusar","reject");Add("Permitir somente visualização","accept-view");if(r.Mode=="CONTROL")Add("Permitir visualização e controle","accept");Controls.Add(panel);
 }
}
