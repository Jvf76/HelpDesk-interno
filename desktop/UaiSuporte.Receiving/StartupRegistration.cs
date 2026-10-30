using System.Runtime.InteropServices;
namespace UaiSuporte.Agent;

// Per-user interactive startup, deliberately not a hidden service or Session 0 desktop.
internal static class StartupRegistration
{
    public static void EnsureVisibleStartup(string executable)
    {
        var startup=Environment.GetFolderPath(Environment.SpecialFolder.Startup);
        Directory.CreateDirectory(startup);
        var path=Path.Combine(startup,"Uai Suporte.lnk");
        var type=Type.GetTypeFromProgID("WScript.Shell") ?? throw new InvalidOperationException("Registro de inicialização indisponível.");
        dynamic shell=Activator.CreateInstance(type)!; object? instance=null;
        try {
            dynamic shortcut=shell.CreateShortcut(path); instance=shortcut;
            if(File.Exists(path) && !string.Equals(Path.GetFullPath((string)shortcut.TargetPath),Path.GetFullPath(executable),StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Já existe outro atalho de inicialização Uai Suporte. A TI deve revisar antes de substituir.");
            shortcut.TargetPath=executable;
            shortcut.Arguments="";
            shortcut.WorkingDirectory=Path.GetDirectoryName(executable);
            shortcut.Description="Uai Suporte visível: consentimento e encerramento local";
            shortcut.Save();
        } finally {
            if(instance!=null)Marshal.FinalReleaseComObject(instance);
            Marshal.FinalReleaseComObject(shell);
        }
    }
}
