using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace UaiSuporte.Printers;

public sealed record PrinterReading(string Model, string Serial, string Ip, long MonoMediaTotal,
    long GeneralCount, DateTimeOffset StartedAt, DateTimeOffset FinishedAt);

// LAB adapter for the observed MX511de HTML. It does NOT claim to export Asset Report.
public static class LexmarkReport {
    public const string Serial = "701533HH09191";
    public const string Model = "Lexmark MX511de";
    public const string Ip = "192.168.30.200";
    public const string Field = "Lados monocromáticos impressos / Total";
    static readonly TimeSpan RegexLimit = TimeSpan.FromSeconds(2);
    sealed record Row(string Label, string Value, bool Heading);
    static string Clean(string html) => Regex.Replace(WebUtility.HtmlDecode(
        Regex.Replace(html, "<[^>]*>", " ", RegexOptions.Singleline, RegexLimit)), @"\s+", " ", RegexOptions.None, RegexLimit).Trim();
    static List<Row> Rows(string html) {
        if (html.Length > 5*1024*1024 || Regex.IsMatch(html, @"<input\b[^>]*type\s*=\s*['"" ]*password", RegexOptions.IgnoreCase, RegexLimit))
            throw new InvalidDataException("Resposta incompatível com relatório.");
        var rows = new List<Row>();
        foreach (Match tr in Regex.Matches(html, @"<tr\b[^>]*>(.*?)</tr>", RegexOptions.IgnoreCase|RegexOptions.Singleline, RegexLimit)) {
            var cells = Regex.Matches(tr.Groups[1].Value, @"<td\b[^>]*>(.*?)</td>", RegexOptions.IgnoreCase|RegexOptions.Singleline, RegexLimit);
            if (cells.Count == 2) rows.Add(new(Clean(cells[0].Groups[1].Value), Clean(cells[1].Groups[1].Value).TrimStart('=',' '),
                Regex.IsMatch(cells[0].Value, @"<b\b", RegexOptions.IgnoreCase, RegexLimit)));
        }
        return rows;
    }
    static string Unique(IEnumerable<Row> rows, string label) {
        var matches = rows.Where(x=>x.Label==label).ToArray();
        if(matches.Length!=1 || matches[0].Value.Length==0) throw new InvalidDataException("Campo ausente ou ambíguo: "+label);
        return matches[0].Value;
    }
    static List<Row> Section(List<Row> rows, string heading) {
        var indexes = rows.Select((r,i)=>(r,i)).Where(x=>x.r.Heading && x.r.Label==heading).Select(x=>x.i).ToArray();
        if(indexes.Length!=1) throw new InvalidDataException("Seção ausente ou ambígua: "+heading);
        return rows.Skip(indexes[0]+1).TakeWhile(x=>!x.Heading).ToList();
    }
    static long Count(string s) {
        if(!Regex.IsMatch(s, @"^(0|[1-9][0-9]{0,14})$", RegexOptions.None, RegexLimit) || !long.TryParse(s,out long n))
            throw new InvalidDataException("Contador não inteiro ou formato desconhecido.");
        return n;
    }
    public static long ValidateIdentity(string info) {
        var rows=Rows(info);
        if(!Clean(info).Contains(Model, StringComparison.Ordinal) || Unique(rows,"Número de série")!=Serial)
            throw new InvalidDataException("Identidade da impressora não corresponde ao teste.");
        return Count(Unique(rows,"Contagem pág."));
    }
    public static PrinterReading Parse(string info,string statistics,DateTimeOffset started,DateTimeOffset finished) {
        if(finished<started) throw new InvalidDataException("Horário de coleta inconsistente.");
        long general=ValidateIdentity(info);
        var rows=Rows(statistics);var identity=Section(rows,"Impressora");
        if(Unique(identity,"Número de série")!=Serial || Unique(identity,"Nome do modelo")!=Model)
            throw new InvalidDataException("Identidade divergente nas estatísticas.");
        var section=Section(rows,"Lados monocromáticos impressos");
        long total=Count(Unique(section,"Total"));
        var items=section.Where(x=>x.Label!="Total").ToArray();
        if(items.Length==0 || items.Aggregate(0L,(sum,x)=>checked(sum+Count(x.Value)))!=total)
            throw new InvalidDataException("Soma de lados por mídia diverge do total.");
        return new(Model,Serial,Ip,total,general,started,finished);
    }
    public static async Task<PrinterReading> Collect(string directory,CancellationToken token) {
        Directory.CreateDirectory(directory);
        using var handler=new HttpClientHandler{AllowAutoRedirect=false,UseProxy=false,UseDefaultCredentials=false};
        using var client=new HttpClient(handler){Timeout=TimeSpan.FromSeconds(30)};
        async Task<string> Read(string name) {
            using var deadline=CancellationTokenSource.CreateLinkedTokenSource(token);deadline.CancelAfter(TimeSpan.FromSeconds(30));
            using var response=await client.GetAsync($"http://{Ip}/cgi-bin/dynamic/printer/config/reports/{name}.html",HttpCompletionOption.ResponseHeadersRead,deadline.Token);
            if(response.StatusCode!=HttpStatusCode.OK || response.Content.Headers.ContentType?.MediaType is not ("text/html" or "application/xhtml+xml"))
                throw new InvalidDataException("A impressora não retornou o HTML esperado.");
            await using var stream=await response.Content.ReadAsStreamAsync(deadline.Token);using var memory=new MemoryStream();
            byte[] buffer=new byte[8192];int n;
            while((n=await stream.ReadAsync(buffer,deadline.Token))>0) {
                if(memory.Length+n>5*1024*1024)throw new InvalidDataException("Relatório excede limite.");
                memory.Write(buffer,0,n);
            }
            byte[] bytes=memory.ToArray();
            await File.WriteAllBytesAsync(Path.Combine(directory,name+".html"),bytes,deadline.Token);
            // The captured firmware declares ISO-8859-1. Reject new encodings instead of guessing.
            string html=Encoding.Latin1.GetString(bytes);
            if(!html.Contains("charset=ISO-8859-1",StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Codificação não validada.");
            return html;
        }
        var start=DateTimeOffset.Now;
        string info=await Read("deviceinfo");ValidateIdentity(info); // Before fetching counters from statistics.
        string statistics=await Read("devicestatistics");
        return Parse(info,statistics,start,DateTimeOffset.Now);
    }
    public static byte[] Pdf(PrinterReading reading) {
        // Fixed one-page PDF. Values are numeric/validated; no HTML/scripts or external resources.
        string[] lines={"UAI SUPORTE - RELATORIO DE TESTE", "Leitura eletronica de contador - Lexmark", "",
            "Modelo: "+reading.Model,"Serie: "+reading.Serial,
            "Inicio da coleta (Windows): "+reading.StartedAt.ToString("yyyy-MM-dd HH:mm:ss zzz"),
            "Fim da coleta (Windows): "+reading.FinishedAt.ToString("yyyy-MM-dd HH:mm:ss zzz"),"",
            "Campo efetivamente coletado:",Field,
            "Valor acumulado: "+reading.MonoMediaTotal.ToString("N0",CultureInfo.GetCultureInfo("pt-BR")),"",
            "Campo solicitado pela empresa: Contags de imp. mono",
            "Relatorio solicitado: Relatorio de ativo.",
            "Fonte desta leitura: HTML de Estatisticas do dispositivo.",
            "Este PDF foi gerado pelo Uai Suporte; nao e exportacao nativa.","",
            "Validacao: fonte candidata em teste, equivalencia ainda nao homologada.",
            "A foto recebida em 26/11/2026 mostrou 237.181 no campo solicitado.",
            "O valor acima e coletado agora; nao e copiado daquela foto.","",
            "Contador geral (separado): "+reading.GeneralCount.ToString("N0",CultureInfo.GetCultureInfo("pt-BR")),
            "Relogio interno informado como incorreto (2019).",
            "As datas acima usam o relogio Windows, nao o da impressora.","",
            "Leitura acumulada. Sem calculo de consumo mensal neste teste.",
            "Nenhuma pagina fisica foi solicitada pelo coletor.",
            "Nenhuma configuracao foi alterada ou contador zerado."};
        string Escape(string s)=>s.Replace("\\","\\\\").Replace("(","\\(").Replace(")","\\)");
        string commands="BT /F1 11 Tf 45 790 Td 19 TL\n"+string.Join("\n",lines.Select(x=>"("+Escape(x)+") Tj T*"))+"\nET";
        var enc=Encoding.Latin1;
        string[] objects={"<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            $"<< /Length {enc.GetByteCount(commands)} >>\nstream\n{commands}\nendstream"};
        using var output=new MemoryStream();void Write(string s)=>output.Write(enc.GetBytes(s));
        Write("%PDF-1.4\n");var offsets=new List<long>{0};
        for(int i=0;i<objects.Length;i++){offsets.Add(output.Position);Write($"{i+1} 0 obj\n{objects[i]}\nendobj\n");}
        long xref=output.Position;Write($"xref\n0 {objects.Length+1}\n0000000000 65535 f \n");
        foreach(long offset in offsets.Skip(1))Write(offset.ToString("D10",CultureInfo.InvariantCulture)+" 00000 n \n");
        Write($"trailer\n<< /Size {objects.Length+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");return output.ToArray();
    }
}
