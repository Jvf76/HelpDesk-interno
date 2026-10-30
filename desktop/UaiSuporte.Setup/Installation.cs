using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Microsoft.Win32;
using UaiSuporte.Agent;
namespace UaiSuporte.Setup;

internal sealed class InstallState
{
    public string Product { get; set; } = "UaiSuporte-LAB-0.5.0";
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public bool CaOwned { get; set; }
    public string HostsBlock { get; set; } = "";
    public bool Complete { get; set; }
    public bool Removed { get; set; }
    public string OwnerSid { get; set; } = "";
    public bool OwnsDeviceData { get; set; }
    public bool RollbackPending { get; set; }
    public bool StartupOwned { get; set; }
}
internal static class Installation
{
    public static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "UaiTelecom", "UaiSuporte");
    public static readonly string App = Path.Combine(Root, "Application");
    public static readonly string StateFile = Path.Combine(Root, "install-state.json");
    static readonly string Hosts = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "drivers", "etc", "hosts");
    static readonly string Installer = Path.Combine(Root, "Installer", "UaiSuporte-Setup.exe");
    static readonly string Menu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms), "Uai Suporte");
    const string UninstallKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\UaiSuporteUnified";
    public static string Executable => Path.Combine(App, "UaiSuporte.exe");
    public static byte[] Resource(string name) { using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name) ?? throw new InvalidDataException("Recurso ausente: " + name); using var memory = new MemoryStream(); stream.CopyTo(memory); return memory.ToArray(); }
    public static string License => System.Text.Encoding.UTF8.GetString(Resource("webview2-license.txt"));
    static void Log(string code) { SetupAudit.Write(code); File.AppendAllText(Path.Combine(Root, "setup-audit.log"), $"{DateTimeOffset.UtcNow:O} {code}\r\n"); }
    static void Save(InstallState state) { var temp = StateFile + ".tmp"; File.WriteAllText(temp, JsonSerializer.Serialize(state)); File.Move(temp, StateFile, true); }
    static void SafePath(string path)
    {
        for (var directory = new DirectoryInfo(path); directory != null; directory = directory.Parent)
            if (directory.Exists && (directory.Attributes & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("Destino redirecionado. Instalação suspensa para revisão da TI.");
    }
    static void CheckStopped()
    {
        foreach (var name in new[] { "UaiSuporte", "UaiSuporte.Technician", "UaiSuporte.Client" })
        {
            var running = Process.GetProcessesByName(name); bool found = running.Length > 0;
            foreach (var p in running) p.Dispose();
            if (found) throw new InvalidOperationException("Feche os aplicativos Uai Suporte de todas as sessões Windows antes de continuar.");
        }
    }
    static X509Certificate2 Certificate()
    {
        var bytes = Resource("lab-ca.cer"); LabPolicy.CheckCaBytes(bytes);
        var cert = X509CertificateLoader.LoadCertificate(bytes);
        if (cert.GetNameInfo(X509NameType.SimpleName, false) != LabPolicy.CaName || cert.HasPrivateKey || !cert.Extensions.OfType<X509BasicConstraintsExtension>().Any(x => x.CertificateAuthority))
            throw new InvalidDataException("Identificação da CA inválida.");
        return cert;
    }
    public static bool MachineRuntimePresent()
    {
        using var hklm = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry32);
        using var key = hklm.OpenSubKey(@"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}");
        return Version.TryParse(key?.GetValue("pv") as string, out var version) && version > new Version(0, 0, 0, 0);
    }
    static void WebView(Action<string> report)
    {
        report("Conferindo WebView2 Microsoft privado e permissões do sandbox…");
        var runtime=Path.Combine(App,"Runtime");
        var files=JsonSerializer.Deserialize<Dictionary<string,string>>(File.ReadAllText(Path.Combine(App,"runtime-files.json")))??throw new InvalidDataException("Manifesto de runtime ausente.");
        var prefix=Path.GetFullPath(runtime)+Path.DirectorySeparatorChar;
        foreach(var entry in files){
            var file=Path.GetFullPath(Path.Combine(runtime,entry.Key));
            if(!file.StartsWith(prefix,StringComparison.OrdinalIgnoreCase)||!Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file))).Equals(entry.Value,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Runtime incorporado com integridade inválida.");
        }
        Authenticode.RequireValid(Path.Combine(runtime,"msedgewebview2.exe"),"WebView2 Microsoft");
        // Microsoft requires these read/execute grants for the Fixed Runtime sandbox on Windows 10.
        var directory=new DirectoryInfo(runtime);var acl=System.IO.FileSystemAclExtensions.GetAccessControl(directory);
        foreach(var sid in new[]{"S-1-15-2-1","S-1-15-2-2"})
            acl.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(new System.Security.Principal.SecurityIdentifier(sid),System.Security.AccessControl.FileSystemRights.ReadAndExecute,System.Security.AccessControl.InheritanceFlags.ContainerInherit|System.Security.AccessControl.InheritanceFlags.ObjectInherit,System.Security.AccessControl.PropagationFlags.None,System.Security.AccessControl.AccessControlType.Allow));
        System.IO.FileSystemAclExtensions.SetAccessControl(directory,acl);
        Log("WEBVIEW_FIXED_VERIFIED_PRIVATE_SANDBOX_PERMISSIONS");
    }
    static void Shortcut(string path, string exe, string arguments = "")
    {
        var type = Type.GetTypeFromProgID("WScript.Shell") ?? throw new InvalidOperationException("Atalhos indisponíveis.");
        dynamic shell = Activator.CreateInstance(type)!; object? instance = null;
        try { dynamic link = shell.CreateShortcut(path); instance = link; link.TargetPath = exe; link.Arguments = arguments; link.WorkingDirectory = Path.GetDirectoryName(exe); link.Description = "Uai Suporte"; link.Save(); }
        finally { if (instance != null) Marshal.FinalReleaseComObject(instance); Marshal.FinalReleaseComObject(shell); }
    }
    static void RegisterUninstaller()
    {
        using var machine = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
        using var key = machine.CreateSubKey(UninstallKey);
        key.SetValue("DisplayName", "Uai Suporte"); key.SetValue("DisplayVersion", "0.6.1");
        key.SetValue("Publisher", "Uai Telecom - LAB não assinado"); key.SetValue("InstallLocation", Root);
        key.SetValue("UninstallString", "\"" + Installer + "\" --uninstall"); key.SetValue("DisplayIcon", Installer);
        key.SetValue("NoModify", 1, RegistryValueKind.DWord); key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
    }
    static void RemoveOwnedUserStartup()
    {
        using var machine=RegistryKey.OpenBaseKey(RegistryHive.LocalMachine,RegistryView.Registry64);
        using var profiles=machine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList");
        if(profiles==null)return;
        foreach(var sid in profiles.GetSubKeyNames()) {
            using var profile=profiles.OpenSubKey(sid);
            if(profile?.GetValue("ProfileImagePath") is not string folder)continue;
            var linkPath=Path.Combine(Environment.ExpandEnvironmentVariables(folder),"AppData","Roaming","Microsoft","Windows","Start Menu","Programs","Startup","Uai Suporte.lnk");
            if(!File.Exists(linkPath))continue;
            SafePath(Path.GetDirectoryName(linkPath)!);
            var type=Type.GetTypeFromProgID("WScript.Shell") ?? throw new InvalidOperationException("Não foi possível conferir os atalhos de inicialização.");
            dynamic shell=Activator.CreateInstance(type)!;object? instance=null;
            try {
                dynamic link=shell.CreateShortcut(linkPath);instance=link;
                string target=link.TargetPath;
                if(!string.IsNullOrWhiteSpace(target)&&Path.GetFullPath(target).Equals(Path.GetFullPath(Executable),StringComparison.OrdinalIgnoreCase)) {
                    File.Delete(linkPath);Log("OWNED_USER_STARTUP_REMOVED");
                }
            } finally {if(instance!=null)Marshal.FinalReleaseComObject(instance);Marshal.FinalReleaseComObject(shell);}
        }
    }
    public static void Install(bool configureHosts, Action<string> report)
    {
        var ownerSid=InteractiveOwner.Require();
        if(File.Exists(Path.Combine(Provisioning.Storage,"setup.bin")))throw new InvalidOperationException("Configuração local existente; conclua a remoção/recuperação anterior.");
        if(File.Exists(Path.Combine(Provisioning.Storage,"pending-enrollment.bin")))throw new InvalidOperationException("Cadastro anterior incompleto; conclua a reversão pelo desinstalador.");
        if(File.Exists(Path.Combine(Provisioning.Storage,"activation-recovery.bin")))throw new InvalidOperationException("Recuperação anterior pendente; use a remoção existente.");
        if(File.Exists(Path.Combine(Provisioning.Storage,"account-registration.bin")))throw new InvalidOperationException("Cadastro anterior preservado; use a remoção existente.");
        if(Provisioning.HasIdentity)throw new InvalidOperationException("Identidade local existente; use desinstalação ou recuperação da TI, sem criar duplicata.");
        if(Directory.Exists(Path.Combine(Provisioning.Storage,"Mesh")))throw new InvalidOperationException("Dados Mesh anteriores preservados; use a desinstalação existente.");
        if(File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup),"Uai Suporte.lnk")))throw new InvalidOperationException("Atalho de inicialização preexistente; use a desinstalação existente antes de instalar.");
        CheckStopped(); SafePath(Root); SafePath(Menu); SafePath(Provisioning.Storage); SafePath(Path.GetDirectoryName(Hosts)!);
        InstallState? previous = null;
        if (File.Exists(StateFile)) previous = JsonSerializer.Deserialize<InstallState>(File.ReadAllText(StateFile));
        bool reusable = (previous?.Product == "UaiSuporte-LAB-0.5.0" || previous?.Product == "UaiSuporte-LAB-0.4.0") && previous.Removed && !File.Exists(Installer) && !Directory.Exists(App);
        if ((Directory.Exists(Root) && !reusable) || Directory.Exists(Menu)) throw new InvalidOperationException("Já existe instalação ou pasta deste laboratório. Nada será sobrescrito. Use o desinstalador existente e reinicie antes de reinstalar, ou solicite revisão da TI.");
        using var cert = Certificate();
        if (DateTime.UtcNow < cert.NotBefore.ToUniversalTime() || DateTime.UtcNow > cert.NotAfter.ToUniversalTime()) throw new InvalidOperationException("CA fora da validade. Confira o relógio e a emissão do laboratório.");
        var state = new InstallState { CaOwned = false,OwnerSid=ownerSid };
        var plan = configureHosts ? LabPolicy.AddHosts(File.ReadAllBytes(Hosts), state.Id) : (Result: Array.Empty<byte>(), Block: "");
        Directory.CreateDirectory(Root);
        try {
        Save(state); Log("INSTALL_BEGIN_UNIFIED");
        // Keep a usable uninstaller before touching machine trust or names. Journal supports partial-install cleanup.
        Directory.CreateDirectory(Path.GetDirectoryName(Installer)!);
        File.Copy(Environment.ProcessPath ?? throw new InvalidOperationException("Executável original não encontrado."), Installer, false);
        RegisterUninstaller();

            report("Instalando Uai Suporte e configuração explícita do laboratório…");
            Directory.CreateDirectory(App);
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("app.zip")!) Policy.Extract(stream, App);
            Log("APPLICATION_FILES_OK");
            File.WriteAllBytes(Path.Combine(Root, "lab-ca.cer"), cert.RawData);
            File.WriteAllBytes(Path.Combine(Root, "dependencies.json"), Resource("dependencies.json"));
            File.WriteAllText(Path.Combine(Root, "server.json"), JsonSerializer.Serialize(new { api = "https://suporte.internal", mesh = "https://mesh.internal", ip = LabPolicy.Ip, caSha256 = LabPolicy.CaHash, receivingValidated = false }));
            using (var store = new X509Store(StoreName.Root, StoreLocation.LocalMachine))
            {
                store.Open(OpenFlags.ReadWrite);
                bool exists = store.Certificates.Cast<X509Certificate2>().Any(x => Convert.ToHexString(SHA256.HashData(x.RawData)) == LabPolicy.CaHash);
                if (!exists) { state.CaOwned = true; Save(state); store.Add(cert); Log("CA_MACHINE_ADDED_SHA256_" + LabPolicy.CaHash); }
                else Log("CA_MACHINE_PREEXISTING_PRESERVED");
            }
            if (configureHosts && plan.Block.Length > 0)
            {
                // Recompute with the current file under exclusive lock; preserve concurrent changes made before lock.
                using var file = new FileStream(Hosts, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
                using var memory = new MemoryStream(); file.CopyTo(memory);
                var current = memory.ToArray(); var change = LabPolicy.AddHosts(current, state.Id);
                File.WriteAllBytes(Path.Combine(Root, "hosts-before.bin"), current);
                state.HostsBlock = change.Block; Save(state);
                file.Position = 0; file.Write(change.Result); file.SetLength(change.Result.Length); file.Flush(true);
                Log("HOSTS_MARKED_BLOCK_ADDED_" + state.Id);
            }
            else Log("HOSTS_UNCHANGED");
            // Validate the exact embedded MeshAgent after explicit CA/hosts setup and before execution.
            var agentPath=Path.Combine(Root,"Dependencies","MeshAgent.exe");
            Directory.CreateDirectory(Path.GetDirectoryName(agentPath)!);
            File.WriteAllBytes(agentPath,Resource("meshagent.exe"));
            if(!Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(agentPath))).Equals(Provisioning.MeshHash,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Hash do MeshAgent recusado.");
            using(var locked=new FileStream(agentPath,FileMode.Open,FileAccess.Read,FileShare.Read))Authenticode.RequireValid(agentPath);
            Log("MESH_HASH_AND_AUTHENTICODE_OK");
            WebView(report);
            state.OwnsDeviceData=true;Save(state);
            Log("DEVICE_LOCAL_PREPARATION_BEGIN");
            Provisioning.PrepareForActivation(agentPath);
            Log("DEVICE_LOCAL_READY_AWAITING_ACTIVATION");
            var startup=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup),"Uai Suporte.lnk");
            if(File.Exists(startup))throw new InvalidOperationException("Atalho de inicialização preexistente; nada será sobrescrito.");
            state.StartupOwned=true;Save(state);
            Shortcut(startup,Executable);
            Directory.CreateDirectory(Menu);
            Shortcut(Path.Combine(Menu, "Uai Suporte.lnk"), Executable);
            Shortcut(Path.Combine(Menu, "Desinstalar Uai Suporte.lnk"), Installer, "--uninstall");
            Log("STARTUP_AND_SHORTCUTS_OK");
            state.Complete = true; Save(state); Log("INSTALL_COMPLETE");
        }
        catch(Exception original) {
            SetupAudit.Write("INSTALL_STAGE_FAILED", original);
            report("Revertendo alterações…");
            Log("INSTALL_FAILED_ROLLBACK_BEGIN");state.RollbackPending=true;Save(state);
            if(state.OwnsDeviceData)File.Delete(Path.Combine(Provisioning.Storage,"setup.bin"));
            try{Remove(true);SetupAudit.Write("ROLLBACK_OK_REBOOT_REQUIRED");}
            catch{Log("ROLLBACK_PENDING_RECONNECT_AND_UNINSTALL");throw new InvalidOperationException("Instalação falhou e a reversão não pôde ser concluída. Nenhum motor fica iniciado. Reconecte ao servidor e use o desinstalador para revogar a identidade e concluir a limpeza. Registro: "+StateFile,original);}
            throw new InvalidOperationException("Instalação desfeita. Se houver cadastro anterior, preserve sua identidade. "+original.Message,original);
        }
    }
    public static async Task<string> CheckNetwork()
    {
        using var http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(10) };
        using var api = await http.GetAsync("https://suporte.internal/api/auth/me");
        using var mesh = await http.GetAsync("https://mesh.internal/");
        return api.StatusCode == System.Net.HttpStatusCode.Unauthorized && mesh.IsSuccessStatusCode
            ? "HTTPS e certificados dos dois servidores confirmados. Abra Uai Suporte pelo menu Iniciar."
            : "Instalação concluída; servidor respondeu fora do esperado. A TI deve verificar acesso de rede e serviços.";
    }
    static void DeleteTree(string path)
    {
        if (!Directory.Exists(path)) return;
        SafePath(path);
        foreach (var item in Directory.EnumerateFileSystemEntries(path))
        {
            var attributes = File.GetAttributes(item);
            if ((attributes & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("Link de sistema encontrado. Remoção suspensa para revisão.");
            if ((attributes & FileAttributes.Directory) != 0) DeleteTree(item); else File.Delete(item);
        }
        Directory.Delete(path);
    }
    static void ScheduleOwnedRemoval(string path) {
        SafePath(path);
        foreach(var child in Directory.EnumerateFileSystemEntries(path)){
            if((File.GetAttributes(child)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("Link inesperado na instalação; remoção suspensa.");
            if(Directory.Exists(child))ScheduleOwnedRemoval(child);
            else if(!MoveFileEx(child,null,4))throw new InvalidOperationException("Não foi possível agendar limpeza completa; registro preservado.");
        }
        if(!MoveFileEx(path,null,4))throw new InvalidOperationException("Não foi possível agendar remoção da pasta do instalador.");
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool MoveFileEx(string existing, string? replacement, int flags);
    public static string Remove(bool removeCaConfirmed)
    {
        CheckStopped(); SafePath(Root); SafePath(Menu);
        if (!File.Exists(StateFile)) throw new InvalidOperationException("Registro desta instalação não encontrado. Nenhum arquivo externo será removido.");
        var state = JsonSerializer.Deserialize<InstallState>(File.ReadAllText(StateFile)) ?? throw new InvalidOperationException("Registro inválido.");
        if (state.Product != "UaiSuporte-LAB-0.5.0") throw new InvalidOperationException("Registro de outro produto; remoção bloqueada.");
        if(state.OwnerSid.Length>0&&InteractiveOwner.Require()!=state.OwnerSid)throw new InvalidOperationException("Conclua a remoção na conta Windows usada no cadastro.");
        Log("UNINSTALL_BEGIN");
        // Revoke before deleting the only local credential. Offline failure leaves an explicit retryable journal.
        if(state.OwnsDeviceData){Provisioning.Revoke().GetAwaiter().GetResult();Log("DEVICE_REVOCATION_CONFIRMED");}

        if (state.HostsBlock.Length > 0)
        {
            SafePath(Path.GetDirectoryName(Hosts)!);
            using var file = new FileStream(Hosts, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
            using var memory = new MemoryStream(); file.CopyTo(memory);
            var bytes = LabPolicy.RemoveHosts(memory.ToArray(), state.HostsBlock);
            file.Position = 0; file.Write(bytes); file.SetLength(bytes.Length); file.Flush(true);
            state.HostsBlock = ""; Save(state); Log("HOSTS_OWN_BLOCK_REMOVED");
        }
        if(!state.RollbackPending||state.StartupOwned)RemoveOwnedUserStartup();
        DeleteTree(App);
        if(state.OwnsDeviceData){
            SafePath(Provisioning.Storage);
            if(state.RollbackPending){
                DeleteTree(Path.Combine(Provisioning.Storage,"Mesh"));
                foreach(var name in new[]{"identity.bin","setup.bin","pending-enrollment.bin","account-registration.bin","activation-recovery.bin"}){File.Delete(Path.Combine(Provisioning.Storage,name));File.Delete(Path.Combine(Provisioning.Storage,name+".new"));}
            } else DeleteTree(Provisioning.Storage);
            state.OwnsDeviceData=false;Save(state);Log("OWNED_DEVICE_DATA_REMOVED");
        }
        foreach (var link in new[] { "Uai Suporte.lnk", "Desinstalar Uai Suporte.lnk", "Desinstalar Uai Suporte LAB.lnk" })
        { var path = Path.Combine(Menu, link); if (File.Exists(path)) File.Delete(path); }
        if (Directory.Exists(Menu) && !Directory.EnumerateFileSystemEntries(Menu).Any()) Directory.Delete(Menu);
        string caResult = "CA preservada (preexistente ou sem confirmação de ausência de dependentes).";
        if (state.CaOwned && removeCaConfirmed)
        {
            if (Directory.Exists(Path.Combine(Root, "Client")) || Directory.Exists(Path.Combine(Root, "Cliente"))) throw new InvalidOperationException("Componente Cliente encontrado. CA preservada; a TI deve revisar dependentes.");
            using var store = new X509Store(StoreName.Root, StoreLocation.LocalMachine); store.Open(OpenFlags.ReadWrite);
            foreach (var candidate in store.Certificates.Cast<X509Certificate2>())
                if (Convert.ToHexString(SHA256.HashData(candidate.RawData)) == LabPolicy.CaHash) store.Remove(candidate);
            state.CaOwned = false; Save(state); Log("CA_OWNED_REMOVED_ADMIN_CONFIRMED_NO_DEPENDENTS"); caResult = "Somente a CA instalada por este assistente foi removida de LocalMachine/Root.";
        }
        state.Complete = false; state.Removed = true;state.RollbackPending=false; Save(state);
        DeleteTree(Path.Combine(Root, "Dependencies"));
        Log("UNINSTALL_COMPLETE_PRIVATE_RUNTIME_REMOVED");
        // The executing self-contained uninstaller cannot delete itself. Schedule only its own file at reboot.
        if (File.Exists(Installer) && !MoveFileEx(Installer, null, 4)) throw new InvalidOperationException("Aplicativo removido; não foi possível agendar remoção do desinstalador. A TI deve revisar antes de reiniciar.");
        using var machine = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
        ScheduleOwnedRemoval(Root);
        machine.DeleteSubKeyTree(UninstallKey, false);
        return "Aplicativo e atalhos removidos. " + caResult + " Runtime privado removido; runtimes preexistentes preservados. Reinicie para remover o executável do desinstalador. Arquivos restantes do instalador serão removidos no reinício. Auditoria de acesso permanece no servidor. Registro até o reinício: " + Root;
    }
}
