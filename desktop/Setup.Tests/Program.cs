using System.IO.Compression;
using UaiSuporte.Setup;
int checks = 0;
void Reject(Action action) { try { action(); } catch (InvalidDataException) { checks++; return; } throw new Exception("Expected rejection"); }
var settings = "MeshServer=wss://mesh.internal:443/agent.ashx\nServerID=" + new string('a', 96) + "\nMeshID=group\nMeshName=Uai-Laboratorio\nMeshType=2\n";
Policy.CheckMeshSettings(settings); checks++;
Policy.CheckMeshSettings(settings.Replace(":443", "")); checks++;
Reject(() => Policy.CheckMeshSettings(settings + "MeshServer=wss://evil.invalid/agent.ashx\n"));
Reject(() => Policy.CheckMeshSettings(settings.Replace("wss://", "ws://")));
Reject(() => Policy.CheckMeshSettings(settings.Replace("mesh.internal", "mesh.internal.evil.invalid")));
Reject(() => Policy.CheckMeshSettings(settings.Replace(new string('a', 96), "abcd")));
Reject(() => Policy.CheckMeshSettings(settings + "proxy=evil.invalid\n"));
Reject(() => Policy.CheckMeshSettings(settings.Replace("MeshID=group\n", "")));
var root = Path.Combine(Path.GetTempPath(), "uai-setup-test-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(root);
MemoryStream Zip(string name)
{
    var stream = new MemoryStream();
    using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, true))
    using (var writer = new StreamWriter(archive.CreateEntry(name).Open())) writer.Write("fixture");
    stream.Position = 0; return stream;
}
try
{
    foreach (var name in new[] { "../outside", "..\\outside", "/absolute", "C:/absolute", "safe:stream", "bad./file" })
        Reject(() => { using var stream = Zip(name); Policy.Extract(stream, root); });
    using (var stream = Zip("licenses/LICENSE.txt")) Policy.Extract(stream, root);
    if (File.ReadAllText(Path.Combine(root, "licenses", "LICENSE.txt")) != "fixture") throw new Exception("Extract failed");
    checks++;
}
finally { Directory.Delete(root, true); }
var id = Guid.NewGuid().ToString("N");
var bytes = System.Text.Encoding.Latin1.GetBytes("# configuração preservada\r\n127.0.0.1 localhost\r\n10.0.0.1 intranet\n");
var change = LabPolicy.AddHosts(bytes, id);
if (!change.Result.Take(bytes.Length).SequenceEqual(bytes)) throw new Exception("Existing hosts modified"); checks++;
if (!LabPolicy.RemoveHosts(change.Result, change.Block).SequenceEqual(bytes)) throw new Exception("Removal changed preexisting bytes"); checks++;
var foreign = System.Text.Encoding.Latin1.GetBytes("10.1.1.1 other-app\r\n");
if (!LabPolicy.RemoveHosts(change.Result.Concat(foreign).ToArray(), change.Block).SequenceEqual(bytes.Concat(foreign))) throw new Exception("Foreign changes lost"); checks++;
var existing = System.Text.Encoding.ASCII.GetBytes("131.0.112.23 SUPORTE.INTERNAL mesh.internal\n");
if (LabPolicy.AddHosts(existing, id).Block != "") throw new Exception("Preexisting correct hosts rewritten"); checks++;
Reject(() => LabPolicy.AddHosts(System.Text.Encoding.ASCII.GetBytes("127.0.0.1 suporte.internal\n"), id));
Reject(() => LabPolicy.AddHosts(System.Text.Encoding.Unicode.GetBytes("hosts"), id));
Reject(() => LabPolicy.AddHosts(bytes, "invalid"));
Reject(() => LabPolicy.RemoveHosts(bytes, change.Block));
Reject(() => LabPolicy.RemoveHosts(change.Result.Concat(System.Text.Encoding.Latin1.GetBytes(change.Block)).ToArray(), change.Block));
Reject(() => LabPolicy.CheckCaBytes(new byte[] { 1, 2, 3 }));
if (args.Length > 0) { LabPolicy.CheckCaBytes(File.ReadAllBytes(args[0])); checks++; }
Policy.RequireCommitted("{\"Complete\":true,\"Removed\":false,\"RollbackPending\":false}"); checks++;
foreach(var invalid in new[]{"{}","[]","{\"Complete\":false}","{\"Complete\":true,\"Removed\":true}","{\"Complete\":true,\"RollbackPending\":true}","{\"Complete\":\"true\"}"})Reject(()=>Policy.RequireCommitted(invalid));
// Server messages and nested exception text must not leak enrollment credentials into diagnostics.
const string secret = "SENTINEL_ENROLLMENT_CREDENTIAL_DO_NOT_LOG";
foreach (var error in new Exception[] {
    new InvalidOperationException(secret, new HttpRequestException(secret, null, System.Net.HttpStatusCode.Forbidden)),
    new HttpRequestException(HttpRequestError.SecureConnectionError, secret),
    new InvalidDataException(secret), new UnauthorizedAccessException(secret),
    new System.ComponentModel.Win32Exception(1314, secret)
}) {
    if ((SetupAudit.ErrorCodes(error) + SetupAudit.Explain(error)).Contains(secret)) throw new Exception("Diagnostic secret leak");
    checks++;
}
if (!SetupAudit.ErrorCodes(new System.ComponentModel.Win32Exception(1314)).Contains("WIN32=1314")) throw new Exception("Missing native diagnostic"); checks++;
var authorization = new[]{"CA_ACCEPTED", "TERMS_ACCEPTED", "HOSTS_YES"};
if (!InnoRequest.Validate(authorization)) throw new Exception("Hosts authorization lost"); checks++;
var noHosts = (string[])authorization.Clone(); noHosts[2]="HOSTS_NO";
if (InnoRequest.Validate(noHosts)) throw new Exception("Hosts changed without consent"); checks++;
Reject(()=>InnoRequest.Validate(Array.Empty<string>()));
Reject(()=>InnoRequest.Validate(authorization.Concat(new[]{"extra"}).ToArray()));
foreach (var (index,value) in new[]{(0,""),(1,""),(2,"true"),(0,"CA_ACCEPTED\nTOKEN") }) {
    var malformed=(string[])authorization.Clone();malformed[index]=value;
    Reject(()=>InnoRequest.Validate(malformed));
}
Reject(()=>InnoRequest.Validate(new[]{new string('a',43),"CA_ACCEPTED","TERMS_ACCEPTED","HOSTS_YES"}));
Console.WriteLine($"PASS: {checks} setup policy checks. Windows UI/Authenticode/trust store/hosts writes/uninstall require Windows testing.");
