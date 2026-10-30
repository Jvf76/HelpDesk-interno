namespace UaiSuporte.Agent;

// Separate native windows: border ignores input; the bar alone accepts clicks.
// Secure desktop, display changes and indicator failure terminate the session.
sealed class SessionIndicator : IDisposable {
 readonly List<Form> windows=[];
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
    if(windows.Count!=Screen.AllScreens.Length*2||windows.Any(w=>w.IsDisposed||!w.Visible||w.WindowState==FormWindowState.Minimized)){failure();return;}
    foreach(var w in windows) {
     w.TopMost=true;
     foreach(Control c in w.Controls)if(c is Label label)label.Text=label.Tag+" • "+(DateTimeOffset.UtcNow-began).ToString(@"mm\:ss");
    }
   };
   timer.Start();
  } catch {Dispose();throw;}
 }
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
