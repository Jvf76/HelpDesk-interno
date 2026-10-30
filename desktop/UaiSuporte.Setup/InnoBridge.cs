using System.Security.AccessControl;
using System.Security.Principal;
namespace UaiSuporte.Setup;

// Only explicit CA/hosts/license choices cross this boundary; no enrollment code or credential.
internal static class InnoBridge
{
    internal static bool Handles(string[] args) => args.Length > 0 && args[0].StartsWith("--inno-", StringComparison.Ordinal);
    internal static int Run(string[] args)
    {
        string? request = null;
        try
        {
            InteractiveOwner.Require();
            if (args.Length == 1 && args[0] == "--inno-launch") { NormalUserLaunch.Start(); return 0; }
            if (args.Length != 2) return 10;
            var directory = Path.GetFullPath(args[1]);
            var temp = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!directory.StartsWith(temp, StringComparison.OrdinalIgnoreCase)) return 10;
            for (var parent = new DirectoryInfo(directory); parent != null; parent = parent.Parent)
                if (parent.Exists && (parent.Attributes & FileAttributes.ReparsePoint) != 0) return 10;
            var sid = WindowsIdentity.GetCurrent().User ?? throw new InvalidOperationException();
            if (args[0] == "--inno-prepare")
            {
                if (Directory.Exists(directory)) return 10;
                var acl = new DirectorySecurity(); acl.SetOwner(sid); acl.SetAccessRuleProtection(true, false);
                foreach (var owner in new[] {sid, new SecurityIdentifier("S-1-5-18"), new SecurityIdentifier("S-1-5-32-544")})
                    acl.AddAccessRule(new FileSystemAccessRule(owner, FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
                new DirectoryInfo(directory).Create(acl);
                return 0;
            }
            if (args[0] != "--inno-install") return 10;
            var security = new DirectoryInfo(directory).GetAccessControl();
            if (!security.AreAccessRulesProtected || !sid.Equals(security.GetOwner(typeof(SecurityIdentifier)))) return 10;
            foreach (FileSystemAccessRule rule in security.GetAccessRules(true, true, typeof(SecurityIdentifier)))
                if (rule.AccessControlType == AccessControlType.Allow && !rule.IdentityReference.Equals(sid) && rule.IdentityReference.Value != "S-1-5-18" && rule.IdentityReference.Value != "S-1-5-32-544") return 10;
            request = Path.Combine(directory, "settings.txt");
            if ((File.GetAttributes(request) & FileAttributes.ReparsePoint) != 0 || new FileInfo(request).Length > 512) return 10;
            var lines = File.ReadAllLines(request); File.Delete(request);
            bool configureHosts = InnoRequest.Validate(lines);
            SetupAudit.Write("INNO_INSTALL_BEGIN_0.6.1");
            Installation.Install(configureHosts, _ => { });
            Array.Clear(lines);
            SetupAudit.Write("INNO_INSTALL_OK");
            return 0;
        }
        catch (Exception e) { SetupAudit.Write("INNO_INSTALL_FAILED", e); return 20; }
        finally { if (request != null) { try { File.Delete(request); } catch { } } }
    }
}
