namespace UaiSuporte.Agent;

// Separate native windows: border ignores input; the bar alone accepts clicks.
// Secure desktop, display changes and indicator failure terminate the session.
sealed class SessionIndicator : IDisposable {
 [System.Runtime.InteropServices.DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr window);
 [System.Runtime.InteropServices.DllImport("dwmapi.dll")]static extern int DwmGetWindowAttribute(IntPtr window,int attribute,out int value,int size);
 static bool Shown(Form w)=>!w.IsDisposed&&w.IsHandleCreated&&w.Visible&&w.WindowState!=FormWindowState.Minimized&&IsWindowVisible(w.Handle)&&DwmGetWindowAttribute(w.Handle,14,out int cloaked,4)==0&&cloaked==0;
 readonly List<Form> windows=[];
 readonly Rectangle[] displays=Screen.AllScreens.Select(s=>s.Bounds).ToArray();
 readonly System.Windows.Forms.Timer timer=new(){Interval=500};
 readonly DateTimeOffset began=DateTimeOffset.UtcNow;
 readonly Action failure;
 bool disposing;
 public SessionIndicator(string requester,string mode,Action stop) {
  failure=stop;
  try {
   foreach(var screen in Screen.AllScreens) {
    var border=new BorderWindow(screen.Bounds);
    var bar=new Form{FormBorderStyle=FormBorderStyle.None,ShowInTaskbar=false,TopMost=true,StartPosition=FormStartPosition.Manual,Bounds=new Rectangle(screen.Bounds.Left+Math.Max(4,(screen.Bounds.Width-600)/2),screen.Bounds.Top+4,Math.Min(600,screen.Bounds.Width-8),54),BackColor=Color.FromArgb(0,80,180)};
    var label=new Label{Dock=DockStyle.Fill,ForeColor=Color.White,TextAlign=ContentAlignment.MiddleLeft,Padding=new Padding(8),AutoEllipsis=true};
    var button=new Button{Text="Encerrar acesso",Dock=DockStyle.Right,Width=145};button.Click+=(_,_)=>stop();
    bar.Controls.Add(label);bar.Controls.Add(button);
    label.Tag=requester+" • "+(mode=="VIEW"?"Somente visualização":"Controle permitido");
    foreach(var form in new Form[]{border,bar}) {form.FormClosed+=(_,_)=>{if(!disposing)failure();};windows.Add(form);form.Show();}
   }
   timer.Tick+=(_,_)=>{
    if(!Healthy){failure();return;}
    foreach(var w in windows) {
     w.TopMost=true;
     foreach(Control c in w.Controls)if(c is Label label)label.Text=label.Tag+" • "+(DateTimeOffset.UtcNow-began).ToString(@"mm\:ss");
    }
   };
   timer.Start();
  } catch {Dispose();throw;}
 }
 public bool Healthy=>!disposing&&InteractiveDesktop.Available()&&windows.Count==displays.Length*2&&displays.SequenceEqual(Screen.AllScreens.Select(s=>s.Bounds))&&windows.All(Shown);
 public void Dispose(){if(disposing)return;disposing=true;timer.Dispose();foreach(var w in windows)w.Dispose();windows.Clear();}
 sealed class BorderWindow:Form {
  public BorderWindow(Rectangle bounds) {
   FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;StartPosition=FormStartPosition.Manual;Bounds=bounds;
   BackColor=Color.Magenta;TransparencyKey=Color.Magenta;
  }
  protected override bool ShowWithoutActivation=>true;
  protected override CreateParams CreateParams {get {var p=base.CreateParams;p.ExStyle|=0x20|0x08000000|0x80;return p;}}
  protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);using var pen=new Pen(Color.FromArgb(0,120,255),8);e.Graphics.DrawRectangle(pen,4,4,Width-8,Height-8);}
 }
}
