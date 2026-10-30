using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;
namespace UaiSuporte.Setup;

// Launch only the fixed installed executable with the current desktop owner's non-elevated token.
// No shell commands, credentials, elevation fallback or cross-user launch.
internal static class NormalUserLaunch
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct StartupInfo
    {
        public int Size; public string? Reserved, Desktop, Title;
        public int X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
        public short Show, ReservedSize; public IntPtr ReservedBytes, Input, Output, Error;
    }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process, Thread; public uint Pid, Tid; }
    [DllImport("user32.dll")] static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr process, uint access, out SafeAccessTokenHandle token);
    [DllImport("advapi32.dll", SetLastError = true)] static extern bool DuplicateTokenEx(SafeAccessTokenHandle token, uint access, IntPtr attributes, int level, int type, out SafeAccessTokenHandle duplicate);
    [DllImport("advapi32.dll", SetLastError = true)] static extern bool GetTokenInformation(SafeAccessTokenHandle token, int type, out int elevation, int size, out int returned);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool CreateProcessWithTokenW(SafeAccessTokenHandle token, uint logon, string application, StringBuilder command, uint flags, IntPtr environment, string directory, ref StartupInfo startup, out ProcessInfo process);
    [DllImport("userenv.dll", SetLastError = true)] static extern bool CreateEnvironmentBlock(out IntPtr environment, SafeAccessTokenHandle token, bool inherit);
    [DllImport("userenv.dll")] static extern bool DestroyEnvironmentBlock(IntPtr environment);
    static void Check(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    internal static void Start()
    {
        Policy.RequireCommitted(File.ReadAllText(Installation.StateFile));
        InteractiveOwner.Require();
        var window = GetShellWindow();
        if (window == IntPtr.Zero) throw new InvalidOperationException("Sessão interativa ausente.");
        GetWindowThreadProcessId(window, out var pid);
        var process = OpenProcess(0x1000, false, pid);
        if (process == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        try
        {
            Check(OpenProcessToken(process, 0xA, out var token));
            using (token)
            {
                using var owner = new WindowsIdentity(token.DangerousGetHandle());
                using var current = WindowsIdentity.GetCurrent();
                if (owner.User == null || owner.User != current.User) throw new InvalidOperationException("Conta interativa diferente.");
                Check(GetTokenInformation(token, 20, out var elevated, sizeof(int), out _));
                if (elevated != 0) throw new InvalidOperationException("A sessão está elevada. Abra o aplicativo normalmente pelo menu Iniciar.");
                Check(DuplicateTokenEx(token, 0xB, IntPtr.Zero, 2, 1, out var primary));
                using (primary)
                {
                    Check(CreateEnvironmentBlock(out var environment, primary, false));
                    try
                    {
                        var startup = new StartupInfo { Size = Marshal.SizeOf<StartupInfo>(), Desktop = @"winsta0\default" };
                        Check(CreateProcessWithTokenW(primary, 0, Installation.Executable, new StringBuilder('"' + Installation.Executable + '"'), 0x400, environment, Installation.App, ref startup, out var child));
                        CloseHandle(child.Thread); CloseHandle(child.Process);
                    }
                    finally { DestroyEnvironmentBlock(environment); }
                }
            }
        }
        finally { CloseHandle(process); }
    }
}
