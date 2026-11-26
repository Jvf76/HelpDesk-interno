using UaiSuporte.Printers;
using System.Text;
int checks=0;
void Assert(bool b,string name){if(!b)throw new Exception(name);checks++;}
void Reject(Action a,string name){try{a();}catch(InvalidDataException){checks++;return;}throw new Exception("Accepted invalid: "+name);}
string Row(string key,string value,bool heading=false)=>$"<TR><td><p>{(heading?"<b>":"")}{key}{(heading?"</b>":"")}</p></td><td><p>{value}</p></td></TR>";
string info="<center>Lexmark MX511de</center>"+Row("Número&nbsp;de&nbsp;série","= 701533HH09191")+Row("Contagem&nbsp;pág.","= 237328");
string stats=Row("Folhas impressas","",true)+Row("Total","177593")+
 Row("Lados monocromáticos impressos","",true)+Row("A4","100000")+Row("Carta","137181")+Row("Total","237181")+
 Row("Informação N-up","",true)+Row("Total","999999")+
 Row("Unid. imagem","",true)+Row("Número de série","OTHER_COMPONENT")+
 Row("Impressora","",true)+Row("Número de série","701533HH09191")+Row("Nome do modelo","Lexmark MX511de")+Row("Data da impressão","2019-05-11");
var now=new DateTimeOffset(2026,11,26,11,45,29,TimeSpan.FromHours(-3));
var reading=LexmarkReport.Parse(info,stats,now,now.AddSeconds(4));
Assert(reading.MonoMediaTotal==237181 && reading.GeneralCount==237328,"Separate indicators");
Reject(()=>LexmarkReport.Parse(info.Replace("701533HH09191","701533HH0917C"),stats,now,now),"Wrong identity");
Reject(()=>LexmarkReport.Parse(info,stats.Replace("701533HH09191","OTHER_COMPONENT"),now,now),"Component serial not printer");
Reject(()=>LexmarkReport.Parse(info,stats.Replace("Lados monocromáticos impressos","Outro campo"),now,now),"No fallback total");
Reject(()=>LexmarkReport.Parse(info,stats.Replace("137181","137180"),now,now),"Inconsistent media sum");
Reject(()=>LexmarkReport.Parse(info,stats.Replace("237181","237181.5"),now,now),"Fractional count");
Reject(()=>LexmarkReport.Parse(info,stats+Row("Lados monocromáticos impressos","",true)+Row("Total","237181"),now,now),"Duplicate section");
Reject(()=>LexmarkReport.Parse(info,stats.Replace(Row("Total","237181"),""),now,now),"Missing total");
Reject(()=>LexmarkReport.Parse(info,"<input type='password'>"+stats,now,now),"Login page");
Reject(()=>LexmarkReport.Parse(info,stats,now,now.AddSeconds(-1)),"Invalid time");
Assert(!PrinterSchedule.CanRun("ARMED",PrinterSchedule.Due.AddSeconds(-1),null),"Not early");
Assert(PrinterSchedule.CanRun("ARMED",PrinterSchedule.Due,null),"On time");
Assert(!PrinterSchedule.CanRun("ARMED",PrinterSchedule.Expires.AddSeconds(1),null),"Not next day");
Assert(!PrinterSchedule.CanRun("SENT",PrinterSchedule.Due,null),"No resend");
Assert(!PrinterSchedule.CanRun("DELIVERY_UNCONFIRMED",PrinterSchedule.Due,null),"Uncertain no resend");
Assert(!PrinterSchedule.CanRun("ARMED",PrinterSchedule.Due,PrinterSchedule.Due.AddMinutes(1)),"Retry delay");
Assert(PrinterSchedule.Recover("SENDING")=="DELIVERY_UNCONFIRMED","Crash during sending");
Assert(PrinterSchedule.Recover("COLLECTING")=="ARMED","Crash collecting safe retry");
Assert(PrinterSchedule.Due.UtcDateTime.Hour==17,"Brasilia 14h is UTC17");
if(args.Length==3){
 var actual=LexmarkReport.Parse(Encoding.Latin1.GetString(File.ReadAllBytes(args[0])),Encoding.Latin1.GetString(File.ReadAllBytes(args[1])),now,now.AddSeconds(4));
 Assert(actual.Serial==LexmarkReport.Serial && actual.MonoMediaTotal==237181 && actual.GeneralCount==237328,"Actual received HTML");
 File.WriteAllBytes(args[2],LexmarkReport.Pdf(actual));
}
Console.WriteLine($"PASS {checks} checks");
